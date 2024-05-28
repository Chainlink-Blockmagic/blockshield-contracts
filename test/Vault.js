const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { expect } = require("chai");
const { parseEther, parseUnits, keccak256, toUtf8Bytes } = require("ethers");

const contracts = {
  VAULT: "Vault",
  TOKEN_RWA: "TokenRWA",
  TOKEN_INSURANCE: "TokenInsurance",
  TOKEN_FACTORY: "TokenFactory"
};

const NOW_IN_SECS = new Date().getTime() / 1000;
const ONE_YEAR_IN_SECS = 24 * 60 * 60;

const ONE_MILLION = parseEther("1000000");
const TEN_THOUSAND = parseEther("10000");
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const AGGREGATOR_NETWORK_SEPOLIA = "0x694AA1769357215DE4FAC081bf1f309aDC325306";
const ROUTER_ID_AMOY = "0xC22a79eBA640940ABB6dF0f7982cc119578E11De";
const DON_ID_AMOY = keccak256(toUtf8Bytes("0x66756e2d706f6c79676f6e2d6d61696e6e65742d310000000000000000000000"));
const SUBSCRIPTION_ID = 1;

describe("Vault", function () {

  async function deployProtocol() {
    const [protocolAdmin, client] = await ethers.getSigners();
    const tokenRWAContractAddress = await deployTokenRWA();
    const vaultContractAddress = await deployVault();
    const tokenInsuranceContractAddress = await deployTokenInsurance({ vaultAddress: vaultContractAddress, tokenRWAaddress: tokenRWAContractAddress });

    expect(tokenInsuranceContractAddress).to.not.equal(ZERO_ADDRESS);
    expect(vaultContractAddress).to.not.equal(ZERO_ADDRESS);
    expect(tokenRWAContractAddress).to.not.equal(ZERO_ADDRESS);

    const vaultContract = await ethers.getContractAt(contracts.VAULT, vaultContractAddress);
    await vaultContract.grantAdminRole(tokenInsuranceContractAddress);

    const tokenRWAContract = await ethers.getContractAt(contracts.TOKEN_RWA, tokenRWAContractAddress);
    await tokenRWAContract.grantAdminRole(tokenInsuranceContractAddress);

    return {
      protocolAdmin,
      client,
      tokenRWAContractAddress,
      vaultContractAddress,
      tokenInsuranceContractAddress
    };
  }

  describe("Deployment", function () {
    describe('success scenarios', async () => {
      it("Should grant admin role to deployer", async function () {
        const { vaultContractAddress, protocolAdmin } = await loadFixture(deployProtocol);
        const vaultContract = await ethers.getContractAt(contracts.VAULT, vaultContractAddress);
        const adminRole = await vaultContract.ADMIN_ROLE();
        const hasRole = await vaultContract.hasRole(adminRole, protocolAdmin.address);
        expect(hasRole).to.equal(true);
      });
    });
  });

  describe("\n   Add Hire Insurance Record", function () {
    describe('error scenarios', async () => {
      it("Should revert if securedAsset_ is zero address", async () => {
        const { vaultContractAddress } = await loadFixture(deployProtocol);
        const vaultContract = await ethers.getContractAt(contracts.VAULT, vaultContractAddress);
        await expect(vaultContract.addHiredInsurance(ZERO_ADDRESS, ZERO_ADDRESS, 0, 0))
        .to.be.revertedWith("securedAsset_ cannot be zero address");
      });
      it("Should revert if insuranceClient_ is zero address", async () => {
        const { vaultContractAddress, tokenRWAContractAddress } = await loadFixture(deployProtocol);
        const vaultContract = await ethers.getContractAt(contracts.VAULT, vaultContractAddress);
        await expect(vaultContract.addHiredInsurance(tokenRWAContractAddress, ZERO_ADDRESS, 0, 0))
        .to.be.revertedWith("insuranceClient_ cannot be zero address");
      });
      it("Should revert if quantity_ is zero value", async () => {
        const { vaultContractAddress, tokenRWAContractAddress, protocolAdmin } = await loadFixture(deployProtocol);
        const vaultContract = await ethers.getContractAt(contracts.VAULT, vaultContractAddress);
        await expect(vaultContract.addHiredInsurance(tokenRWAContractAddress, protocolAdmin.address, 0, 0))
        .to.be.revertedWith("quantity_ cannot be zero");
      });
      it("Should revert if securedAmount_ is zero value", async () => {
        const { vaultContractAddress, tokenRWAContractAddress, protocolAdmin } = await loadFixture(deployProtocol);
        const vaultContract = await ethers.getContractAt(contracts.VAULT, vaultContractAddress);
        await expect(vaultContract.addHiredInsurance(tokenRWAContractAddress, protocolAdmin.address, parseEther("1"), 0))
        .to.be.revertedWith("securedAmount_ cannot be zero");
      });
    });
    describe('success scenarios', async () => {
      it("Should add hire insurance record", async () => {
        const { vaultContractAddress, tokenRWAContractAddress, protocolAdmin } = await loadFixture(deployProtocol);
        const vaultContract = await ethers.getContractAt(contracts.VAULT, vaultContractAddress);
        let existsInsuranceClient;

        // Check if client exists
        existsInsuranceClient = await vaultContract.existsInsuranceClient(protocolAdmin.address);
        expect(existsInsuranceClient).to.false;

        // Add hire record
        await vaultContract.addHiredInsurance(tokenRWAContractAddress, protocolAdmin.address, parseEther("1"), parseEther("100"));

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
        const { vaultContractAddress, tokenRWAContractAddress, protocolAdmin } = await loadFixture(deployProtocol);
        const vaultContract = await ethers.getContractAt(contracts.VAULT, vaultContractAddress);
        let existsInsuranceClient;

        // Check if client exists
        existsInsuranceClient = await vaultContract.existsInsuranceClient(protocolAdmin.address);
        expect(existsInsuranceClient).to.false;

        // Add hire record
        await vaultContract.addHiredInsurance(tokenRWAContractAddress, protocolAdmin.address, parseEther("1"), parseEther("100"));
        
        // Check if client exists
        existsInsuranceClient = await vaultContract.existsInsuranceClient(protocolAdmin.address);
        expect(existsInsuranceClient).to.true;

        // Add hire record
        await vaultContract.addHiredInsurance(tokenRWAContractAddress, protocolAdmin.address, parseEther("1"), parseEther("100"));

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
  const deployTokenRWA = async () => {
    console.log(" --- Deploying Token RWA contract --- ");
    const TokenRWA = await ethers.getContractFactory(contracts.TOKEN_RWA);
    const TOMORROW = parseUnits(parseInt(NOW_IN_SECS + ONE_YEAR_IN_SECS).toString(), 0);
    const rwa = {
      name: "Precatorio 105",
      symbol: "PRECATORIO105",
      totalSupply: TEN_THOUSAND,
      totalValue: ONE_MILLION,
      yield: parseEther("0.15"), // 15% yield
      dueDate: TOMORROW,
    }
    const tokenRWAContract = await TokenRWA.deploy(rwa.name, rwa.symbol, rwa.totalSupply, rwa.totalValue, rwa.dueDate, rwa.yield, AGGREGATOR_NETWORK_SEPOLIA);
    const tokenRWAContractAddress = await tokenRWAContract.getAddress();
    console.log(`TokenRWA address: ${tokenRWAContractAddress}`);
    return tokenRWAContractAddress;
  };

  const deployVault = async () => {
    console.log(" --- Deploying Vault contract --- ");
    const Vault = await ethers.getContractFactory(contracts.VAULT);
    const vaultContract = await Vault.deploy();
    const vaultContractAddress = await vaultContract.getAddress();
    console.log(`Vault address: ${vaultContractAddress}`);
    return vaultContractAddress;
  };

  const deployTokenInsurance = async ({ vaultAddress, tokenRWAaddress }) => {
    console.log(" --- Deploying Token Insurance contract --- ");
    const TokenInsurance = await ethers.getContractFactory(contracts.TOKEN_INSURANCE);
    const insurance = {
      name: "Precatorio 105",
      symbol: "blockshield.PRECATORIO105",
      yield: parseEther("0.15"), // 15% yield
      prime: parseEther("0.05"), // 5% prime
      securedAsset: tokenRWAaddress,
      vault: vaultAddress,
      router: ROUTER_ID_AMOY, // Polygon Amoy Router
      donId: DON_ID_AMOY, // Polygon Amoy Router
      gasLimit: 300000
    }
    const tokenInsuranceContract = await TokenInsurance.deploy(insurance.name, insurance.symbol, insurance.securedAsset, insurance.vault, insurance.prime, insurance.router, insurance.donId, insurance.gasLimit);
    const tokenInsuranceContractAddress = await tokenInsuranceContract.getAddress();
    console.log(`TokenInsurance address: ${tokenInsuranceContractAddress}`);
    return tokenInsuranceContractAddress;
  };
});
