const { assert, parseEther } = require("ethers");
const fs = require("fs");

const contracts = {
  VAULT: "Vault",
  TOKEN_RWA: "TokenRWA",
  TOKEN_INSURANCE: "TokenInsurance",
  TOKEN_FACTORY: "TokenFactory"
};

async function main() {
  await deployTokenFactory();
  await deployVault();
  console.log("#################################################");
  console.log("###         All contracts deployed!           ###");
  console.log("### Check 👉 .env file for contract addresses ###");
  console.log("#################################################");
  console.log();
};

const deployTokenFactory = async () => {
  console.log(` --- Deploying TOKEN FACTORY with the account --- `);
  const tokenFactoryContract = await hre.ethers.deployContract(contracts.TOKEN_FACTORY);
  await tokenFactoryContract.waitForDeployment();
  console.log(`Token factory address: ${tokenFactoryContract.target}`);
  logAddress({ key: "TOKEN_FACTORY_ADDRESS", address: tokenFactoryContract.target });
  return tokenFactoryContract.target;
};

const deployVault = async () => {
  // Deploy payment tokens and add them into token exchange contract
  console.log(" --- Deploying Vault contract --- ");
  const vaultContract = await hre.ethers.deployContract(contracts.VAULT);
  await vaultContract.waitForDeployment();
  const vaultContractAddress = vaultContract.target;
  console.log(`Vault address: ${vaultContractAddress}`);
  logAddress({ key: "VAULT_ADDRESS", address: vaultContractAddress });
  return vaultContractAddress;
};

const logAddress = ({ key, address }) => {
  fs.appendFileSync(`.env`, `${key}=${address}\n`);
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });