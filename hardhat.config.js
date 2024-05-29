require('dotenv').config();

require("@nomicfoundation/hardhat-toolbox");
require("solidity-coverage");

/** @type import('hardhat/config').HardhatUserConfig */
const {
  AMOY_RPC_URL,
  PROTOCOL_ADMIN_ACCOUNT_PRIVATE_KEY
} = process.env;

module.exports = {
  solidity: "0.8.24",
  networks: {
    hardhat: {
      accounts: Array(10).fill().map(() => ({
        privateKey: '0x' + [...Array(64)].map(() => Math.floor(Math.random() * 16).toString(16)).join(''), // Generate random private key
        balance: '100000000000000000000000000', // 1 million ETH in Wei
      })),
    },
    amoy: {
      url: AMOY_RPC_URL || '',
      accounts: PROTOCOL_ADMIN_ACCOUNT_PRIVATE_KEY ? [PROTOCOL_ADMIN_ACCOUNT_PRIVATE_KEY] : [],
      gasPrice: 100000000000,
      gasLimit: 30000000,
    },
  },
  settings: {
    optimizer: {
      enabled: true,
      runs: 200,
      details: {
        yul: true
      }
    },
    viaIR : false,
  },
  etherscan: {
    apiKey: process.env.POLYGONSCAN_API_KEY
  },
};
