const { parseEther, parseUnits } = require("ethers");
const fs = require("fs");

const contracts = {
  VAULT: "Vault",
  TOKEN_RWA: "TokenRWA"
};

const NOW_IN_SECS = new Date().getTime() / 1000;
const ONE_HOUR_IN_SECS = 60 * 60;

const DEPLOY_CONFIG = {
  sepolia: {
    tokenTransferAddress: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
    linkAddress: "0x779877A7B0D9E8603169DdbD7836e478b4624789",
    routerCCIP: "0x0BF3dE8c5D3e8A2B34D2BEeB17ABfCeBaf363A59",
  }
};
const TokenRWA = {
  name: "Token FIT 08",
  symbol: "FIT08",
  totalSupply: parseEther("10000"),
  totalValue: parseEther("100"),
  yield: parseEther("0.15"), // 15% yield
  dueDate: parseUnits(parseInt(NOW_IN_SECS + ONE_HOUR_IN_SECS).toString(), 0),
  transferPaymentToken: DEPLOY_CONFIG[hre.network.name].tokenTransferAddress
}

async function main() {
  console.log("#################################################");
  console.log(`###        Using network: ${hre.network.name}   RPC: ${hre.network.config.url}      ###`);
  console.log("#################################################");
  logAddress({ key: "###", address: hre.network.name });

  const vaultContractAddress = await deployVault();

  const tokenRWAContractAddress = await deployTokenRWA();
  const tokenRWAContract = await ethers.getContractAt(contracts.TOKEN_RWA, tokenRWAContractAddress);
  const tx_grantAdmin = await tokenRWAContract.grantAdminRole(vaultContractAddress);
  await tx_grantAdmin.wait();

  const [signer] = await ethers.getSigners();
  console.log(`Signer: ${signer.address}`);

  await sendLinkToTokenInsurance({ 
    signer, 
    addressToFund: TOKEN_INSURANCE_ADDRESS,
    linkAddress: DEPLOY_CONFIG[hre.network.name].linkAddress
  });

  
  console.log("#################################################");
  console.log("###         All contracts deployed!           ###");
  console.log("### Check 👉 .env file for contract addresses ###");
  console.log("#################################################");
  console.log();
};

const deployTokenRWA = async () => {
  console.log(" --- Deploying TokenRWA contract --- ", TokenRWA);
  const tokenRWAContract = await hre.ethers.deployContract(
    contracts.TOKEN_RWA, 
    [
      TokenRWA.name, 
      TokenRWA.symbol, 
      TokenRWA.totalSupply, 
      TokenRWA.totalValue, 
      TokenRWA.dueDate, 
      TokenRWA.yield, 
      TokenRWA.transferPaymentToken
    ]);
  await tokenRWAContract.waitForDeployment();
  const tokenRWAContractAddress = tokenRWAContract.target;
  console.log(`TokenRWA address: ${tokenRWAContractAddress}`);
  logAddress({ key: "TOKEN_RWA_ADDRESS", address: tokenRWAContractAddress });
  return tokenRWAContractAddress;
};

const deployVault = async () => {
  // Deploy payment tokens and add them into token exchange contract
  console.log(" --- Deploying Vault contract --- ");
  const vaultContract = await hre.ethers.deployContract(
    contracts.VAULT, 
    [
      DEPLOY_CONFIG[hre.network.name].routerCCIP
    ]);
  await vaultContract.waitForDeployment();
  const vaultContractAddress = vaultContract.target;
  console.log(`Vault address: ${vaultContractAddress}`);
  logAddress({ key: "VAULT_ADDRESS", address: vaultContractAddress });
  return vaultContractAddress;
};

const sendLinkToTokenInsurance = async ({ signer, addressToFund, linkAddress }) => {
  const LINK_ADDRESS = linkAddress;
  const linkContract = new ethers.Contract(LINK_ADDRESS, linkAbi, signer);
  // Send LINK tokens to TokenInsurance 
  console.log(" --- Sending 1 LINK to TokenInsurance --- ");
  const tx = await linkContract.transfer(addressToFund, parseEther("1"));
  await tx.wait();

  const tokenInsuranceBalance = await linkContract.balanceOf(addressToFund);
  console.log(`TokenInsurance balance: ${formatEther(tokenInsuranceBalance)} LINK`);

  console.log(" --- Check LINK balance of signer --- ");
  const signerBalance = await linkContract.balanceOf(signer.address);
  console.log(`Signer balance: ${formatEther(signerBalance)} LINK`);
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