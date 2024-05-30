const { keccak256, toUtf8Bytes, parseEther } = require("ethers");

module.exports = [
  "Precatorio 2024",
  "PRECATORIO2024",
  "0xC2aaBfafAE71C70658b80d4d51110756c2909083",
  "0x42b3d3A9Bc1fD6b74E64151C16e3bEbc11Dab8e3",
  parseEther("0.05"), // 5% prime 50000000000000000
  "0xC22a79eBA640940ABB6dF0f7982cc119578E11De", // Polygon Amoy Router
  keccak256(toUtf8Bytes("0x66756e2d706f6c79676f6e2d616d6f792d310000000000000000000000000000")), // Polygon Amoy Router
  3000000,
  264
];