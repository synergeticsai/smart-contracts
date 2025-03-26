# Synergetics Smart Contracts

This repository contains the smart contracts for Synergetics, implemented using Hardhat. The contracts adhere to various Ethereum standards, including ERC-6551, ERC-4337, ERC-20, ERC-721, and ERC-5169.

## Overview

The Synergetics BOT ecosystem is designed to tokenize all ownable entities, ensuring each has a representation on the EVM blockchain. Every BOT is represented as a unique Non-Fungible Token (NFT) with a dynamically assigned unique ID upon creation. These BOT NFTs follow the ERC-6551 standard and include a Token Bound Account (TBA).

### Token Bound Account (TBA)

- **Implementation**: ERC-4337
- **Features**: Account Abstraction (AA) enables advanced functionalities such as multisignature authentication, gasless transactions, automated payments, and other programmable operations.

## Features

BOTS within the Synergetics ecosystem can hold various types of assets within their TBAs. These assets include:

- **NFTs for Data Access**: Granting BOTs access to specific data sources.
- **ERC-5169 NFTs**: These NFTs provide scripts, enabling BOTs to execute predefined methods and actions.

## Repository Setup & Commands

Before running any Hardhat commands, ensure dependencies are installed:

```bash
npm install
```

### Environment Variables

Before testing, verifying, or deploying contracts, set up the `.env` file with the following variables:

```env
PRIVATE_KEY=<your_private_key>
ETHERSCAN_API_KEY=<your_etherscan_api_key>
POLYSCAN_API_KEY=<your_polyscan_api_key>
INFURA_ID=<your_infura_project_id>
```

### Compile Contracts

```bash
npx hardhat compile
```

### Deploy Contracts

Deploy the contracts to a specific network using:

```bash
npx hardhat run --network <network_name> scripts/deploy.js
```

### Test Contracts

Run tests for the smart contracts:

```bash
npx hardhat test
```

### Test Coverage

Check the test coverage for the smart contracts using:

```bash
npx hardhat coverage
```

## Coverage Considerations

While extensive testing has been implemented, certain areas were not included in the coverage due to technical constraints:

1. **Smart Contract Wallet Interaction**: The `AgentRegistry` smart contract relies on interactions with smart contract wallets, making direct test coverage infeasible for these cases.
2. **Brain Smart Contract - SuperRole Conditionals**: Some test cases involving `superRole` were not feasible to include in the coverage due to their conditional nature.
3. **Bot Smart Contract - No Burn Functionality**: The `burn` function is intentionally omitted from the Bot smart contract. Burning a bot token would result in permanent loss of access, potentially locking funds inside the associated wallet. Since bot tokens represent access or ownership tied to wallet functionality, this design choice ensures token management does not result in asset loss.

## Architecture Diagram

![Synergetics BOT Ecosystem Diagram](/public/unifygpt-bot-diagram.png)

---

For more detailed information and technical documentation, please refer to the contract files and associated documentation.

## Additional Resources

- [Vitalik's post on account abstraction without Ethereum protocol changes](https://medium.com/infinitism/erc-4337-account-abstraction-without-ethereum-protocol-changes-d75c9d94dc4a)
- [Bundler Reference Implementation](https://github.com/eth-infinitism/bundler)
- [Bundler Specification Test Suite](https://github.com/eth-infinitism/bundler-spec-tests)

