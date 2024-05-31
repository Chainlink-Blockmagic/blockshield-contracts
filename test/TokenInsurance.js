const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { expect } = require("chai");
const { parseEther, parseUnits, keccak256, toUtf8Bytes, ZeroAddress, solidityPackedKeccak256 } = require("ethers");

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
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const AGGREGATOR_NETWORK_SEPOLIA = "0x694AA1769357215DE4FAC081bf1f309aDC325306";
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
// const DON_ID_AMOY = keccak256(toUtf8Bytes("0x66756e2d706f6c79676f6e2d6d61696e6e65742d310000000000000000000000"));

describe("TokenInsurance", function () {
  describe("Deployment", function () {
    describe('error scenarios', async () => {
      it("Should revert if routerFunctions_ address is zero", async () => {
        const TokenInsurance = await ethers.getContractFactory(contracts.MOCK_TOKEN_INSURANCE);
        await expect(TokenInsurance.deploy("", "PRECATORIO105", ZERO_ADDRESS, ZERO_ADDRESS, 0, ZERO_ADDRESS, ZERO_ADDRESS))
        .to.be.revertedWith("Function: router_ cannot be zero");
      });
      it("Should revert if routerCCIP_ address is zero", async () => {
        const TokenInsurance = await ethers.getContractFactory(contracts.MOCK_TOKEN_INSURANCE);
        await expect(TokenInsurance.deploy("", "PRECATORIO105", ZERO_ADDRESS, ZERO_ADDRESS, 0, ROUTER_FUNCTIONS_ID_AMOY, ZERO_ADDRESS))
        .to.be.revertedWithCustomError(TokenInsurance, "ZeroAddress")
      });
      it("Should revert if name is empty", async () => {
        const TokenInsurance = await ethers.getContractFactory(contracts.MOCK_TOKEN_INSURANCE);
        await expect(TokenInsurance.deploy("", "PRECATORIO105", ZERO_ADDRESS, ZERO_ADDRESS, 0, ROUTER_FUNCTIONS_ID_AMOY, ROUTER_CCIP_ID_AMOY))
        .to.be.revertedWith("Name cannot be empty");
      });
      it("Should revert if symbol is empty", async () => {
        const TokenInsurance = await ethers.getContractFactory(contracts.MOCK_TOKEN_INSURANCE);
        await expect(TokenInsurance.deploy("Precatorio 105", "", ZERO_ADDRESS, ZERO_ADDRESS, 0, ROUTER_FUNCTIONS_ID_AMOY, ROUTER_CCIP_ID_AMOY))
        .to.be.revertedWith("Symbol cannot be empty");
      });
      it("Should revert if symbol is less than 3 characters", async () => {
        const TokenInsurance = await ethers.getContractFactory(contracts.MOCK_TOKEN_INSURANCE);
        await expect(TokenInsurance.deploy("Precatorio 105", "PRE", ZERO_ADDRESS, ZERO_ADDRESS, 0, ROUTER_FUNCTIONS_ID_AMOY, ROUTER_CCIP_ID_AMOY))
        .to.be.revertedWith("Symbol min length is 3");
      });
      it("Should revert if securedAsset_ address is zero address", async () => {
        const TokenInsurance = await ethers.getContractFactory(contracts.MOCK_TOKEN_INSURANCE);
        await expect(TokenInsurance.deploy("Precatorio 105", "blockshield.PRECATORIO105", ZERO_ADDRESS, ZERO_ADDRESS, 0, ROUTER_FUNCTIONS_ID_AMOY, ROUTER_CCIP_ID_AMOY))
        .to.be.revertedWithCustomError(TokenInsurance, "ZeroAddress")
      });
      it("Should revert if vault address is zero address", async () => {
        const [protocolAdmin] = await ethers.getSigners();
        const TokenInsurance = await ethers.getContractFactory(contracts.MOCK_TOKEN_INSURANCE);
        await expect(TokenInsurance.deploy("Precatorio 105", "blockshield.PRECATORIO105", protocolAdmin.address, ZERO_ADDRESS, 0, ROUTER_FUNCTIONS_ID_AMOY, ROUTER_CCIP_ID_AMOY))
        .to.be.revertedWithCustomError(TokenInsurance, "ZeroAddress")
      });
      it("Should revert if prime is zero", async () => {
        const [protocolAdmin] = await ethers.getSigners();
        const TokenInsurance = await ethers.getContractFactory(contracts.MOCK_TOKEN_INSURANCE);
        await expect(TokenInsurance.deploy("Precatorio 105", "blockshield.PRECATORIO105", protocolAdmin.address, protocolAdmin.address, 0, ROUTER_FUNCTIONS_ID_AMOY, ROUTER_CCIP_ID_AMOY))
        .to.be.revertedWith("Invalid prime percentage");
      });
      it("Should revert if prime is greater than MAX_PERCENTAGE (1)", async () => {
        const [protocolAdmin] = await ethers.getSigners();
        const TokenInsurance = await ethers.getContractFactory(contracts.MOCK_TOKEN_INSURANCE);
        await expect(TokenInsurance.deploy("Precatorio 105", "blockshield.PRECATORIO105", protocolAdmin.address, protocolAdmin.address, parseEther("1.01"), ROUTER_FUNCTIONS_ID_AMOY, ROUTER_CCIP_ID_AMOY))
        .to.be.revertedWith("Invalid prime percentage");
      });
      it("Should revert if prime is less than MIN_PERCENTAGE (0.01)", async () => {
        const [protocolAdmin] = await ethers.getSigners();
        const TokenInsurance = await ethers.getContractFactory(contracts.MOCK_TOKEN_INSURANCE);
        await expect(TokenInsurance.deploy("Precatorio 105", "blockshield.PRECATORIO105", protocolAdmin.address, protocolAdmin.address, parseEther("0.009"), ROUTER_FUNCTIONS_ID_AMOY, ROUTER_CCIP_ID_AMOY))
        .to.be.revertedWith("Invalid prime percentage");
      });
    });
    describe('success scenarios', async () => {
      it("Should assign vault correctly ", async () => {
        const { vaultContractAddress, tokenInsuranceContractAddress } = await loadFixture(deployProtocol);
        const tokenInsuranceContract = await ethers.getContractAt(contracts.MOCK_TOKEN_INSURANCE, tokenInsuranceContractAddress);
        expect(await tokenInsuranceContract.vault()).to.equal(vaultContractAddress);
      });
      it("Should assign TokenRWA address to secured asset correctly ", async () => {
        const { tokenRWAContractAddress, tokenInsuranceContractAddress } = await loadFixture(deployProtocol);
        const tokenInsuranceContract = await ethers.getContractAt(contracts.MOCK_TOKEN_INSURANCE, tokenInsuranceContractAddress);
        expect(await tokenInsuranceContract.securedAsset()).to.equal(tokenRWAContractAddress);
      });
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
      it("Should revert if tokenRWAInfo is not set yet", async () => {
        const { tokenInsuranceContractAddress, mockUSDCContractAddress } = await loadFixture(deployProtocol);
        const tokenInsuranceContract = await ethers.getContractAt(contracts.MOCK_TOKEN_INSURANCE, tokenInsuranceContractAddress);
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

        await mintUSDCToAddress({ mockUSDCContractAddress, address: protocolAdmin.address, amount: ONE_MILLION });
        const tokenInsuranceContract = await ethers.getContractAt(contracts.MOCK_TOKEN_INSURANCE, tokenInsuranceContractAddress);

        // To hire insurance for RWA Total Supply it will need a million of USDC
        await tokenInsuranceContract.hireInsurance(parseEther("10000")); // Hire all RWA token insurances

        // // Hire an extra Insurance
        await expect(tokenInsuranceContract.hireInsurance(parseEther("1")))
        .to.be.revertedWith("Not suficient insurance in stock");
      });
      it("Should revert if ETH amount is less than required amount to hire", async () => {
        const { tokenInsuranceContractAddress } = await loadFixture(deployProtocolWithTokenInsuranceSetup);
        const tokenInsuranceContract = await ethers.getContractAt(contracts.MOCK_TOKEN_INSURANCE, tokenInsuranceContractAddress);
        await expect(tokenInsuranceContract.hireInsurance(parseEther("1")))
        .to.be.revertedWith("Insufficient USDC");
      });
    });
    describe('success scenarios', async () => {
      it("Should minting requested insurance tokens to signer", async () => {
        const { tokenInsuranceContractAddress, protocolAdmin, mockUSDCContractAddress } = await loadFixture(deployProtocolWithTokenInsuranceSetup);
        const tokenInsuranceContract = await ethers.getContractAt(contracts.MOCK_TOKEN_INSURANCE, tokenInsuranceContractAddress);
        await mintUSDCToAddress({ mockUSDCContractAddress, address: protocolAdmin.address, amount: parseEther("100") });
        await expect(tokenInsuranceContract.hireInsurance(parseEther("1")))
        .to.changeTokenBalances(
          tokenInsuranceContract,
          [protocolAdmin],
          [parseEther("1").valueOf()]
        );
      });
      it("Should emit InsuranceHired event", async () => {
        const { tokenInsuranceContractAddress, protocolAdmin, mockUSDCContractAddress } = await loadFixture(deployProtocolWithTokenInsuranceSetup);
        const tokenInsuranceContract = await ethers.getContractAt(contracts.MOCK_TOKEN_INSURANCE, tokenInsuranceContractAddress);
        await mintUSDCToAddress({ mockUSDCContractAddress, address: protocolAdmin.address, amount: parseEther("100") });
        const requiredAmount = await tokenInsuranceContract.getRwaTotalValue(parseEther("1"));
        await expect(tokenInsuranceContract.hireInsurance(parseEther("1")))
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
      //   await mintUSDCToAddress({ mockUSDCContractAddress, address: protocolAdmin.address, amount: parseEther("100") });
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
      let snapshotId;

      beforeEach(async () => {
        snapshotId = await network.provider.send("evm_snapshot", []);
      });

      afterEach(async () => {
        await network.provider.send("evm_revert", [snapshotId]);
      });

      it("Should return upkeepNeeded = false when RWA due date IS NOT REACHED & performUpkeep() WAS NEVER CALLED", async () => {
        const { tokenInsuranceContractAddress } = await loadFixture(deployProtocol);
        const tokenInsuranceContract = await ethers.getContractAt(contracts.MOCK_TOKEN_INSURANCE, tokenInsuranceContractAddress);
        const checkData = keccak256(toUtf8Bytes(""));
        const { upkeepNeeded } = await tokenInsuranceContract.checkUpkeep(checkData);
        expect(upkeepNeeded).to.false;
      });
      it("Should return upkeepNeeded = true when RWA due date IS REACHED & performUpkeep() WAS NEVER CALLED", async () => {
        const { tokenInsuranceContractAddress } = await deployProtocol();
        const tokenInsuranceContract = await ethers.getContractAt(contracts.MOCK_TOKEN_INSURANCE, tokenInsuranceContractAddress);
        await increaseTimestamp(ONE_YEAR_IN_SECS);
        const checkData = keccak256(toUtf8Bytes(""));
        const { upkeepNeeded } = await tokenInsuranceContract.checkUpkeep(checkData);
        expect(upkeepNeeded).to.true;
      });
      it.skip("Should return upkeepNeeded = true when RWA due date IS REACHED & performUpkeep() WAS CALLED", async () => {
        const { tokenInsuranceContractAddress } = await deployProtocol();
        const tokenInsuranceContract = await ethers.getContractAt(contracts.MOCK_TOKEN_INSURANCE, tokenInsuranceContractAddress);
        await increaseTimestamp(ONE_YEAR_IN_SECS);
        const checkData = keccak256(toUtf8Bytes(""));
        let upkeepNeeded;
        ({ upkeepNeeded } = await tokenInsuranceContract.checkUpkeep(checkData));
        expect(upkeepNeeded).to.true;
        await tokenInsuranceContract.performUpkeep(checkData);
        ({ upkeepNeeded } = await tokenInsuranceContract.checkUpkeep(checkData));
        expect(upkeepNeeded).to.false;
      });
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
    const tokenRWAContractAddress = await deployTokenRWA();
    const vaultContractAddress = await deployVault();
    const mockUSDCContractAddress = await deployMockUsdc();
    const tokenInsuranceContractAddress = await deployTokenInsurance({ vaultAddress: vaultContractAddress, tokenRWAaddress: tokenRWAContractAddress });

    expect(tokenInsuranceContractAddress).to.not.equal(ZERO_ADDRESS);
    expect(vaultContractAddress).to.not.equal(ZERO_ADDRESS);
    expect(tokenRWAContractAddress).to.not.equal(ZERO_ADDRESS);

    // const vaultContract = await ethers.getContractAt(contracts.VAULT, vaultContractAddress);
    // TODO: Check Vault import AccessControl.sol comment
    // await vaultContract.grantAdminRole(tokenInsuranceContractAddress);

    // const tokenRWAContract = await ethers.getContractAt(contracts.TOKEN_RWA, tokenRWAContractAddress);
    // TODO: Check Vault import AccessControl.sol comment
    // await tokenRWAContract.grantAdminRole(tokenInsuranceContractAddress);

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
    const [totalSupply, unitValue, decimals, dueDate, symbol] = await Promise.all([
      tokenRWAContract.totalSupply(),
      tokenRWAContract.unitValue(),
      tokenRWAContract.decimals(),
      tokenRWAContract.dueDate(),
      tokenRWAContract.symbol(),
    ]);
    const tokenRWAInfo = {
      totalSupply,
      unitValue,
      decimals,
      dueDate,
      symbol,
      isSet: true
    };
    const tx_updateTokenRWADetails = await tokenInsuranceContract.updateTokenRWADetails(tokenRWAInfo);
    await tx_updateTokenRWADetails.wait();

    return {
      protocolAdmin,
      tokenRWAContractAddress,
      vaultContractAddress,
      tokenInsuranceContractAddress,
      mockUSDCContractAddress
    };
  }

  const deployTokenRWA = async () => {
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
    }
    const tokenRWAContract = await TokenRWA.deploy(rwa.name, rwa.symbol, rwa.totalSupply, rwa.totalValue, rwa.dueDate, rwa.yield, AGGREGATOR_NETWORK_SEPOLIA);
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

  const deployTokenInsurance = async ({ vaultAddress, tokenRWAaddress }) => {
    console.log(" --- Deploying Token Insurance contract --- ");
    const TokenInsurance = await ethers.getContractFactory(contracts.MOCK_TOKEN_INSURANCE);
    const insurance = {
      name: "Precatorio 105",
      symbol: "blockshield.PRECATORIO105",
      securedAsset: tokenRWAaddress,
      vault: vaultAddress,
      prime: parseEther("0.05"), // 5% prime
      routerFunctions: ROUTER_FUNCTIONS_ID_AMOY,
      routerCCIP: ROUTER_CCIP_ID_AMOY,
    }
    const tokenInsuranceContract = await TokenInsurance.deploy(insurance.name, insurance.symbol, insurance.securedAsset, insurance.vault, insurance.prime, insurance.routerFunctions, insurance.routerCCIP);
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
});
