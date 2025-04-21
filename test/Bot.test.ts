import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { ethers, upgrades } from "hardhat";
import { parseEther, formatEther } from 'ethers'
import { expect } from "chai";
import {
    ERC6551Registry,
    BotAccount,
    ERC20Token,
    Bot,
    ERC20Token__factory,
    ERC6551Registry__factory,
    BotAccount__factory,
    Bot__factory
} from "../typechain-types";
import { erc6551 } from "../typechain-types/contracts";

describe("Bot Contract - Deployment & Initialization", () => {
    
    async function deployContracts() {
        const [deployer, admin, minter, user, otherUser] = await ethers.getSigners();
        
        const erc6551Registry: ERC6551Registry = await new ERC6551Registry__factory(deployer).deploy();
        await erc6551Registry.waitForDeployment(); 
        const erc20Token: ERC20Token = await new ERC20Token__factory(deployer).deploy()

        const botAccountFactory = await ethers.getContractFactory("BotAccount", deployer);
        const botAccount = await upgrades.deployProxy(
            botAccountFactory, 
            [deployer.address], 
            { initializer: "initialize" }
        );
        await botAccount.waitForDeployment();

        if (!erc6551Registry.target || !botAccount.target) {
            throw new Error("Deployment failed: ERC6551Registry or BotAccount address is null.");
        }

        const botNFT: Bot = await new Bot__factory(deployer).deploy(
            admin.address,
            minter.address,
            erc6551Registry.target, 
            botAccount.target
        );
        await botNFT.waitForDeployment(); 
        await erc6551Registry.connect(deployer).setBotContract(botNFT.target);
        return { erc20Token, botAccountFactory, botNFT, botAccount, erc6551Registry, deployer, admin, minter, user, otherUser };
    }

    it("Should deploy the contract with correct initial parameters", async () => {
        const { botNFT, admin, minter, erc6551Registry, botAccount } = await loadFixture(deployContracts);
        
        expect(await botNFT.admin()).to.equal(admin.address);
        expect(await botNFT.minter()).to.equal(minter.address);
        expect(await botNFT.erc6551Registry()).to.equal(erc6551Registry.target);
        expect(await botNFT.erc6551Account()).to.equal(botAccount.target);
    });

    it("Should set the correct admin and minter addresses", async () => {
        const { botNFT, admin, minter } = await loadFixture(deployContracts);
        
        expect(await botNFT.admin()).to.equal(admin.address);
        expect(await botNFT.minter()).to.equal(minter.address);
    });

    it("Should set the correct ERC6551Registry and ERC6551Account addresses", async () => {
        const { botNFT, erc6551Registry, botAccount } = await loadFixture(deployContracts);
        
        expect(await botNFT.erc6551Registry()).to.equal(erc6551Registry.target);
        expect(await botNFT.erc6551Account()).to.equal(botAccount.target);
    });
    
    it("Should initialize creationSalt correctly", async () => {
        const { botNFT } = await loadFixture(deployContracts);
        
        const creationSalt = await botNFT.creationSalt();
        expect(creationSalt).to.not.equal(0);
        expect(creationSalt).to.be.a("bigint"); 
    });

    it("should return the correct deterministic ERC6551 account address", async () => {
        const { erc6551Registry, botAccount, botNFT } = await loadFixture(deployContracts);
        
        const tokenId = 1;
        const salt = 12345;
        const chainId = (await ethers.provider.getNetwork()).chainId;
        const tokenContract = botNFT.target;
        const implementation = botAccount.target;
    
        // Use ERC6551Registry's address as the deployer in Create2
        const deployerAddress = erc6551Registry.target; 
    
        // Compute expected account address
        const creationCode = ethers.solidityPacked(
            ["bytes", "address", "bytes", "bytes"],
            [
                "0x3d60ad80600a3d3981f3363d3d373d3d3d363d73",
                implementation,
                "0x5af43d82803e903d91602b57fd5bf3",
                ethers.AbiCoder.defaultAbiCoder().encode(
                    ["uint256", "uint256", "address", "uint256"],
                    [salt, chainId, tokenContract, tokenId]
                )
            ]
        );
    
        const bytecodeHash = ethers.keccak256(creationCode);
        const expectedAddress = ethers.getCreate2Address(
            deployerAddress,
            ethers.toBeHex(salt, 32),
            bytecodeHash
        );
    
        // Call the function
        const computedAddress = await erc6551Registry.account(
            implementation,
            chainId,
            tokenContract,
            tokenId,
            salt
        );
    
        expect(computedAddress).to.equal(expectedAddress);
    });

    describe("Access Control", () => {
        it("Should allow only the admin to pause the contract", async () => {
            const { botNFT, admin } = await loadFixture(deployContracts);
    
            await expect(botNFT.connect(admin).pause()).to.not.be.reverted;
            expect(await botNFT.paused()).to.equal(true);
        });
    
        it("Should revert if contract is already paused", async () => {
            const { botNFT, admin } = await loadFixture(deployContracts);
    
            await botNFT.connect(admin).pause();
            await expect(botNFT.connect(admin).pause()).to.be.revertedWith("Pausable: paused");
        });
    
        it("Should allow only the admin to unpause the contract", async () => {
            const { botNFT, admin } = await loadFixture(deployContracts);
    
            await botNFT.connect(admin).pause();
            await expect(botNFT.connect(admin).unpause()).to.not.be.reverted;
            expect(await botNFT.paused()).to.equal(false);
        });
    
        it("Should revert if trying to unpause when not paused", async () => {
            const { botNFT, admin } = await loadFixture(deployContracts);
    
            await expect(botNFT.connect(admin).unpause()).to.be.revertedWith("Pausable: not paused");
        });
    
        it("Should allow only the admin to set a new minter", async () => {
            const { botNFT, admin, deployer } = await loadFixture(deployContracts);
    
            await expect(botNFT.connect(admin).setMinter(deployer.address)).to.not.be.reverted;
            expect(await botNFT.minter()).to.equal(deployer.address);
        });
    
        it("Should revert if setting minter to the same address", async () => {
            const { botNFT, admin, minter } = await loadFixture(deployContracts);
    
            await expect(botNFT.connect(admin).setMinter(minter.address)).to.be.revertedWith("Bot: already minter");
        });
    
        it("Should allow only the admin to set a new ERC6551Registry", async () => {
            const { botNFT, admin, deployer } = await loadFixture(deployContracts);
    
            await expect(botNFT.connect(admin).setERC6551Registry(deployer.address)).to.not.be.reverted;
            expect(await botNFT.erc6551Registry()).to.equal(deployer.address);
        });
    
        it("Should allow only the admin to set a new ERC6551Account", async () => {
            const { botNFT, admin, deployer } = await loadFixture(deployContracts);
    
            await expect(botNFT.connect(admin).setERC6551Account(deployer.address)).to.not.be.reverted;
            expect(await botNFT.erc6551Account()).to.equal(deployer.address);
        });
    
        it("Should revert if a non-admin tries to pause the contract", async () => {
            const { botNFT, minter } = await loadFixture(deployContracts);
    
            await expect(botNFT.connect(minter).pause()).to.be.revertedWith("Bot: only admin");
        });
    
        it("Should revert if a non-admin tries to unpause the contract", async () => {
            const { botNFT, admin, minter } = await loadFixture(deployContracts);
    
            await botNFT.connect(admin).pause();
            await expect(botNFT.connect(minter).unpause()).to.be.revertedWith("Bot: only admin");
        });
    
        it("Should revert if a non-admin tries to set a new minter", async () => {
            const { botNFT, minter, deployer } = await loadFixture(deployContracts);
    
            await expect(botNFT.connect(minter).setMinter(deployer.address)).to.be.revertedWith("Bot: only admin");
        });
    
        it("Should revert if a non-admin tries to set a new ERC6551Registry", async () => {
            const { botNFT, minter, deployer } = await loadFixture(deployContracts);
    
            await expect(botNFT.connect(minter).setERC6551Registry(deployer.address)).to.be.revertedWith("Bot: only admin");
        });
    
        it("Should revert if a non-admin tries to set a new ERC6551Account", async () => {
            const { botNFT, minter, deployer } = await loadFixture(deployContracts);
    
            await expect(botNFT.connect(minter).setERC6551Account(deployer.address)).to.be.revertedWith("Bot: only admin");
        });
    
        it("Should revert if a non-minter (other than admin) tries to mint a token", async () => {
            const { botNFT, deployer, admin } = await loadFixture(deployContracts);
        
            // Ensure safeMint function exists
            expect(botNFT.safeMint).to.not.be.undefined;
        
            // Try minting with an unauthorized account
            await expect(
                botNFT.connect(deployer).safeMint(deployer.address, "ipfs://dummyURI", deployer.address)
            ).to.be.revertedWith("Bot: only minter");
        });
    });   
    
    describe("Minting", () => {
        it("Should mint a token successfully", async () => {
            const { botNFT, admin, user } = await loadFixture(deployContracts);
    
            await expect(botNFT.connect(admin).safeMint(user.address, "ipfs://dummyURI", user.address))
                .to.emit(botNFT, "BotMinted");
        });
    
        it("Should only allow the minter or admin to mint", async () => {
            const { botNFT, minter, user, deployer } = await loadFixture(deployContracts);
    
            // Minter can mint
            await expect(botNFT.connect(minter).safeMint(user.address, "ipfs://dummyURI", user.address))
                .to.emit(botNFT, "BotMinted");
    
            // Non-minter (deployer) should fail
            await expect(botNFT.connect(deployer).safeMint(user.address, "ipfs://dummyURI", user.address))
                .to.be.revertedWith("Bot: only minter");
        });
    
        it("Should correctly assign the token to the recipient", async () => {
            const { botNFT, admin, user } = await loadFixture(deployContracts);
    
            await botNFT.connect(admin).safeMint(user.address, "ipfs://dummyURI", user.address);
    
            expect(await botNFT.ownerOf(0)).to.equal(user.address);
        });
    
        it("Should emit a BotMinted event upon successful minting", async () => {
            const { botNFT, admin, user } = await loadFixture(deployContracts);
    
            await expect(botNFT.connect(admin).safeMint(user.address, "ipfs://dummyURI", user.address))
                .to.emit(botNFT, "BotMinted")
                .withArgs(0, anyValue, user.address);
        });
    
        it("Should set the correct token URI", async () => {
            const { botNFT, admin, user } = await loadFixture(deployContracts);
    
            await botNFT.connect(admin).safeMint(user.address, "dummyURI", user.address);
    
            expect(await botNFT.tokenURI(0)).to.equal("ipfs://dummyURI");
        });
    
        it("Should revert if minting is attempted when the contract is paused", async () => {
            const { botNFT, admin, user } = await loadFixture(deployContracts);
    
            await botNFT.connect(admin).pause();
    
            expect(await botNFT.paused()).to.be.true;
    
            await expect(
                botNFT.connect(admin).safeMint(user.address, "ipfs://dummyURI", user.address)
            ).to.be.revertedWith("Pausable: paused");
        });
    
        it("Should revert if trying to mint to a zero address", async () => {
            const { botNFT, admin } = await loadFixture(deployContracts);
    
            await expect(
                botNFT.connect(admin).safeMint(ethers.ZeroAddress, "ipfs://dummyURI", admin.address)
            ).to.be.revertedWith("ERC721: mint to the zero address");
        });
    
        it("Should revert if trying to mint with an empty token URI", async () => {
            const { botNFT, admin, user } = await loadFixture(deployContracts);
    
            await expect(
                botNFT.connect(admin).safeMint(user.address, "", user.address)
            ).to.be.revertedWith("Bot: invalid URI");
        });
    
        it("Should revert if non-admin tries to set minter", async () => {
            const { botNFT, user } = await loadFixture(deployContracts);
        
            await expect(botNFT.connect(user).setMinter(user.address))
                .to.be.revertedWith("Bot: only admin");
        });
        
    });    

    describe("Batch Minting", function () {
        it("Should allow batch minting of multiple tokens", async () => {
            const { botNFT, admin, user, otherUser } = await loadFixture(deployContracts);
    
            const recipients = [user.address, otherUser.address];
            const uris = ["ipfs://token1", "ipfs://token2"];
            const executors = [user.address, otherUser.address];
    
            await expect(botNFT.connect(admin).batchSafeMint(recipients, uris, executors))
                .to.emit(botNFT, "BotMinted").withArgs(anyValue, anyValue, anyValue);
        });
    
        it("Should revert if batch minting is attempted by a non-minter", async () => {
            const { botNFT, user, otherUser } = await loadFixture(deployContracts);
    
            const recipients = [user.address, otherUser.address];
            const uris = ["ipfs://token1", "ipfs://token2"];
            const executors = [user.address, otherUser.address];
    
            await expect(botNFT.connect(user).batchSafeMint(recipients, uris, executors))
                .to.be.revertedWith("Bot: only minter");
        });
    
        it("Should revert if input arrays for batch minting are mismatched in length", async () => {
            const { botNFT, admin, user, otherUser } = await loadFixture(deployContracts);
    
            await expect(
                botNFT.connect(admin).batchSafeMint(
                    [user.address, otherUser.address], 
                    ["ipfs://token1"], // Mismatched URI length
                    [user.address, otherUser.address]
                )
            ).to.be.revertedWith("Mismatched input lengths");
        });
    
        it("Should revert if batch minting with empty recipient array", async () => {
            const { botNFT, admin } = await loadFixture(deployContracts);
    
            await expect(
                botNFT.connect(admin).batchSafeMint([], [], [])
            ).to.be.revertedWith("Bot: empty batch minting");
        });
        
    });
    
    describe("Token Transfer", function () {
        it("Should allow transferring a bot NFT between accounts", async () => {
            const { botNFT, admin, user, otherUser } = await loadFixture(deployContracts);
    
            await botNFT.connect(admin).safeMint(user.address, "ipfs://dummyURI", user.address);
    
            await expect(botNFT.connect(user).transferFrom(user.address, otherUser.address, 0))
                .to.emit(botNFT, "Transfer")
                .withArgs(user.address, otherUser.address, 0);
    
            expect(await botNFT.ownerOf(0)).to.equal(otherUser.address);
        });
    
        it("Should revert if transferring to zero address", async () => {
            const { botNFT, admin, user } = await loadFixture(deployContracts);
    
            await botNFT.connect(admin).safeMint(user.address, "ipfs://dummyURI", user.address);
    
            await expect(
                botNFT.connect(user).transferFrom(user.address, ethers.ZeroAddress, 0)
            ).to.be.revertedWith("ERC721: transfer to the zero address");
        });
    
        it("Should allow approved addresses to transfer a token", async () => {
            const { botNFT, admin, user, otherUser } = await loadFixture(deployContracts);
    
            await botNFT.connect(admin).safeMint(user.address, "ipfs://dummyURI", user.address);
            await botNFT.connect(user).approve(otherUser.address, 0);
    
            await expect(botNFT.connect(otherUser).transferFrom(user.address, otherUser.address, 0))
                .to.emit(botNFT, "Transfer")
                .withArgs(user.address, otherUser.address, 0);
    
            expect(await botNFT.ownerOf(0)).to.equal(otherUser.address);
        });
    
        it("Should clear approval after transfer", async () => {
            const { botNFT, admin, user, otherUser } = await loadFixture(deployContracts);
    
            await botNFT.connect(admin).safeMint(user.address, "ipfs://dummyURI", user.address);
            await botNFT.connect(user).approve(otherUser.address, 0);
            await botNFT.connect(otherUser).transferFrom(user.address, otherUser.address, 0);
    
            expect(await botNFT.getApproved(0)).to.equal(ethers.ZeroAddress);
        });
    
        it("Should allow operator to transfer a token with setApprovalForAll", async () => {
            const { botNFT, admin, user, otherUser } = await loadFixture(deployContracts);
    
            await botNFT.connect(admin).safeMint(user.address, "ipfs://dummyURI", user.address);
            await botNFT.connect(user).setApprovalForAll(otherUser.address, true);
    
            await expect(botNFT.connect(otherUser).transferFrom(user.address, otherUser.address, 0))
                .to.emit(botNFT, "Transfer")
                .withArgs(user.address, otherUser.address, 0);
    
            expect(await botNFT.ownerOf(0)).to.equal(otherUser.address);
        });
    
        it("Should revert if operator tries to transfer after approval is revoked", async () => {
            const { botNFT, admin, user, otherUser } = await loadFixture(deployContracts);
    
            await botNFT.connect(admin).safeMint(user.address, "ipfs://dummyURI", user.address);
            await botNFT.connect(user).setApprovalForAll(otherUser.address, true);
            await botNFT.connect(user).setApprovalForAll(otherUser.address, false);
    
            await expect(
                botNFT.connect(otherUser).transferFrom(user.address, otherUser.address, 0)
            ).to.be.revertedWith("ERC721: caller is not token owner or approved");
        });
    
        it("Should revert if transferring a non-owned token", async () => {
            const { botNFT, admin, user, otherUser } = await loadFixture(deployContracts);
    
            await botNFT.connect(admin).safeMint(user.address, "ipfs://dummyURI", user.address);
    
            await expect(
                botNFT.connect(otherUser).transferFrom(user.address, otherUser.address, 0)
            ).to.be.revertedWith("ERC721: caller is not token owner or approved");
        });
    
        it("Should revert if transferring a non-existent token", async () => {
            const { botNFT, user, otherUser } = await loadFixture(deployContracts);
    
            await expect(
                botNFT.connect(user).transferFrom(user.address, otherUser.address, 999)
            ).to.be.revertedWith("ERC721: invalid token ID");
        });
    
        it("Should update the owner after transfer", async () => {
            const { botNFT, admin, user, otherUser } = await loadFixture(deployContracts);
    
            await botNFT.connect(admin).safeMint(user.address, "ipfs://dummyURI", user.address);
            await botNFT.connect(user).transferFrom(user.address, otherUser.address, 0);
    
            expect(await botNFT.ownerOf(0)).to.equal(otherUser.address);
        });

        it("Should revert if trying to transfer a token while paused", async () => {
            const { botNFT, admin, user, otherUser } = await loadFixture(deployContracts);
        
            await botNFT.connect(admin).safeMint(user.address, "ipfs://dummyURI", user.address);
            await botNFT.connect(admin).pause();
        
            await expect(botNFT.connect(user).transferFrom(user.address, otherUser.address, 0))
                .to.be.revertedWith("Pausable: paused");
        });
    });
    
    describe("ERC165 Interface Support", () => {
        it("Should correctly report supported interfaces", async () => {
            const { botNFT } = await loadFixture(deployContracts);
    
            // ERC165 interface ID
            const ERC165_INTERFACE_ID = "0x01ffc9a7";  
            expect(await botNFT.supportsInterface(ERC165_INTERFACE_ID)).to.be.true;
    
            // ERC721 interface ID
            const ERC721_INTERFACE_ID = "0x80ac58cd";  
            expect(await botNFT.supportsInterface(ERC721_INTERFACE_ID)).to.be.true;
    
            // ERC721Metadata interface ID
            const ERC721_METADATA_INTERFACE_ID = "0x5b5e139f";  
            expect(await botNFT.supportsInterface(ERC721_METADATA_INTERFACE_ID)).to.be.true;
    
            // ERC721Enumerable interface ID (if inherited)
            const ERC721_ENUMERABLE_INTERFACE_ID = "0x780e9d63";  
            expect(await botNFT.supportsInterface(ERC721_ENUMERABLE_INTERFACE_ID)).to.be.true;
    
            // Random unsupported interface
            const UNSUPPORTED_INTERFACE_ID = "0xffffffff";  
            expect(await botNFT.supportsInterface(UNSUPPORTED_INTERFACE_ID)).to.be.false;
        });

        it("Should return false for multiple invalid interface IDs", async () => {
            const { botNFT } = await loadFixture(deployContracts);
        
            const invalidInterfaces = [
                "0x12345678",
                "0xabcd1234",
                "0xabcdef01"
            ];
        
            for (const id of invalidInterfaces) {
                expect(await botNFT.supportsInterface(id)).to.be.false;
            }
        });

    });

});
