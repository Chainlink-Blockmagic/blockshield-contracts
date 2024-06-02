require('dotenv').config();
// const hre = require("hardhat");
const { parseEther, formatEther } = require("ethers");

const contracts = {
  TOKEN_INSURANCE: "TokenInsurance"
};

const { TOKEN_INSURANCE_ADDRESS } = process.env;
const [,,TOKEN_RWA_ADDRESS, TOKEN_RWA_TOTAL_SUPPLY, TOKEN_RWA_TOTAL_VALUE, TOKEN_RWA_DUE_DATE, TOKEN_RWA_SYMBOL] = process.argv;

const SOURCE_CHAIN_CCIP_DETAILS = {
  amoy: {
    DESTINATION_CHAIN_SELECTOR: 16015286601757825753,
    LINK_ADDRESS: "0x0Fd9e8d3aF1aaee056EB9e802c3A762a667b1904",
    TOKEN_TRANSFER_ADDRESS: "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582"
  }
};

const linkAbi = [
  "function balanceOf(address) view returns (uint)",
  "function transfer(address,uint256) external returns (bool)"
];
async function main() {
  if (!TOKEN_INSURANCE_ADDRESS) {
    throw new Error("One or more addresses are not defined");
  }

  if (!TOKEN_RWA_ADDRESS)
    throw new Error(`TOKEN_RWA_ADDRESS not provided. Send it by command line yarn tokenInsurance-setup:<network> <TOKEN_RWA_ADDRESS> <TOKEN_RWA_TOTAL_SUPPLY> <TOKEN_RWA_TOTAL_VALUE> <TOKEN_RWA_DUE_DATE> <TOKEN_RWA_SYMBOL>`);
  if (!TOKEN_RWA_TOTAL_SUPPLY)
    throw new Error(`TOKEN_RWA_TOTAL_SUPPLY not provided. Send it by command line yarn tokenInsurance-setup:<network> <TOKEN_RWA_ADDRESS> <TOKEN_RWA_TOTAL_SUPPLY> <TOKEN_RWA_TOTAL_VALUE> <TOKEN_RWA_DUE_DATE> <TOKEN_RWA_SYMBOL>`);
  if (!TOKEN_RWA_TOTAL_VALUE)
    throw new Error(`TOKEN_RWA_TOTAL_VALUE not provided. Send it by command line yarn tokenInsurance-setup:<network> <TOKEN_RWA_ADDRESS> <TOKEN_RWA_TOTAL_SUPPLY> <TOKEN_RWA_TOTAL_VALUE> <TOKEN_RWA_DUE_DATE> <TOKEN_RWA_SYMBOL>`);
  if (!TOKEN_RWA_DUE_DATE)
    throw new Error(`TOKEN_RWA_DUE_DATE not provided. Send it by command line yarn tokenInsurance-setup:<network> <TOKEN_RWA_ADDRESS> <TOKEN_RWA_TOTAL_SUPPLY> <TOKEN_RWA_TOTAL_VALUE> <TOKEN_RWA_DUE_DATE> <TOKEN_RWA_SYMBOL>`);
  if (!TOKEN_RWA_SYMBOL)
    throw new Error(`TOKEN_RWA_SYMBOL not provided. Send it by command line yarn tokenInsurance-setup:<network> <TOKEN_RWA_ADDRESS> <TOKEN_RWA_TOTAL_SUPPLY> <TOKEN_RWA_TOTAL_VALUE> <TOKEN_RWA_DUE_DATE> <TOKEN_RWA_SYMBOL>`);

  console.log("#################################################");
  console.log(`###        Using network: ${hre.network.name}         ###`);
  console.log("#################################################");
  
  const [signer] = await ethers.getSigners();
  console.log(`Signer: ${signer.address}`);

  await sendLinkToTokenInsurance({ signer });

  const tokenInsuranceContract = await ethers.getContractAt(contracts.TOKEN_INSURANCE, TOKEN_INSURANCE_ADDRESS);

  const tx_setVault = await tokenInsuranceContract.setVault(TOKEN_INSURANCE_ADDRESS);
  await tx_setVault.wait();

  const tokenRWADetailsTuple = [TOKEN_RWA_ADDRESS, TOKEN_RWA_TOTAL_SUPPLY, TOKEN_RWA_TOTAL_VALUE, TOKEN_RWA_DUE_DATE, TOKEN_RWA_SYMBOL, true];
  const tx_updateTokenRWADetails = await tokenInsuranceContract.updateTokenRWADetails(tokenRWADetailsTuple);
  await tx_updateTokenRWADetails.wait();

  const ccipDetails = SOURCE_CHAIN_CCIP_DETAILS[hre.network.name];
  const tx_updateSenderCrossChainProperties = await tokenInsuranceContract.updateSenderCrossChainProperties(
    ccipDetails.DESTINATION_CHAIN_SELECTOR,
    ccipDetails.LINK_ADDRESS,
    ccipDetails.TOKEN_TRANSFER_ADDRESS
  );
  await tx_updateSenderCrossChainProperties.wait();
};

const sendLinkToTokenInsurance = async ({ signer}) => {
  const LINK_ADDRESS = SOURCE_CHAIN_CCIP_DETAILS[hre.network.name].LINK_ADDRESS;
  const linkContract = new ethers.Contract(LINK_ADDRESS, linkAbi, signer);
  // Send LINK tokens to TokenInsurance 
  console.log(" --- Sending 0.1 LINK to TokenInsurance --- ");
  const tx = await linkContract.transfer(TOKEN_INSURANCE_ADDRESS, parseEther("0.1"));
  await tx.wait();

  const tokenInsuranceBalance = await linkContract.balanceOf(TOKEN_INSURANCE_ADDRESS);
  console.log(`TokenInsurance balance: ${formatEther(tokenInsuranceBalance)} LINK`);

  console.log(" --- Check LINK balance of signer --- ");
  const signerBalance = await linkContract.balanceOf(signer.address);
  console.log(`Signer balance: ${formatEther(signerBalance)} LINK`);
};



main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });