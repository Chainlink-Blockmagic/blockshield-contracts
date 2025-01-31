const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { expect } = require("chai");
const { parseEther, parseUnits, keccak256, toUtf8Bytes, ZeroAddress, solidityPackedKeccak256 } = require("ethers");
const { BigNumber } = require('bignumber.js');

const contracts = {
  VAULT: "Vault",
  TOKEN_RWA: "TokenRWA",
  MOCK_USDC: "MockUSDC",
  MOCK_TOKEN_INSURANCE: "MockTokenInsurance"
};

const NOW_IN_SECS = new Date().getTime() / 1000;
const ONE_YEAR_IN_SECS = 365 * 24 * 60 * 60;

const ONE_MILLION = parseEther("1000000");
const TEN_THOUSAND = parseEther("10000");

const AGGREGATOR_NETWORK_POLYGON_AMOY = "0x1b8739bB4CdF0089d07097A9Ae5Bd274b29C6F16";
const ROUTER_FUNCTIONS_ID_AMOY = "0xC22a79eBA640940ABB6dF0f7982cc119578E11De";
const ROUTER_CCIP_ID_OPTIMISM_SEPOLIA = "0x114A20A10b43D4115e5aeef7345a1A71d2a60C57";

// AMOY to OP SEPOLIA
const ROUTER_CCIP_ID_AMOY = "0x9C32fCB86BF0f4a1A8921a9Fe46de3198bb884B2";
// const TRANSFER_TOKEN_ADDRESS_USDC_AMOY = "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582";
const LINK_ADDRESS_AMOY = "0x0Fd9e8d3aF1aaee056EB9e802c3A762a667b1904";
const DESTINATION_CHAIN_OPTIMISM_SEPOLIA = "5224473277236331295";

const SOURCE_CHAIN_CCIP_DETAILS = {
  router: ROUTER_CCIP_ID_AMOY,
  destinationChainSelector: DESTINATION_CHAIN_OPTIMISM_SEPOLIA,
  linkAddress: LINK_ADDRESS_AMOY
};

const FUNCTIONS = {
  subscriptionId: 264,
  gasLimitCallback: "3000000",
  donId: keccak256(toUtf8Bytes("0x66756e2d706f6c79676f6e2d6d61696e6e65742d310000000000000000000000")),
  requestBody: keccak256(toUtf8Bytes("something")),
}

describe("TokenInsurance", function () {
  describe("Deployment", function () {
    describe('error scenarios', async () => {
      it("Should revert if routerFunctions_ address is zero", async () => {
        const TokenInsurance = await ethers.getContractFactory(contracts.MOCK_TOKEN_INSURANCE);
        await expect(TokenInsurance.deploy("", "PRECATORIO105", 0, ZeroAddress, ZeroAddress, AGGREGATOR_NETWORK_POLYGON_AMOY))
        .to.be.revertedWith("Function: router_ cannot be zero");
      });
      it("Should revert if routerCCIP_ address is zero", async () => {
        const TokenInsurance = await ethers.getContractFactory(contracts.MOCK_TOKEN_INSURANCE);
        await expect(TokenInsurance.deploy("", "PRECATORIO105", 0, ROUTER_FUNCTIONS_ID_AMOY, ZeroAddress, AGGREGATOR_NETWORK_POLYGON_AMOY))
        .to.be.revertedWithCustomError(TokenInsurance, "ZeroAddress")
      });
      it("Should revert if name is empty", async () => {
        const TokenInsurance = await ethers.getContractFactory(contracts.MOCK_TOKEN_INSURANCE);
        await expect(TokenInsurance.deploy("", "PRECATORIO105", 0, ROUTER_FUNCTIONS_ID_AMOY, ROUTER_CCIP_ID_AMOY, AGGREGATOR_NETWORK_POLYGON_AMOY))
        .to.be.revertedWith("Name cannot be empty");
      });
      it("Should revert if symbol is empty", async () => {
        const TokenInsurance = await ethers.getContractFactory(contracts.MOCK_TOKEN_INSURANCE);
        await expect(TokenInsurance.deploy("Precatorio 105", "", 0, ROUTER_FUNCTIONS_ID_AMOY, ROUTER_CCIP_ID_AMOY, AGGREGATOR_NETWORK_POLYGON_AMOY))
        .to.be.revertedWith("Symbol cannot be empty");
      });
      it("Should revert if symbol is less than 3 characters", async () => {
        const TokenInsurance = await ethers.getContractFactory(contracts.MOCK_TOKEN_INSURANCE);
        await expect(TokenInsurance.deploy("Precatorio 105", "PRE", 0, ROUTER_FUNCTIONS_ID_AMOY, ROUTER_CCIP_ID_AMOY, AGGREGATOR_NETWORK_POLYGON_AMOY))
        .to.be.revertedWith("Symbol min length is 3");
      });
      it("Should revert if prime is zero", async () => {
        const TokenInsurance = await ethers.getContractFactory(contracts.MOCK_TOKEN_INSURANCE);
        await expect(TokenInsurance.deploy("Precatorio 105", "blockshield.PRECATORIO105", 0, ROUTER_FUNCTIONS_ID_AMOY, ROUTER_CCIP_ID_AMOY, AGGREGATOR_NETWORK_POLYGON_AMOY))
        .to.be.revertedWith("Invalid prime percentage");
      });
      it("Should revert if prime is greater than MAX_PERCENTAGE (1)", async () => {
        const TokenInsurance = await ethers.getContractFactory(contracts.MOCK_TOKEN_INSURANCE);
        await expect(TokenInsurance.deploy("Precatorio 105", "blockshield.PRECATORIO105", parseEther("1.01"), ROUTER_FUNCTIONS_ID_AMOY, ROUTER_CCIP_ID_AMOY, AGGREGATOR_NETWORK_POLYGON_AMOY))
        .to.be.revertedWith("Invalid prime percentage");
      });
      it("Should revert if prime is less than MIN_PERCENTAGE (0.01)", async () => {
        const TokenInsurance = await ethers.getContractFactory(contracts.MOCK_TOKEN_INSURANCE);
        await expect(TokenInsurance.deploy("Precatorio 105", "blockshield.PRECATORIO105", parseEther("0.009"), ROUTER_FUNCTIONS_ID_AMOY, ROUTER_CCIP_ID_AMOY, AGGREGATOR_NETWORK_POLYGON_AMOY))
        .to.be.revertedWith("Invalid prime percentage");
      });
    });
    describe('success scenarios', async () => {
      it("Should assign prime correctly", async () => {
        const { tokenInsuranceContractAddress } = await loadFixture(deployProtocol);
        const tokenInsuranceContract = await ethers.getContractAt(contracts.MOCK_TOKEN_INSURANCE, tokenInsuranceContractAddress);
        expect(await tokenInsuranceContract.prime()).to.equal(parseEther("0.05"));
      });
      it("Should not mint any tokens of TokenInsurance", async () => {
        const { tokenInsuranceContractAddress } = await loadFixture(deployProtocol);
        const tokenInsuranceContract = await ethers.getContractAt(contracts.MOCK_TOKEN_INSURANCE, tokenInsuranceContractAddress);
        expect(await tokenInsuranceContract.totalSupply()).to.equal(0);
      });
      it("Should set automation parameter as false", async () => {
        const { tokenInsuranceContractAddress } = await loadFixture(deployProtocol);
        const tokenInsuranceContract = await ethers.getContractAt(contracts.MOCK_TOKEN_INSURANCE, tokenInsuranceContractAddress);
        expect(await tokenInsuranceContract.alreadyExecuted()).to.be.false;
      });
    });
  });

  describe("\n   Hire Insurance", function () {
    describe('error scenarios', async () => {
      it("Should revert if transferTokenAddress is not set yet", async () => {
        const { tokenInsuranceContractAddress } = await loadFixture(deployProtocol);
        const TokenInsurance = await ethers.getContractFactory(contracts.MOCK_TOKEN_INSURANCE);
        const tokenInsuranceContract = await ethers.getContractAt(contracts.MOCK_TOKEN_INSURANCE, tokenInsuranceContractAddress);
        await expect(tokenInsuranceContract.hireInsurance(0))
        .to.be.revertedWithCustomError(TokenInsurance, "ZeroAddress")
      });
      it("Should revert if vault is not set yet", async () => {
        const { tokenInsuranceContractAddress, mockUSDCContractAddress } = await loadFixture(deployProtocol);
        const tokenInsuranceContract = await ethers.getContractAt(contracts.MOCK_TOKEN_INSURANCE, tokenInsuranceContractAddress);
        await tokenInsuranceContract.updateSenderCrossChainProperties(
          SOURCE_CHAIN_CCIP_DETAILS.destinationChainSelector,
          SOURCE_CHAIN_CCIP_DETAILS.linkAddress,
          mockUSDCContractAddress
        );
        await expect(tokenInsuranceContract.hireInsurance(0))
        .to.be.revertedWith("vault is not set yet");
      });
      it("Should revert if tokenRWAInfo is not set yet", async () => {
        const { tokenInsuranceContractAddress, mockUSDCContractAddress, vaultContractAddress } = await loadFixture(deployProtocol);
        const tokenInsuranceContract = await ethers.getContractAt(contracts.MOCK_TOKEN_INSURANCE, tokenInsuranceContractAddress);
        await tokenInsuranceContract.setVault(vaultContractAddress);
        await tokenInsuranceContract.updateSenderCrossChainProperties(
          SOURCE_CHAIN_CCIP_DETAILS.destinationChainSelector,
          SOURCE_CHAIN_CCIP_DETAILS.linkAddress,
          mockUSDCContractAddress
        );
        await expect(tokenInsuranceContract.hireInsurance(0))
        .to.be.revertedWith("tokenRWAInfo is not set yet");
      });
      it("Should revert if quantity_ is zero value", async () => {
        const { tokenInsuranceContractAddress } = await loadFixture(deployProtocolWithTokenInsuranceSetup);
        const tokenInsuranceContract = await ethers.getContractAt(contracts.MOCK_TOKEN_INSURANCE, tokenInsuranceContractAddress);
        await expect(tokenInsuranceContract.hireInsurance(0))
        .to.be.revertedWith("Invalid quantity");
      });
      it("Should revert if quantity_ is greater than RWA total supply", async () => {
        const { tokenInsuranceContractAddress } = await loadFixture(deployProtocolWithTokenInsuranceSetup);
        const tokenInsuranceContract = await ethers.getContractAt(contracts.MOCK_TOKEN_INSURANCE, tokenInsuranceContractAddress);
        await expect(tokenInsuranceContract.hireInsurance(parseEther("10001")))
        .to.be.revertedWith("Quantity is greater than supply");
      });
      it("Should revert if quantity_ plus current TokenInsurance supply is greater than RWA total supply", async () => {
        const { tokenInsuranceContractAddress, mockUSDCContractAddress, protocolAdmin } = await loadFixture(deployProtocolWithTokenInsuranceSetup);


        await mintUSDCToAddress({ mockUSDCContractAddress, address: protocolAdmin.address, amount: parseUnits("1000000", 6) });
        const mockUSDCContract = await ethers.getContractAt(contracts.MOCK_USDC, mockUSDCContractAddress);

        await mockUSDCContract.approve(tokenInsuranceContractAddress, parseUnits("1000000", 6));

        const tokenInsuranceContract = await ethers.getContractAt(contracts.MOCK_TOKEN_INSURANCE, tokenInsuranceContractAddress);

        // To hire insurance for RWA Total Supply it will need a million of USDC
        await tokenInsuranceContract.hireInsurance(10000); // Hire all RWA token insurances

        // // Hire an extra Insurance
        await expect(tokenInsuranceContract.hireInsurance(1))
        .to.be.revertedWith("Not suficient insurance in stock");
      });
      it("Should revert if ETH amount is less than required amount to hire", async () => {
        const { tokenInsuranceContractAddress } = await loadFixture(deployProtocolWithTokenInsuranceSetup);
        const tokenInsuranceContract = await ethers.getContractAt(contracts.MOCK_TOKEN_INSURANCE, tokenInsuranceContractAddress);
        await expect(tokenInsuranceContract.hireInsurance(1))
        .to.be.revertedWith("Insufficient USDC");
      });
    });
    describe('success scenarios', async () => {
      it("Should minting requested insurance tokens to signer", async () => {
        const { tokenInsuranceContractAddress, protocolAdmin, mockUSDCContractAddress } = await loadFixture(deployProtocolWithTokenInsuranceSetup);
        const tokenInsuranceContract = await ethers.getContractAt(contracts.MOCK_TOKEN_INSURANCE, tokenInsuranceContractAddress);
        await mintUSDCToAddress({ mockUSDCContractAddress, address: protocolAdmin.address, amount: parseUnits("100", 6) });
        const mockUSDCContract = await ethers.getContractAt(contracts.MOCK_USDC, mockUSDCContractAddress);
        await mockUSDCContract.approve(tokenInsuranceContractAddress, parseUnits("100", 6));
        await expect(tokenInsuranceContract.hireInsurance(1))
        .to.changeTokenBalances(
          tokenInsuranceContract,
          [protocolAdmin],
          [parseEther("1").valueOf()]
        );
      });
      it("Should emit InsuranceHired event", async () => {
        const { tokenInsuranceContractAddress, protocolAdmin, mockUSDCContractAddress } = await loadFixture(deployProtocolWithTokenInsuranceSetup);
        const tokenInsuranceContract = await ethers.getContractAt(contracts.MOCK_TOKEN_INSURANCE, tokenInsuranceContractAddress);
        await mintUSDCToAddress({ mockUSDCContractAddress, address: protocolAdmin.address, amount: parseUnits("100", 6) });
        const mockUSDCContract = await ethers.getContractAt(contracts.MOCK_USDC, mockUSDCContractAddress);
        await mockUSDCContract.approve(tokenInsuranceContractAddress, parseUnits("100", 6));
        const QUANTITY = 1;
        const requiredAmount = await tokenInsuranceContract.getRwaTotalValueInTokenTransferDecimals(QUANTITY);
        await expect(tokenInsuranceContract.hireInsurance(QUANTITY))
        .to.emit(tokenInsuranceContract, "InsuranceHired").withArgs(
          solidityPackedKeccak256([], []),
          protocolAdmin.address,
          tokenInsuranceContractAddress,
          requiredAmount
        );
      });

      // TODO: This migrated to Vault logic
      // it("Should hire insurance and transfer tokens from TokenRWA to Vault", async () => {
      //   const { tokenInsuranceContractAddress, tokenRWAContractAddress, vaultContractAddress, mockUSDCContractAddress, protocolAdmin } = await loadFixture(deployProtocolWithTokenInsuranceSetup);
      //   await mintUSDCToAddress({ mockUSDCContractAddress, address: protocolAdmin.address, amount: parseUnits("100", 6) });
      //   const vaultContract = await ethers.getContractAt(contracts.VAULT, vaultContractAddress);
      //   const tokenRWAContract = await ethers.getContractAt(contracts.TOKEN_RWA, tokenRWAContractAddress);
      //   const tokenInsuranceContract = await ethers.getContractAt(contracts.MOCK_TOKEN_INSURANCE, tokenInsuranceContractAddress);
      //   await expect(tokenInsuranceContract.hireInsurance(parseEther("1")))
      //   .to.changeTokenBalances(
      //     tokenRWAContract,
      //     [tokenRWAContract, vaultContract],
      //     [-parseEther("1").valueOf(), parseEther("1").valueOf()]
      //   );
      // });
      // it("Should hire insurance and send ETH from signer to Vault", async () => {
      //   const { tokenInsuranceContractAddress, vaultContractAddress, protocolAdmin } = await loadFixture(deployProtocolWithTokenInsuranceSetup);
      //   const tokenInsuranceContract = await ethers.getContractAt(contracts.MOCK_TOKEN_INSURANCE, tokenInsuranceContractAddress);
      //   await expect(tokenInsuranceContract.hireInsurance(parseEther("1")))
      //   .to.changeEtherBalances(
      //     [protocolAdmin, vaultContractAddress],
      //     [-parseEther("100").valueOf(), parseEther("100").valueOf()]
      //   );
      // });
      // it("Should hire insurance and send exact ETH from signer to Vault", async () => {
      //   const { tokenInsuranceContractAddress, vaultContractAddress, protocolAdmin } = await loadFixture(deployProtocolWithTokenInsuranceSetup);
      //   const tokenInsuranceContract = await ethers.getContractAt(contracts.MOCK_TOKEN_INSURANCE, tokenInsuranceContractAddress);
      //   await expect(tokenInsuranceContract.hireInsurance(parseEther("1")))
      //   .to.changeEtherBalances(
      //     [protocolAdmin, vaultContractAddress, tokenInsuranceContract],
      //     [-parseEther("100").valueOf(), parseEther("100").valueOf(), 0]
      //   );
      // });
    });
  });

  describe("\n   checkUpkeep", function () {
    describe('success scenarios', async () => {
      it("Should return upkeepNeeded = false when => requestBody IS NOT SET && RWA due date IS NOT REACHED && performUpkeep() WAS NEVER CALLED", async () => {
        const { tokenInsuranceContractAddress } = await loadFixture(deployProtocolWithTokenInsuranceSetup);
        const tokenInsuranceContract = await ethers.getContractAt(contracts.MOCK_TOKEN_INSURANCE, tokenInsuranceContractAddress);
        const checkData = keccak256(toUtf8Bytes(""));
        const { upkeepNeeded } = await tokenInsuranceContract.checkUpkeep(checkData);
        expect(upkeepNeeded).to.false;
      });
      it("Should return upkeepNeeded = false when => requestBody IS SET && RWA due date IS NOT REACHED && performUpkeep() WAS NEVER CALLED", async () => {
        const { tokenInsuranceContractAddress } = await loadFixture(deployProtocolWithTokenInsuranceSetup);
        const tokenInsuranceContract = await ethers.getContractAt(contracts.MOCK_TOKEN_INSURANCE, tokenInsuranceContractAddress);
        await tokenInsuranceFunctionSetup({ tokenInsuranceContract });
        const checkData = keccak256(toUtf8Bytes(""));
        const { upkeepNeeded } = await tokenInsuranceContract.checkUpkeep(checkData);
        expect(upkeepNeeded).to.false;
      });
      it("Should return upkeepNeeded = true when => requestBody IS SET && RWA due date IS REACHED && performUpkeep() WAS NEVER CALLED", async () => {
        const snapshotId = await network.provider.send("evm_snapshot", []);
        const { tokenInsuranceContractAddress } = await deployProtocolWithTokenInsuranceSetup();
        const tokenInsuranceContract = await ethers.getContractAt(contracts.MOCK_TOKEN_INSURANCE, tokenInsuranceContractAddress);
        await tokenInsuranceFunctionSetup({ tokenInsuranceContract });
        await increaseTimestamp(ONE_YEAR_IN_SECS);
        const checkData = keccak256(toUtf8Bytes(""));
        const { upkeepNeeded } = await tokenInsuranceContract.checkUpkeep(checkData);
        expect(upkeepNeeded).to.true;
        await network.provider.send("evm_revert", [snapshotId]);
      });
      it("Should return upkeepNeeded = true when => requestBody IS SET && RWA due date IS REACHED && performUpkeep() WAS CALLED", async () => {
        const snapshotId = await network.provider.send("evm_snapshot", []);
        const { tokenInsuranceContractAddress } = await deployProtocol();
        const tokenInsuranceContract = await ethers.getContractAt(contracts.MOCK_TOKEN_INSURANCE, tokenInsuranceContractAddress);
        await tokenInsuranceFunctionSetup({ tokenInsuranceContract });
        await increaseTimestamp(ONE_YEAR_IN_SECS);
        const checkData = keccak256(toUtf8Bytes(""));
        let upkeepNeeded;
        ({ upkeepNeeded } = await tokenInsuranceContract.checkUpkeep(checkData));
        expect(upkeepNeeded).to.true;
        await tokenInsuranceContract.performUpkeep(checkData);
        ({ upkeepNeeded } = await tokenInsuranceContract.checkUpkeep(checkData));
        expect(upkeepNeeded).to.false;
        await network.provider.send("evm_revert", [snapshotId]);
      });
    });
  });

  describe("\n   performUpkeep", function () {
    it("Should perform upkeep when upkeepNeeded = true setting TRUE alreadyExecuted flag", async () => {
      const snapshotId = await network.provider.send("evm_snapshot", []);
      const { tokenInsuranceContractAddress } = await deployProtocolWithTokenInsuranceSetup();
      const tokenInsuranceContract = await ethers.getContractAt(contracts.MOCK_TOKEN_INSURANCE, tokenInsuranceContractAddress);
      await tokenInsuranceFunctionSetup({ tokenInsuranceContract });
      await increaseTimestamp(ONE_YEAR_IN_SECS);
      const checkData = keccak256(toUtf8Bytes(""));
      await tokenInsuranceContract.performUpkeep(checkData);
      expect(await tokenInsuranceContract.alreadyExecuted()).to.true;
      await network.provider.send("evm_revert", [snapshotId]);
    });

    it("Should perform upkeep and emit performUpkeep event", async () => {
      const snapshotId = await network.provider.send("evm_snapshot", []);
      const { tokenInsuranceContractAddress, tokenRWAContractAddress } = await deployProtocolWithTokenInsuranceSetup();
      const tokenInsuranceContract = await ethers.getContractAt(contracts.MOCK_TOKEN_INSURANCE, tokenInsuranceContractAddress);
      await tokenInsuranceFunctionSetup({ tokenInsuranceContract });
      await increaseTimestamp(ONE_YEAR_IN_SECS);
      const checkData = keccak256(toUtf8Bytes(""));
      await expect(tokenInsuranceContract.performUpkeep(checkData))
      .to.emit(tokenInsuranceContract, "PerformUpkeep").withArgs(
        tokenRWAContractAddress,
        tokenInsuranceContractAddress
      );
      await network.provider.send("evm_revert", [snapshotId]);
    });
  });

  describe("\n payInsuranceClients", function () {
    it("Should pay insurance clients right amount of USDC", async () => {
      const { tokenInsuranceContractAddress, protocolAdmin, mockUSDCContractAddress } = await loadFixture(deployProtocolWithTokenInsuranceSetup);
      const mockUSDCContract = await ethers.getContractAt(contracts.MOCK_USDC, mockUSDCContractAddress);
      const tokenInsuranceContract = await ethers.getContractAt(contracts.MOCK_TOKEN_INSURANCE, tokenInsuranceContractAddress);

      await mintUSDCToAddress({ mockUSDCContractAddress, address: tokenInsuranceContractAddress, amount: parseUnits("100", 6) });
      await mintUSDCToAddress({ mockUSDCContractAddress, address: protocolAdmin.address, amount: parseUnits("100", 6) });
      
      await mockUSDCContract.approve(tokenInsuranceContractAddress, parseUnits("100", 6));

      const tx_hireInsurance = await tokenInsuranceContract.hireInsurance(1);
      await tx_hireInsurance.wait();

      await expect(tokenInsuranceContract.payInsuranceClients())
      .to.changeTokenBalances(
        mockUSDCContract,
        [tokenInsuranceContractAddress, protocolAdmin.address],
        [-parseUnits("95", 6), parseUnits("95", 6)]);
    });
    it("Should burn right amount of client insurance", async () => {
      const { tokenInsuranceContractAddress, protocolAdmin, mockUSDCContractAddress } = await loadFixture(deployProtocolWithTokenInsuranceSetup);
      const tokenInsuranceContract = await ethers.getContractAt(contracts.MOCK_TOKEN_INSURANCE, tokenInsuranceContractAddress);

      await mintUSDCToAddress({ mockUSDCContractAddress, address: tokenInsuranceContractAddress, amount: parseUnits("100", 6) });
      await mintUSDCToAddress({ mockUSDCContractAddress, address: protocolAdmin.address, amount: parseUnits("100", 6) });
      const mockUSDCContract = await ethers.getContractAt(contracts.MOCK_USDC, mockUSDCContractAddress);
      await mockUSDCContract.approve(tokenInsuranceContractAddress, parseUnits("100", 6));

      const tx_hireInsurance = await tokenInsuranceContract.hireInsurance(1);
      await tx_hireInsurance.wait();

      await expect(tokenInsuranceContract.payInsuranceClients())
      .to.changeTokenBalance(
        tokenInsuranceContract,
        protocolAdmin.address,
        -parseEther("1"));
    });
    it("Should emit UserPayment event with exact arguments", async () => {
      const { tokenInsuranceContractAddress, protocolAdmin, mockUSDCContractAddress } = await loadFixture(deployProtocolWithTokenInsuranceSetup);
      const tokenInsuranceContract = await ethers.getContractAt(contracts.MOCK_TOKEN_INSURANCE, tokenInsuranceContractAddress);

      await mintUSDCToAddress({ mockUSDCContractAddress, address: tokenInsuranceContractAddress, amount: parseUnits("100", 6) });
      await mintUSDCToAddress({ mockUSDCContractAddress, address: protocolAdmin.address, amount: parseUnits("100", 6) });
      const mockUSDCContract = await ethers.getContractAt(contracts.MOCK_USDC, mockUSDCContractAddress);
      await mockUSDCContract.approve(tokenInsuranceContractAddress, parseUnits("100", 6));

      const QUANTITY = 1;
      const tx_hireInsurance = await tokenInsuranceContract.hireInsurance(QUANTITY);
      await tx_hireInsurance.wait();

      const expectedTotalValue = await tokenInsuranceContract.getRwaTotalValueInTokenTransferDecimals(QUANTITY);
      const expectedInsuranceTotalCost = await tokenInsuranceContract.getTotalInsuranceCostInTokenTransferDecimals(QUANTITY);
      const expectedPaymentValue = BigNumber(expectedTotalValue).minus(expectedInsuranceTotalCost);

      await expect(tokenInsuranceContract.payInsuranceClients())
      .to.emit(tokenInsuranceContract, "UserPayment")
      .withArgs(
        tokenInsuranceContractAddress,
        protocolAdmin.address,
        expectedPaymentValue,
        expectedTotalValue,
        expectedInsuranceTotalCost
      );
    });
  });

  const increaseTimestamp = async (seconds) => {
    // Increase time by one year (31536000 seconds)
    await network.provider.send("evm_increaseTime", [seconds]);
    
    // Mine a new block so the timestamp change takes effect
    await network.provider.send("evm_mine");
  }

  async function deployProtocol() {
    const [protocolAdmin] = await ethers.getSigners();
    const mockUSDCContractAddress = await deployMockUsdc();
    const tokenRWAContractAddress = await deployTokenRWA({ mockUSDCContractAddress });
    const vaultContractAddress = await deployVault();
    const tokenInsuranceContractAddress = await deployTokenInsurance();

    expect(tokenInsuranceContractAddress).to.not.equal(ZeroAddress);
    expect(vaultContractAddress).to.not.equal(ZeroAddress);
    expect(tokenRWAContractAddress).to.not.equal(ZeroAddress);

    return {
      protocolAdmin,
      tokenRWAContractAddress,
      vaultContractAddress,
      tokenInsuranceContractAddress,
      mockUSDCContractAddress
    };
  }

  async function deployProtocolWithTokenInsuranceSetup() {
    const {
      protocolAdmin,
      tokenRWAContractAddress,
      vaultContractAddress,
      tokenInsuranceContractAddress,
      mockUSDCContractAddress
    } = await deployProtocol();

    const tokenInsuranceContract = await ethers.getContractAt(contracts.MOCK_TOKEN_INSURANCE, tokenInsuranceContractAddress);
    const tx_updateSenderCrossChainProperties = await tokenInsuranceContract.updateSenderCrossChainProperties(
      SOURCE_CHAIN_CCIP_DETAILS.destinationChainSelector,
      SOURCE_CHAIN_CCIP_DETAILS.linkAddress,
      mockUSDCContractAddress
    );
    await tx_updateSenderCrossChainProperties.wait();

    const tokenRWAContract = await ethers.getContractAt(contracts.TOKEN_RWA, tokenRWAContractAddress);
    const [totalSupply, totalValue, decimals, dueDate, symbol] = await Promise.all([
      tokenRWAContract.totalSupply(),
      tokenRWAContract.totalValue(),
      tokenRWAContract.decimals(),
      tokenRWAContract.dueDate(),
      tokenRWAContract.symbol(),
    ]);
    const tokenRWAInfo = {
      securedAsset: tokenRWAContractAddress,
      totalSupply,
      totalValue,
      decimals,
      dueDate,
      symbol,
      isSet: true
    };
    const tx_updateTokenRWADetails = await tokenInsuranceContract.updateTokenRWADetails(tokenRWAInfo);
    await tx_updateTokenRWADetails.wait();

    const tx_setVault = await tokenInsuranceContract.setVault(vaultContractAddress);
    await tx_setVault.wait();

    return {
      protocolAdmin,
      tokenRWAContractAddress,
      vaultContractAddress,
      tokenInsuranceContractAddress,
      mockUSDCContractAddress
    };
  }

  const deployTokenRWA = async ({ mockUSDCContractAddress }) => {
    console.log(" --- Deploying Token RWA contract --- ");
    const TokenRWA = await ethers.getContractFactory(contracts.TOKEN_RWA);
    const NEXT_YEAR = parseUnits(parseInt(NOW_IN_SECS + ONE_YEAR_IN_SECS).toString(), 0);
    const rwa = {
      name: "Precatorio 105",
      symbol: "PRECATORIO105",
      totalSupply: TEN_THOUSAND,
      totalValue: ONE_MILLION,
      yield: parseEther("0.15"), // 15% yield
      dueDate: NEXT_YEAR,
      transferPaymentToken: mockUSDCContractAddress
    }
    const tokenRWAContract = await TokenRWA.deploy(rwa.name, rwa.symbol, rwa.totalSupply, rwa.totalValue, rwa.dueDate, rwa.yield, rwa.transferPaymentToken);
    const tokenRWAContractAddress = await tokenRWAContract.getAddress();
    console.log(`TokenRWA address: ${tokenRWAContractAddress}`);
    return tokenRWAContractAddress;
  };

  const deployVault = async () => {
    console.log(" --- Deploying Vault contract --- ");
    const Vault = await ethers.getContractFactory(contracts.VAULT);
    const vaultContract = await Vault.deploy(ROUTER_CCIP_ID_OPTIMISM_SEPOLIA);
    const vaultContractAddress = await vaultContract.getAddress();
    console.log(`Vault address: ${vaultContractAddress}`);
    return vaultContractAddress;
  };

  const deployTokenInsurance = async () => {
    console.log(" --- Deploying Token Insurance contract --- ");
    const TokenInsurance = await ethers.getContractFactory(contracts.MOCK_TOKEN_INSURANCE);
    const insurance = {
      name: "Precatorio 105",
      symbol: "blockshield.PRECATORIO105",
      prime: parseEther("0.05"), // 5% prime
      routerFunctions: ROUTER_FUNCTIONS_ID_AMOY,
      routerCCIP: ROUTER_CCIP_ID_AMOY,
      aggregatorNetwork: AGGREGATOR_NETWORK_POLYGON_AMOY
    }
    const tokenInsuranceContract = await TokenInsurance.deploy(insurance.name, insurance.symbol, insurance.prime, insurance.routerFunctions, insurance.routerCCIP, insurance.aggregatorNetwork);
    const tokenInsuranceContractAddress = await tokenInsuranceContract.getAddress();
    console.log(`TokenInsurance address: ${tokenInsuranceContractAddress}`);
    return tokenInsuranceContractAddress;
  };

  const deployMockUsdc = async () => {
    console.log(" --- Deploying MockUSDC contract --- ");
    const MockUSDC = await ethers.getContractFactory(contracts.MOCK_USDC);
    const mockUSDCContract = await MockUSDC.deploy();
    const mockUSDCContractAddress = await mockUSDCContract.getAddress();
    console.log(`MockUSDC address: ${mockUSDCContract}`);
    return mockUSDCContractAddress;
  };

  const mintUSDCToAddress = async ({ mockUSDCContractAddress, address, amount }) => {
    const mockUSDCContract = await ethers.getContractAt(contracts.MOCK_USDC, mockUSDCContractAddress);
    const tx_mint = await mockUSDCContract.mint(address, amount);
    await tx_mint.wait();
  };
  const tokenInsuranceFunctionSetup = async ({ tokenInsuranceContract }) => {
    // Functions setup
    const tx = await tokenInsuranceContract.updateRequest(
      FUNCTIONS.requestBody,
      FUNCTIONS.subscriptionId,
      FUNCTIONS.gasLimitCallback,
      FUNCTIONS.donId
    );
    await tx.wait();
  };
});