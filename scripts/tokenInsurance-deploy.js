const fs = require("fs");
const { ethers } = require("hardhat");

const contracts = {
  TOKEN_INSURANCE: "TokenInsurance",
};

const DEPLOY_SETTINGS = {
  amoy: {
    ROUTER_FUNCTIONS_ADDRESS: "0xC22a79eBA640940ABB6dF0f7982cc119578E11De",
    ROUTER_CCIP_ADDRESS: "0x9C32fCB86BF0f4a1A8921a9Fe46de3198bb884B2",
    AGGREGATOR_NETWORK_ADDRESS: "0x1b8739bB4CdF0089d07097A9Ae5Bd274b29C6F16"
  },
  hardhat: {
    ROUTER_FUNCTIONS_ADDRESS: "0x0000000000000000000000000000000000000001",
    ROUTER_CCIP_ADDRESS: "0x0000000000000000000000000000000000000001",
    AGGREGATOR_NETWORK_ADDRESS: "0x0000000000000000000000000000000000000001"
  }
}
const [
  INSURANCE_NAME,
  INSURANCE_SYMBOL,
  INSURANCE_PRIME
] = [
  "Token FIT 08",
  "blockshield.FIT08",
  "50000000000000000"
];
async function main() {

  if (!INSURANCE_NAME)
    throw new Error(`INSURANCE_NAME not provided. Send it by command line yarn tokenInsurance-deploy:<network> <NAME> <SYMBOL> <PRIME>`);
  if (!INSURANCE_SYMBOL)
    throw new Error(`INSURANCE_SYMBOL not provided. Send it by command line yarn tokenInsurance-deploy:<network> <NAME> <SYMBOL> <PRIME>`);
  if (!INSURANCE_SYMBOL.startsWith("blockshield."))
    throw new Error(`INSURANCE_SYMBOL not valid. It should start with "blockshield."`);
  if (!INSURANCE_PRIME)
    throw new Error(`INSURANCE_PRIME not provided. Send it by command line yarn tokenInsurance-deploy:<network> <NAME> <SYMBOL> <PRIME>`);

  console.log("#################################################");
  console.log(`###        Using network: ${hre.network.name}         ###`);
  console.log("#################################################");
  logAddress({ key: "###", address: hre.network.name });

  await deployTokenInsurance();

  console.log("#################################################");
  console.log("###         All contracts deployed!           ###");
  console.log("### Check 👉 .env file for contract addresses ###");
  console.log("#################################################");
  console.log();
};

const deployTokenInsurance = async () => {
  // Deploy payment tokens and add them into token exchange contract
  console.log(" --- Deploying TokenInsurance contract --- ");
  const networkDetails = DEPLOY_SETTINGS[hre.network.name];
  console.log("INSURANCE_NAME", INSURANCE_NAME)
  const insurance = {
    name: INSURANCE_NAME,
    symbol: INSURANCE_SYMBOL,
    prime: INSURANCE_PRIME,
    routerFunctions: networkDetails.ROUTER_FUNCTIONS_ADDRESS,
    routerCCIP: networkDetails.ROUTER_CCIP_ADDRESS,
    aggregatorNetwork: networkDetails.AGGREGATOR_NETWORK_ADDRESS
  }

  console.log("insurance", insurance)
  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Account balance: ${ethers.formatEther(balance)} ETH`);
  if (balance.lt(ethers.parseEther("0.2"))) { // Ensure a comfortable buffer
    throw new Error("Insufficient funds for gas * price + value");
  }
  const tokenInsuranceContract = await hre.ethers.deployContract(
    contracts.TOKEN_INSURANCE,
    [
      insurance.name,
      insurance.symbol,
      insurance.prime,
      insurance.routerFunctions,
      insurance.routerCCIP,
      insurance.aggregatorNetwork
    ],
    {
      gasLimit: 3000000
    }
  );
  await tokenInsuranceContract.waitForDeployment();
  const tokenInsuranceContractAddress = tokenInsuranceContract.target;
  console.log(`TokenInsurance address: ${tokenInsuranceContractAddress}`);
  logAddress({ key: "TOKEN_INSURANCE_ADDRESS", address: tokenInsuranceContractAddress });
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