// "update-request:amoy --subscription --consumer --symbol": "node scripts/updateTokenInsuranceRequest.js 0xC22a79eBA640940ABB6dF0f7982cc119578E11De fun-polygon-amoy-1 3000000 264 0x8afB15010279712fAeb4b380D5EEba69d37ca473 FIT08"
require('dotenv').config();
const {
  AMOY_RPC_URL,
  PROTOCOL_ADMIN_ACCOUNT_PRIVATE_KEY
} = process.env;

const fs = require("fs");
const path = require("path");
const {
  SecretsManager,
  simulateScript,
  buildRequestCBOR,
  ReturnType,
  decodeResult,
  Location,
  CodeLanguage,
} = require("@chainlink/functions-toolkit");
const { abi: RWA_LIQUIDATION_Abi } = require("../artifacts/contracts/RWALiquidationFunctionWithUpdateRequest.sol/RWALiquidationFunctionWithUpdateRequest.json");
const ethers = require("ethers");
const { BigNumber } = require('bignumber.js');

const [,,ROUTER_ADDRESS, DON_ID, GAS_LIMIT_CALLBACK_STR, SUBSCRIPTION_ID_STR, CONSUMER_ADDRESS, TOKEN_RWA_SYMBOL] = process.argv;

console.log("ROUTER_ADDRESS", ROUTER_ADDRESS)
console.log("DON_ID", DON_ID)
console.log("GAS_LIMIT_CALLBACK", parseInt(GAS_LIMIT_CALLBACK_STR))
console.log("SUBSCRIPTION_ID", SUBSCRIPTION_ID_STR)
console.log("CONSUMER_ADDRESS", CONSUMER_ADDRESS)
console.log("TOKEN_RWA_SYMBOL", TOKEN_RWA_SYMBOL)

const GAS_LIMIT_CALLBACK = parseInt(GAS_LIMIT_CALLBACK_STR);

const updateRequestPolygonAmoy = async () => {
  if (!ROUTER_ADDRESS)
    throw new Error(`ROUTER_ADDRESS not provided  - send the token symbol you want to update at command line`);
  if (!DON_ID)
    throw new Error(`DON_ID not provided  - send the token symbol you want to update at command line`);
  if (!GAS_LIMIT_CALLBACK)
    throw new Error(`GAS_LIMIT_CALLBACK not provided  - send the token symbol you want to update at command line`);
  if (!SUBSCRIPTION_ID)
    throw new Error(`SUBSCRIPTION_ID not provided  - send the token symbol you want to update at command line`);
  if (!CONSUMER_ADDRESS)
    throw new Error(`CONSUMER_ADDRESS not provided  - send the token symbol you want to update at command line`);
  if (!TOKEN_RWA_SYMBOL)
    throw new Error(`TOKEN_RWA_SYMBOL not provided  - send the token symbol you want to update at command line`);

  const routerAddress = ROUTER_ADDRESS;
  const donId = DON_ID;
  const CONSUMER_ADDRESS = CONSUMER_ADDRESS;
  const SUBSCRIPTION_ID = parseInt(SUBSCRIPTION_ID_STR);

  // Initialize functions settings
  const source = fs
    .readFileSync(path.resolve(__dirname, "rwaLiquidationSourceFunction.js"))
    .toString();

  const args = [TOKEN_RWA_SYMBOL];
  const secrets = { apiKey: "xxx" };


  // Initialize ethers signer and provider to interact with the contracts onchain
  // const PROTOCOL_ADMIN_ACCOUNT_PRIVATE_KEY = process.env.PRIVATE_KEY; // fetch PRIVATE_KEY
  // ACCOUNT 1 => 0xe37c21b247AFE8cdd57B21adE192b65CE2AB163B  
  if (!PROTOCOL_ADMIN_ACCOUNT_PRIVATE_KEY)
    throw new Error(
      "private key not provided - check your environment variables"
    );

  if (!AMOY_RPC_URL)
    throw new Error(`rpcUrl not provided  - check your environment variables`);

  const provider = new ethers.JsonRpcProvider(AMOY_RPC_URL);
  const signer = new ethers.Wallet(PROTOCOL_ADMIN_ACCOUNT_PRIVATE_KEY).connect(provider);

  ///////// START SIMULATION ////////////
  console.log("Start simulation...");

  const response = await simulateScript({
    source: source,
    args: args,
    bytesArgs: [], // bytesArgs - arguments can be encoded off-chain to bytes.
    secrets: secrets,
  });

  console.log("Simulation result", response);
  const errorString = response.errorString;
  if (errorString) {
    console.log(`❌ Error during simulation: `, errorString);
  } else {
    const returnType = ReturnType.uint256;
    const responseBytesHexstring = response.responseBytesHexstring;
    if (ethers.utils.arrayify(responseBytesHexstring).length > 0) {
      const decodedResponse = decodeResult(
        response.responseBytesHexstring,
        returnType
      );
      console.log(`✅ Decoded response to ${returnType}: `, decodedResponse);
    }
  }

  //////// MAKE REQUEST ////////
  console.log("\nMake request...");

  // First encrypt secrets and upload the encrypted secrets to the DON
  const secretsManager = new SecretsManager({
    signer: signer,
    functionsRouterAddress: routerAddress,
    donId: donId,
  });
  await secretsManager.initialize();

  const functionConsumer = new ethers.Contract(CONSUMER_ADDRESS, RWA_LIQUIDATION_Abi, signer);

  // Encode request
  // console.log("source", source);
  const functionsRequestBytesHexString = buildRequestCBOR({
    codeLocation: Location.Inline, // Location of the source code - Only Inline is supported at the moment
    codeLanguage: CodeLanguage.JavaScript, // Code language - Only JavaScript is supported at the moment
    secretsLocation: Location.DONHosted, // Location of the encrypted secrets - DONHosted in this example
    source: source, // soure code
    // encryptedSecretsReference: donHostedEncryptedSecretsReference,
    args: args,
    bytesArgs: [], // bytesArgs - arguments can be encoded off-chain to bytes.
  });

  // Update request settings
  console.log("Update request settings.....");

  const estimatedGas = await functionConsumer.estimateGas.updateRequest(functionsRequestBytesHexString,
    SUBSCRIPTION_ID,
    GAS_LIMIT_CALLBACK,
    ethers.utils.formatBytes32String(donId)
  );
  console.log('Estimated Gas:', estimatedGas.toString());
  const estimatedGasBn = new BigNumber(estimatedGas);
  const gasLimitTx = estimatedGasBn.plus(ethers.utils.parseUnits("5000", "wei"));   // Adding a buffer

  const transaction = await functionConsumer.updateRequest(
    functionsRequestBytesHexString,
    SUBSCRIPTION_ID,
    GAS_LIMIT_CALLBACK,
    ethers.utils.formatBytes32String(donId), // jobId is bytes32 representation of donId,
    // { gasLimit: ethers.utils.parseUnits("78517", "wei") }
    { gasLimit: gasLimitTx }
  );

  console.log('⌛ Waiting transaction to be confirmed ...', receipt.blockNumber);
  const receipt = await transaction.wait();
  console.log('✅ Transaction confirmed in block', receipt.blockNumber);

  // Log transaction details
  console.log(
    `\n✅ Automated Functions request settings updated! Transaction hash ${transaction.hash}`
  );
};

updateRequestPolygonAmoy().catch((e) => {
  console.error(e);
  process.exit(1);
});
