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

    describe("BOT NFT", async () => {
        it('should execute call with signature from BOT NFT TBA', async () => {
            const { erc6551Registry, botAccount, botNFT, erc20Token, chainId, deployer, admin, minter, user1, user2 } = await loadFixture(deployContracts)

            const botExecutor = createExecutors()[0]
            const botExecutorAddress = botExecutor.address

            let uri = "QmZPBffLwhKYSseJzpGGXLuKg5RkZZp4PxjfoKy1hjQ5jR"
            await botNFT.connect(minter).safeMint(user1.address, uri, botExecutorAddress)
            expect(await botNFT.balanceOf(user1.address)).to.equal("1")
            expect(await botNFT.ownerOf("0")).to.equal(user1.address)

            const tokenAccountAddress = await getBotWallet(botNFT, botExecutorAddress);
            expect(tokenAccountAddress).to.not.be.undefined;

            //sending Eth to token account  
            await deployer.sendTransaction({
                to: tokenAccountAddress,
                value: parseEther("1.0")
            });

            const tokenAccount = await ethers.getContractAt("BotAccount", tokenAccountAddress);

            expect(await tokenAccount.botExecutor()).to.equal(botExecutorAddress)

            await erc20Token.transfer(tokenAccountAddress, parseEther("10"))

            let encodedFunctionCall = erc20Token.interface.encodeFunctionData('transfer', [user1.address, parseEther("5.0")])

            const payload = ethers.solidityPackedKeccak256(
                ['uint256', 'address', 'uint256', 'bytes'],
                [await tokenAccount.nonce(), await erc20Token.getAddress(), "0", encodedFunctionCall]
            );
            const signature = await botExecutor.signMessage(ethers.getBytes(payload));
            const recoveredAddress = ethers.verifyMessage(ethers.getBytes(payload), signature);

            expect(recoveredAddress).to.equal(botExecutor.address)
            expect(await tokenAccount.isValidSignature(payload, signature)).to.equal("0x1626ba7e")
            await tokenAccount.connect(user1).executeCallWithSignature(await erc20Token.getAddress(), "0", encodedFunctionCall, signature)
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
            const { erc6551Registry, botAccount, botNFT, erc20Token, chainId, deployer, admin, minter, user1, user2 } = await loadFixture(deployContracts)

            const botExecutors = createExecutors(2)
            const botExecutorsList = botExecutors.map(executor => executor.address)

            let uriList = ["QmZPBffLwhKYSseJzpGGXLuKg5RkZZp4PxjfoKy1hjQ5jR", "QmZPBffLwhKYSseJzpGGXLuKg5RkZZp4PxjfoKy1hjasdfasdf"]

            await botNFT.connect(minter).batchSafeMint([user1.address, user2.address], uriList, botExecutorsList)
            expect(await botNFT.balanceOf(user1.address)).to.equal("1")
            expect(await botNFT.ownerOf("0")).to.equal(user1.address)

            const tokenAccountAddress1 = await getBotWallet(botNFT, botExecutorsList[0])
            const tokenAccountAddress2 = await getBotWallet(botNFT, botExecutorsList[1])

            const tokenAccount1 = await ethers.getContractAt("BotAccount", tokenAccountAddress1);

            expect(await tokenAccount1.botExecutor()).to.equal(botExecutorsList[0])

            await erc20Token.transfer(tokenAccountAddress1, parseEther("10"))

            let encodedFunctionCall = erc20Token.interface.encodeFunctionData('transfer', [user1.address, parseEther("5.0")])

            const payload = ethers.solidityPackedKeccak256(
                ['uint256', 'address', 'uint256', 'bytes'],
                [await tokenAccount1.nonce(), await erc20Token.getAddress(), "0", encodedFunctionCall]
            );
            const signature = await botExecutors[0].signMessage(ethers.getBytes(payload));
            const recoveredAddress = ethers.verifyMessage(ethers.getBytes(payload), signature);

            expect(recoveredAddress).to.equal(botExecutorsList[0])
            expect(await tokenAccount1.isValidSignature(payload, signature)).to.equal("0x1626ba7e")
            await tokenAccount1.connect(user1).executeCallWithSignature(await erc20Token.getAddress(), "0", encodedFunctionCall, signature)
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
        
        it("Should execute call with valid signature", async () => {
            const { botAccount, botNFT, erc6551Registry, deployer, minter, user1 } = await loadFixture(deployContracts);
            
            // Mint an NFT and create TBA
            const executor = deployer.address;
            await botNFT.connect(minter).safeMint(user1.address, "ipfs://uri", executor);
            const tokenAccountAddress = await getBotWallet(botNFT, executor);
            const tokenAccount = await ethers.getContractAt("BotAccount", tokenAccountAddress);
            
            const payload = ethers.solidityPackedKeccak256(
                ["uint256", "address", "uint256", "bytes"],
                [await tokenAccount.nonce(), user1.address, 0, "0x"]
            );
            
            const signature = await deployer.signMessage(ethers.getBytes(payload));
            
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
            
            // 3. Test with signature from owner (user1) - should pass
            const validSignature1 = await user1.signMessage(ethers.getBytes(messageHash));
            expect(await tokenAccount.isValidSignature.staticCall(messageHash, validSignature1)).to.equal("0x1626ba7e");
            
            // 4. Test with signature from executor (deployer) - should pass
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
            const { botNFT, minter, user1, erc20Token, deployer } = await loadFixture(deployContracts);
            
            await botNFT.connect(minter).safeMint(user1.address, "ipfs://uri", deployer.address);
            const tokenAccountAddress = await getBotWallet(botNFT, deployer.address);
            const tokenAccount = await ethers.getContractAt("BotAccount", tokenAccountAddress);
            
            await erc20Token.transfer(tokenAccountAddress, parseEther("10"));
            
            const encodedFunctionCall = erc20Token.interface.encodeFunctionData(
                'transfer', 
                [user1.address, parseEther("5.0")]
            );
            
            const payload = ethers.solidityPackedKeccak256(
                ['uint256', 'address', 'uint256', 'bytes'],
                [await tokenAccount.nonce(), await erc20Token.getAddress(), "0", encodedFunctionCall]
            );
            const signature = await deployer.signMessage(ethers.getBytes(payload));
            
            // First execution should succeed
            await tokenAccount.connect(user1).executeCallWithSignature(
                await erc20Token.getAddress(), 
                "0", 
                encodedFunctionCall, 
                signature
            );
            
            // Second execution with same signature should fail
            await expect(
                tokenAccount.connect(user1).executeCallWithSignature(
                    await erc20Token.getAddress(), 
                    "0", 
                    encodedFunctionCall, 
                    signature
                )
            ).to.be.revertedWith("Not executor approved");
        });
    })

});