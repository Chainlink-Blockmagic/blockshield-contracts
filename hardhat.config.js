require("@nomicfoundation/hardhat-toolbox");
require("solidity-coverage");

/** @type import('hardhat/config').HardhatUserConfig */

module.exports = {
  solidity: "0.8.24",
  networks: {
    hardhat: {
      accounts: Array(10).fill().map(() => ({
        privateKey: '0x' + [...Array(64)].map(() => Math.floor(Math.random() * 16).toString(16)).join(''), // Generate random private key
        balance: '100000000000000000000000000', // 1 million ETH in Wei
      }))
    }
  },
  settings: {
    optimizer: {
      enabled: true,
      runs: 1
    }
  }
};
