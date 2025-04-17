import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { parseEther, formatEther } from 'ethers'
import { ethers, network, upgrades } from 'hardhat'
import { expect } from 'chai'
import {
    ERC6551Registry,
    BotAccount,
    Bot,
    ERC20Token,
    ERC6551Registry__factory,
    BotAccount__factory,
    Bot__factory,
    ERC20Token__factory
} from '../typechain-types'

describe('ERC 6551 Bot Account', () => {

    const deployContracts = async () => {
        const [deployer, admin, minter, user1, user2] = await ethers.getSigners();
        const erc6551Registry: ERC6551Registry = await new ERC6551Registry__factory(deployer).deploy()
        const botAccount: BotAccount = await new BotAccount__factory(deployer).deploy()
        const botNFT: Bot = await new Bot__factory(deployer).deploy(
            await admin.getAddress(),
            await minter.getAddress(),
            await erc6551Registry.getAddress(),
            await botAccount.getAddress()
        );
        await erc6551Registry.connect(deployer).setBotContract(botNFT.target);
        const erc20Token: ERC20Token = await new ERC20Token__factory(deployer).deploy()
        const chainId = await network.provider.send('eth_chainId');

        return { erc6551Registry, botAccount, botNFT, erc20Token, chainId, deployer, admin, minter, user1, user2 }
    }

    const createExecutors = (count = 1) => {
        let executorList = [];
        for (let i = 0; i < count; i++) {
            const botExecutorWallet = ethers.Wallet.createRandom();
            executorList.push(botExecutorWallet);
        }
        return executorList;
    }

    const getBotWallet = async (botNFT: Bot, executor: any) => {
        let filter = botNFT.filters.BotMinted(
            null,
            null,
            executor
        )
        const events = await botNFT.queryFilter(filter);
        return events[0]?.args?.botWallet;
    }

    // Helper function to generate EIP-712 compliant signature
    const generateExecuteCallSignature = async (
        botAccount: BotAccount,
        executor: any,
        to: string,
        value: bigint,
        data: string,
        chainId: string
    ) => {
        const domain = {
            name: "BotAccount",
            version: "1",
            chainId: chainId,
            verifyingContract: await botAccount.getAddress()
        };

        const types = {
            ExecuteCall: [
                { name: "to", type: "address" },
                { name: "value", type: "uint256" },
                { name: "data", type: "bytes" },
                { name: "nonce", type: "uint256" }
            ]
        };

        const nonce = await botAccount.nonce();
        const message = {
            to: to,
            value: value,
            data: data,
            nonce: nonce
        };

        const signature = await executor.signTypedData(domain, types, message);
        return signature;
    };

    describe("BOT NFT", async () => {
        it('should execute call with EIP-712 signature from BOT NFT TBA', async () => {
            const { erc6551Registry, botAccount, botNFT, erc20Token, chainId, deployer, admin, minter, user1 } = await loadFixture(deployContracts)
        
            const botExecutor = createExecutors()[0]
            const botExecutorAddress = botExecutor.address
        
            const uri = "QmZPBffLwhKYSseJzpGGXLuKg5RkZZp4PxjfoKy1hjQ5jR"
            await botNFT.connect(minter).safeMint(user1.address, uri, botExecutorAddress)
        
            expect(await botNFT.balanceOf(user1.address)).to.equal("1")
            expect(await botNFT.ownerOf("0")).to.equal(user1.address)
        
            const tokenAccountAddress = await getBotWallet(botNFT, botExecutorAddress)
            expect(tokenAccountAddress).to.not.be.undefined
        
            await deployer.sendTransaction({
                to: tokenAccountAddress,
                value: parseEther("1.0")
            });
        
            const tokenAccount = await ethers.getContractAt("BotAccount", tokenAccountAddress)
            expect(await tokenAccount.botExecutor()).to.equal(botExecutorAddress)
        
            // --- Domain Separator Test ---
            const expectedDomain = {
                name: "BotAccount",
                version: "1",
                chainId: chainId,
                verifyingContract: tokenAccountAddress
            }
        
            const domainTypeHash = ethers.id("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
            const nameHash = ethers.id(expectedDomain.name);
            const versionHash = ethers.id(expectedDomain.version);
        
            const expectedDomainSeparator = ethers.keccak256(
                ethers.AbiCoder.defaultAbiCoder().encode(
                    ["bytes32", "bytes32", "bytes32", "uint256", "address"],
                    [
                        domainTypeHash,
                        nameHash,
                        versionHash,
                        Number(chainId),
                        tokenAccountAddress
                    ]
                )
            );
        
            const contractDomainSeparator = await tokenAccount.getDomainSeparator();
            expect(contractDomainSeparator).to.equal(expectedDomainSeparator);
        })

        it('should execute call from NFT owner from BOT NFT TBA', async () => {
            const { erc6551Registry, botAccount, botNFT, erc20Token, chainId, deployer, admin, minter, user1, user2 } = await loadFixture(deployContracts)

            const botExecutor = createExecutors()[0]
            const botExecutorAddress = botExecutor.address

            let uri = "QmZPBffLwhKYSseJzpGGXLuKg5RkZZp4PxjfoKy1hjQ5jR"
            await botNFT.connect(minter).safeMint(user1.address, uri, botExecutorAddress)
            expect(await botNFT.balanceOf(user1.address)).to.equal("1")
            expect(await botNFT.ownerOf("0")).to.equal(user1.address)

            const tokenAccountAddress = await getBotWallet(botNFT, botExecutorAddress);

            expect(await ethers.provider.getBalance(tokenAccountAddress)).to.equal(0)

            await deployer.sendTransaction({
                to: tokenAccountAddress,
                value: parseEther("1.0")
            });

            expect(await ethers.provider.getBalance(tokenAccountAddress)).to.equal(parseEther("1.0"))
            const tokenAccount = await ethers.getContractAt("BotAccount", tokenAccountAddress);

            expect(await tokenAccount.nonce()).to.equal(0)

            let balanceUser2Before = await ethers.provider.getBalance(user2.address);
            await tokenAccount.connect(user1).executeCall(user2.address, parseEther("1"), "0x")
            let balanceUser2After = await ethers.provider.getBalance(user2.address);
            expect(balanceUser2After - balanceUser2Before).to.equal(parseEther("1"))

            expect(await tokenAccount.nonce()).to.equal(1)

            let ERC20BalanceTBABefore = await erc20Token.balanceOf(tokenAccountAddress)
            await erc20Token.transfer(tokenAccountAddress, parseEther("10"))
            let ERC20BalanceTBAAfter = await erc20Token.balanceOf(tokenAccountAddress)
            expect(ERC20BalanceTBAAfter - ERC20BalanceTBABefore).to.equal(parseEther("10"))

            let ERC20BalanceUser2Before = await erc20Token.balanceOf(user2.address)
            let encodedFunctionCall = erc20Token.interface.encodeFunctionData('transfer', [user2.address, parseEther("5.0")])
            await tokenAccount.connect(user1).executeCall(await erc20Token.getAddress(), "0", encodedFunctionCall)
            let ERC20BalanceUser2After = await erc20Token.balanceOf(user2.address)

            expect(ERC20BalanceUser2After - ERC20BalanceUser2Before).to.equal(parseEther("5.0"))
        })
        
        it('should batch mint NFT', async () => {
            const { botNFT, erc6551Registry, botAccount, erc20Token, chainId, deployer, admin, minter, user1, user2 } = await loadFixture(deployContracts)
    
            const botExecutors = createExecutors(2)
            const botExecutorsList = botExecutors.map(executor => executor.address)
            const uriList = [
                "QmZPBffLwhKYSseJzpGGXLuKg5RkZZp4PxjfoKy1hjQ5jR",
                "QmZPBffLwhKYSseJzpGGXLuKg5RkZZp4PxjfoKy1hjasdfasdf"
            ]
    
            await botNFT.connect(minter).batchSafeMint([user1.address, user2.address], uriList, botExecutorsList)
    
            expect(await botNFT.balanceOf(user1.address)).to.equal("1")
            expect(await botNFT.ownerOf("0")).to.equal(user1.address)
    
            const tokenAccountAddress1 = await getBotWallet(botNFT, botExecutorsList[0])
            const tokenAccount1 = await ethers.getContractAt("BotAccount", tokenAccountAddress1)
    
            expect(await tokenAccount1.botExecutor()).to.equal(botExecutorsList[0])

        })

        it('should batch mint limit test', async () => {
            const { erc6551Registry, botAccount, botNFT, erc20Token, chainId, deployer, admin, minter, user1, user2 } = await loadFixture(deployContracts)

            let count = 80;

            const botExecutors = createExecutors(count)
            const botExecutorsList = botExecutors.map(executor => executor.address)
            const userList = Array(count).fill(user1.address)

            let uriList = Array(count).fill("QmZPBffLwhKYSseJzpGGXLuKg5RkZZp4PxjfoKy1hjQ5jR")
            await botNFT.connect(minter).batchSafeMint(userList, uriList, botExecutorsList)
        })
        
        it("Should reject execution call from non-owner", async () => {
            const { botAccount, user1 } = await loadFixture(deployContracts);
            await expect(
                botAccount.executeCall(user1.address, 0, "0x")
            ).to.be.reverted;
        });
        
        it("Should execute call with valid EIP-712 signature", async () => {
            const { botAccount, botNFT, erc6551Registry, deployer, minter, user1, chainId } = await loadFixture(deployContracts);
            
            // Mint an NFT and create TBA
            const executor = deployer;
            await botNFT.connect(minter).safeMint(user1.address, "ipfs://uri", executor.address);
            const tokenAccountAddress = await getBotWallet(botNFT, executor.address);
            const tokenAccount = await ethers.getContractAt("BotAccount", tokenAccountAddress);
            
            // Generate EIP-712 signature
            const signature = await generateExecuteCallSignature(
                tokenAccount,
                executor,
                user1.address,
                0,
                "0x",
                chainId
            );
            
            await expect(
                tokenAccount.executeCallWithSignature(user1.address, 0, "0x", signature)
            ).to.not.be.reverted;
        });
        
        it("Should return correct nonce value", async () => {
            const { botAccount } = await loadFixture(deployContracts);
            expect(await botAccount.nonce()).to.equal(0);
        });
        
        it("Should support correct interfaces", async () => {
            const { botAccount } = await loadFixture(deployContracts);
            expect(await botAccount.supportsInterface("0x01ffc9a7")).to.be.true; 
        });
        
        it("Should validate signature correctly", async () => {
            const { botAccount, botNFT, erc6551Registry, deployer, minter, user1 } = await loadFixture(deployContracts);
            
            // Mint an NFT and create TBA
            const executor = deployer.address;
            await botNFT.connect(minter).safeMint(user1.address, "ipfs://uri", executor);
            const tokenAccountAddress = await getBotWallet(botNFT, executor);
            const tokenAccount = await ethers.getContractAt("BotAccount", tokenAccountAddress);
            
            const messageHash = ethers.keccak256(ethers.toUtf8Bytes("test message"));
            const signature = await deployer.signMessage(ethers.getBytes(messageHash));
            expect(await tokenAccount.isValidSignature.staticCall(messageHash, signature)).to.equal("0x1626ba7e");
        });
        
        it("Should correctly receive ERC721 tokens", async () => {
            const { botAccount, user1 } = await loadFixture(deployContracts);
            
            const response = await botAccount.onERC721Received.staticCall(
                user1.address,
                user1.address,
                1,
                "0x"
            );
            
            expect(response).to.equal("0x150b7a02");
        });

        it("Should reject invalid signatures", async () => {
            const { botNFT, minter, user1, user2, deployer } = await loadFixture(deployContracts);
            
            // Mint NFT to user1 with deployer as executor
            await botNFT.connect(minter).safeMint(user1.address, "ipfs://uri", deployer.address);
            const tokenAccountAddress = await getBotWallet(botNFT, deployer.address);
            const tokenAccount = await ethers.getContractAt("BotAccount", tokenAccountAddress);
            
            // Create test message
            const messageHash = ethers.keccak256(ethers.toUtf8Bytes("test message"));
            
            // 1. Test with signature from random user (user2) - should fail
            const invalidSignature1 = await user2.signMessage(ethers.getBytes(messageHash));
            expect(await tokenAccount.isValidSignature.staticCall(messageHash, invalidSignature1)).to.equal("0x00000000");
            
            // 2. Test with signature from owner (user1) - should pass
            const validSignature1 = await user1.signMessage(ethers.getBytes(messageHash));
            expect(await tokenAccount.isValidSignature.staticCall(messageHash, validSignature1)).to.equal("0x1626ba7e");
            
            // 3. Test with signature from executor (deployer) - should pass
            const validSignature2 = await deployer.signMessage(ethers.getBytes(messageHash));
            expect(await tokenAccount.isValidSignature.staticCall(messageHash, validSignature2)).to.equal("0x1626ba7e");
        });
        
        it("Should revert execution with insufficient funds", async () => {
            const { botNFT, minter, user1, deployer } = await loadFixture(deployContracts);
            
            await botNFT.connect(minter).safeMint(user1.address, "ipfs://uri", deployer.address);
            const tokenAccountAddress = await getBotWallet(botNFT, deployer.address);
            const tokenAccount = await ethers.getContractAt("BotAccount", tokenAccountAddress);
            
            await expect(
                tokenAccount.connect(user1).executeCall(user1.address, parseEther("1.0"), "0x")
            ).to.be.reverted;
        });
        
        it("Should handle failed external calls", async () => {
            const { botNFT, minter, user1, erc20Token, deployer } = await loadFixture(deployContracts);
            
            await botNFT.connect(minter).safeMint(user1.address, "ipfs://uri", deployer.address);
            const tokenAccountAddress = await getBotWallet(botNFT, deployer.address);
            const tokenAccount = await ethers.getContractAt("BotAccount", tokenAccountAddress);
            
            // Fund the account
            await deployer.sendTransaction({ to: tokenAccountAddress, value: parseEther("1.0") });
            
            // Create a failing call (transfer more than balance)
            const encodedFunctionCall = erc20Token.interface.encodeFunctionData(
                'transfer', 
                [user1.address, parseEther("1000")]
            );
            
            await expect(
                tokenAccount.connect(user1).executeCall(erc20Token.target, 0, encodedFunctionCall)
            ).to.be.reverted;
        });

        it("Should prevent re-initialization", async () => {
            const { botAccount, deployer } = await loadFixture(deployContracts);
            await expect(
                botAccount.initialize(deployer.address)
            ).to.be.revertedWith("Initializable: contract is already initialized");
        });
        
        it("Should correctly handle ETH transfers", async () => {
            const { botNFT, minter, user1, deployer } = await loadFixture(deployContracts);
            
            await botNFT.connect(minter).safeMint(user1.address, "ipfs://uri", deployer.address);
            const tokenAccountAddress = await getBotWallet(botNFT, deployer.address);
            
            const transferAmount = parseEther("1.0");
            await deployer.sendTransaction({
                to: tokenAccountAddress,
                value: transferAmount
            });
            
            expect(await ethers.provider.getBalance(tokenAccountAddress)).to.equal(transferAmount);
        });

        it("Should prevent signature replay attacks", async () => {
            const { botNFT, minter, user1, erc20Token, deployer, chainId } = await loadFixture(deployContracts);
            
            await botNFT.connect(minter).safeMint(user1.address, "ipfs://uri", deployer.address);
            const tokenAccountAddress = await getBotWallet(botNFT, deployer.address);
            const tokenAccount = await ethers.getContractAt("BotAccount", tokenAccountAddress);
            
            await erc20Token.transfer(tokenAccountAddress, parseEther("10"));
            
            const encodedFunctionCall = erc20Token.interface.encodeFunctionData(
                'transfer', 
                [user1.address, parseEther("5.0")]
            );
            
            // Generate EIP-712 signature
            const signature = await generateExecuteCallSignature(
                tokenAccount,
                deployer,
                await erc20Token.getAddress(),
                0,
                encodedFunctionCall,
                chainId
            );
            
            // First execution should succeed
            await tokenAccount.connect(user1).executeCallWithSignature(
                await erc20Token.getAddress(), 
                0, 
                encodedFunctionCall, 
                signature
            );
            
            // Second execution with same signature should fail
            await expect(
                tokenAccount.connect(user1).executeCallWithSignature(
                    await erc20Token.getAddress(), 
                    0, 
                    encodedFunctionCall, 
                    signature
                )
            ).to.be.revertedWith("Not executor approved");
        });

        it("Should reject invalid EIP-712 signatures", async () => {
            const { botNFT, minter, user1, erc20Token, deployer, user2, chainId } = await loadFixture(deployContracts);
            
            await botNFT.connect(minter).safeMint(user1.address, "ipfs://uri", deployer.address);
            const tokenAccountAddress = await getBotWallet(botNFT, deployer.address);
            const tokenAccount = await ethers.getContractAt("BotAccount", tokenAccountAddress);
            
            await erc20Token.transfer(tokenAccountAddress, parseEther("10"));
            
            const encodedFunctionCall = erc20Token.interface.encodeFunctionData(
                'transfer', 
                [user1.address, parseEther("5.0")]
            );
            
            // 1. Test with signature from wrong executor (user2)
            const invalidSignature1 = await generateExecuteCallSignature(
                tokenAccount,
                user2, // Wrong executor
                await erc20Token.getAddress(),
                0,
                encodedFunctionCall,
                chainId
            );
            
            await expect(
                tokenAccount.connect(user1).executeCallWithSignature(
                    await erc20Token.getAddress(), 
                    0, 
                    encodedFunctionCall, 
                    invalidSignature1
                )
            ).to.be.revertedWith("Not executor approved");
            
            // 2. Test with signature for wrong nonce
            const currentNonce = await tokenAccount.nonce();
            const wrongNonceSignature = await deployer.signTypedData(
                {
                    name: "BotAccount",
                    version: "1",
                    chainId: chainId,
                    verifyingContract: tokenAccountAddress
                },
                {
                    ExecuteCall: [
                        { name: "to", type: "address" },
                        { name: "value", type: "uint256" },
                        { name: "data", type: "bytes" },
                        { name: "nonce", type: "uint256" }
                    ]
                },
                {
                    to: await erc20Token.getAddress(),
                    value: 0,
                    data: encodedFunctionCall,
                    nonce: currentNonce + 1n 
                }
            );
            
            await expect(
                tokenAccount.connect(user1).executeCallWithSignature(
                    await erc20Token.getAddress(), 
                    0, 
                    encodedFunctionCall, 
                    wrongNonceSignature
                )
            ).to.be.revertedWith("Not executor approved");
        });
        
    })
});