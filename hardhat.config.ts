import { HardhatUserConfig } from 'hardhat/config';
import "@nomicfoundation/hardhat-toolbox";

import { config as dotenvConfig } from 'dotenv';
dotenvConfig(); // Load environment variables from .env file

const privateKey = process.env.PRIVATE_KEY || '';
const etherscanAPIKey = process.env.ETHERSCAN_API_KEY || '';
const polyScanApiKey = process.env.POLYSCAN_API_KEY || '';

// Check if INFURA_ID is set as well
if (!process.env.INFURA_ID) {
  throw new Error('INFURA_ID environment variable is not set.');
}

function getNetwork(name: string): { url: string, gasPrice: number, accounts: [string] } {
  const url = `https://${name}.infura.io/v3/${process.env.INFURA_ID}`;
  return {
    url,
    gasPrice: 35000000000,
    accounts: [privateKey],
  };
}

const optimizedCompilerSettings = {
  version: '0.8.17', // Use the desired compiler version
  settings: {
    optimizer: { enabled: true, runs: 1000000 },
  },
};

const config: HardhatUserConfig = {
  solidity: {
    compilers: [optimizedCompilerSettings], // Use the compiler settings for all contracts
    overrides: {
      // Add specific overrides for contracts
      'contracts/core/EntryPoint.sol': optimizedCompilerSettings,
      'contracts/samples/SimpleAccount.sol': optimizedCompilerSettings,
    },
  },
  // defaultNetwork: 'dev',
  networks: {
    dev: {
      url: 'http://localhost:8545',
    },
    mumbai: getNetwork('polygon-mumbai'),
    amoy: getNetwork('polygon-amoy'),
    polygon: getNetwork('polygon-mainnet'),
    sepolia: getNetwork('sepolia')
  },
  etherscan: {
    apiKey: {
      polygon: polyScanApiKey,
      amoy: polyScanApiKey,
      sepolia: etherscanAPIKey
    },
    customChains: [
      {
        network: "amoy",
        chainId: 80002,
        urls: {
          apiURL: "https://api-amoy.polygonscan.com/api",
          browserURL: "https://amoy.polygonscan.com/"
        }
      }
    ]
  },
  mocha: {
    timeout: 10000,
  },
};

export default config;