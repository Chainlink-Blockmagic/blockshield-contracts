const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { expect } = require("chai");
const { parseEther, parseUnits, ZeroAddress } = require("ethers");

const contracts = {
  VAULT: "Vault",
  TOKEN_RWA: "TokenRWA",
  MOCK_USDC: "MockUSDC",
};

const NOW_IN_SECS = new Date().getTime() / 1000;
const ONE_YEAR_IN_SECS = 24 * 60 * 60;

const ONE_MILLION = parseEther("1000000");
const TEN_THOUSAND = parseEther("10000");
const ROUTER_CCIP_ID_OPTIMISM_SEPOLIA = "0x114A20A10b43D4115e5aeef7345a1A71d2a60C57";
const TOKEN_INSURANCE_ADDRESS = "0x0000000000000000000000000000000000000001";

describe("Vault", function () {

  async function deployProtocol() {
    const [protocolAdmin, client] = await ethers.getSigners();
    const mockUSDCContractAddress = await deployMockUsdc();
    const tokenRWAContractAddress = await deployTokenRWA({ mockUSDCContractAddress });
    const vaultContractAddress = await deployVault();

    expect(vaultContractAddress).to.not.equal(ZeroAddress);
    expect(tokenRWAContractAddress).to.not.equal(ZeroAddress);

    return {
      protocolAdmin,
      client,
      tokenRWAContractAddress,
      vaultContractAddress,
      tokenInsuranceContractAddress: TOKEN_INSURANCE_ADDRESS
    };
  }

  describe("\n   Add Hire Insurance Record", function () {
    describe('error scenarios', async () => {
      it("Should revert if securedAsset_ is zero address", async () => {
        const { vaultContractAddress } = await loadFixture(deployProtocol);
        const vaultContract = await ethers.getContractAt(contracts.VAULT, vaultContractAddress);
        await expect(vaultContract.addHiredInsurance(ZeroAddress, ZeroAddress, ZeroAddress, 0, 0))
        .to.be.revertedWith("securedAsset_ cannot be zero address");
      });
      it("Should revert if insuranceAddress_ is zero address", async () => {
        const { vaultContractAddress, tokenRWAContractAddress } = await loadFixture(deployProtocol);
        const vaultContract = await ethers.getContractAt(contracts.VAULT, vaultContractAddress);
        await expect(vaultContract.addHiredInsurance(tokenRWAContractAddress, ZeroAddress, ZeroAddress, 0, 0))
        .to.be.revertedWith("insuranceAddress_ cannot be zero address");
      });
      it("Should revert if insuranceClient_ is zero address", async () => {
        const { vaultContractAddress, tokenRWAContractAddress, tokenInsuranceContractAddress } = await loadFixture(deployProtocol);
        const vaultContract = await ethers.getContractAt(contracts.VAULT, vaultContractAddress);
        await expect(vaultContract.addHiredInsurance(tokenRWAContractAddress, tokenInsuranceContractAddress, ZeroAddress, 0, 0))
        .to.be.revertedWith("insuranceClient_ cannot be zero address");
      });
      it("Should revert if quantity_ is zero value", async () => {
        const { vaultContractAddress, tokenRWAContractAddress, tokenInsuranceContractAddress, protocolAdmin } = await loadFixture(deployProtocol);
        const vaultContract = await ethers.getContractAt(contracts.VAULT, vaultContractAddress);
        await expect(vaultContract.addHiredInsurance(tokenRWAContractAddress, tokenInsuranceContractAddress, protocolAdmin.address, 0, 0))
        .to.be.revertedWith("quantity_ cannot be zero");
      });
      it("Should revert if securedAmount_ is zero value", async () => {
        const { vaultContractAddress, tokenRWAContractAddress, tokenInsuranceContractAddress, protocolAdmin } = await loadFixture(deployProtocol);
        const vaultContract = await ethers.getContractAt(contracts.VAULT, vaultContractAddress);
        await expect(vaultContract.addHiredInsurance(tokenRWAContractAddress, tokenInsuranceContractAddress, protocolAdmin.address, parseEther("1"), 0))
        .to.be.revertedWith("securedAmount_ cannot be zero");
      });
      it("Should revert if vault has no admin access to TokenRWA", async () => {
        const { vaultContractAddress, tokenRWAContractAddress, tokenInsuranceContractAddress, protocolAdmin } = await loadFixture(deployProtocol);
        const tokenRWAContract = await ethers.getContractAt(contracts.TOKEN_RWA, tokenRWAContractAddress);
        const vaultContract = await ethers.getContractAt(contracts.VAULT, vaultContractAddress);
        await expect(vaultContract.addHiredInsurance(tokenRWAContractAddress, tokenInsuranceContractAddress, protocolAdmin.address, parseEther("1"), parseEther("100")))
        .to.be.revertedWithCustomError(tokenRWAContract, "AccessControlUnauthorizedAccount");
      });
    });
    describe('success scenarios', async () => {
      it("Should add hire insurance record", async () => {
        const { vaultContractAddress, tokenRWAContractAddress, tokenInsuranceContractAddress, protocolAdmin } = await loadFixture(deployProtocol);

        // Grant TokenRWA Admin access to Vault
        const tokenRWAContract = await ethers.getContractAt(contracts.TOKEN_RWA, tokenRWAContractAddress);
        await tokenRWAContract.grantAdminRole(vaultContractAddress);

        const vaultContract = await ethers.getContractAt(contracts.VAULT, vaultContractAddress);
        let existsInsuranceClient;

        // Check if client exists
        existsInsuranceClient = await vaultContract.existsInsuranceClient(protocolAdmin.address);
        expect(existsInsuranceClient).to.false;

        // Add hire record
        await vaultContract.addHiredInsurance(tokenRWAContractAddress, tokenInsuranceContractAddress, protocolAdmin.address, parseEther("1"), parseEther("100"));

        // Get insurance details
        const hiredInsurances = await vaultContract.hiredInsurances(tokenRWAContractAddress, protocolAdmin.address);
        const [securedAmount, quantity] = hiredInsurances;
        expect(securedAmount).to.equal(parseEther("100"));
        expect(quantity).to.equal(parseEther("1"));

        // Check if client exists
        existsInsuranceClient = await vaultContract.existsInsuranceClient(protocolAdmin.address);
        expect(existsInsuranceClient).to.true;

        // Check amount holded by asset
        const amountByAsset = await vaultContract.amountByAsset(tokenRWAContractAddress);
        expect(amountByAsset).to.equal(parseEther("100"));
      });
      it("Should update hire record after buying more than once", async () => {
        const { vaultContractAddress, tokenRWAContractAddress, tokenInsuranceContractAddress, protocolAdmin } = await loadFixture(deployProtocol);

        // Grant TokenRWA Admin access to Vault
        const tokenRWAContract = await ethers.getContractAt(contracts.TOKEN_RWA, tokenRWAContractAddress);
        await tokenRWAContract.grantAdminRole(vaultContractAddress);
        
        const vaultContract = await ethers.getContractAt(contracts.VAULT, vaultContractAddress);
        let existsInsuranceClient;

        // Check if client exists
        existsInsuranceClient = await vaultContract.existsInsuranceClient(protocolAdmin.address);
        expect(existsInsuranceClient).to.false;

        // Add hire record
        await vaultContract.addHiredInsurance(tokenRWAContractAddress, tokenInsuranceContractAddress, protocolAdmin.address, parseEther("1"), parseEther("100"));
        
        // Check if client exists
        existsInsuranceClient = await vaultContract.existsInsuranceClient(protocolAdmin.address);
        expect(existsInsuranceClient).to.true;

        // Add hire record
        await vaultContract.addHiredInsurance(tokenRWAContractAddress, tokenInsuranceContractAddress, protocolAdmin.address, parseEther("1"), parseEther("100"));

        // Get insurance details
        const hiredInsurances = await vaultContract.hiredInsurances(tokenRWAContractAddress, protocolAdmin.address);
        const [securedAmount, quantity] = hiredInsurances;
        expect(securedAmount).to.equal(parseEther("200"));
        expect(quantity).to.equal(parseEther("2"));

        // Check if client exists
        existsInsuranceClient = await vaultContract.existsInsuranceClient(protocolAdmin.address);
        expect(existsInsuranceClient).to.true;

        // Check amount holded by asset
        const amountByAsset = await vaultContract.amountByAsset(tokenRWAContractAddress);
        expect(amountByAsset).to.equal(parseEther("200"));
      });
    });
  });
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

  const deployMockUsdc = async () => {
    console.log(" --- Deploying MockUSDC contract --- ");
    const MockUSDC = await ethers.getContractFactory(contracts.MOCK_USDC);
    const mockUSDCContract = await MockUSDC.deploy();
    const mockUSDCContractAddress = await mockUSDCContract.getAddress();
    console.log(`MockUSDC address: ${mockUSDCContract}`);
    return mockUSDCContractAddress;
  };
});
