const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { expect } = require("chai");
const { parseEther, parseUnits } = require("ethers");

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

describe("TokenInsurance", function () {

  async function deployProtocol() {
    const [protocolAdmin] = await ethers.getSigners();
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
      tokenRWAContractAddress,
      vaultContractAddress,
      tokenInsuranceContractAddress
    };
  }

  describe("Deployment", function () {
    describe('error scenarios', async () => {
      it("Should revert if name is empty", async () => {
        const TokenInsurance = await ethers.getContractFactory(contracts.TOKEN_INSURANCE);
        await expect(TokenInsurance.deploy("", "PRECATORIO105", ZERO_ADDRESS, ZERO_ADDRESS, 0))
        .to.be.revertedWith("Name cannot be empty");
      });
      it("Should revert if symbol is empty", async () => {
        const TokenInsurance = await ethers.getContractFactory(contracts.TOKEN_INSURANCE);
        await expect(TokenInsurance.deploy("Precatorio 105", "", ZERO_ADDRESS, ZERO_ADDRESS, 0))
        .to.be.revertedWith("Symbol cannot be empty");
      });
      it("Should revert if symbol is less than 3 characters", async () => {
        const TokenInsurance = await ethers.getContractFactory(contracts.TOKEN_INSURANCE);
        await expect(TokenInsurance.deploy("Precatorio 105", "PRE", ZERO_ADDRESS, ZERO_ADDRESS, 0))
        .to.be.revertedWith("Symbol must be longer than 3 characters");
      });
      it("Should revert if securedAsset_ address is zero address", async () => {
        const TokenInsurance = await ethers.getContractFactory(contracts.TOKEN_INSURANCE);
        await expect(TokenInsurance.deploy("Precatorio 105", "blockshield.PRECATORIO105", ZERO_ADDRESS, ZERO_ADDRESS, 0))
        .to.be.revertedWith("Secured asset cannot be zero");
      });
      it("Should revert if vault address is zero address", async () => {
        const [protocolAdmin] = await ethers.getSigners();
        const TokenInsurance = await ethers.getContractFactory(contracts.TOKEN_INSURANCE);
        await expect(TokenInsurance.deploy("Precatorio 105", "blockshield.PRECATORIO105", protocolAdmin.address, ZERO_ADDRESS, 0))
        .to.be.revertedWith("Vault address cannot be zero");
      });
      it("Should revert if prime is zero", async () => {
        const [protocolAdmin] = await ethers.getSigners();
        const TokenInsurance = await ethers.getContractFactory(contracts.TOKEN_INSURANCE);
        await expect(TokenInsurance.deploy("Precatorio 105", "blockshield.PRECATORIO105", protocolAdmin.address, protocolAdmin.address, 0))
        .to.be.revertedWith("Invalid prime percentage");
      });
      it("Should revert if prime is greater than MAX_PERCENTAGE (1)", async () => {
        const [protocolAdmin] = await ethers.getSigners();
        const TokenInsurance = await ethers.getContractFactory(contracts.TOKEN_INSURANCE);
        await expect(TokenInsurance.deploy("Precatorio 105", "blockshield.PRECATORIO105", protocolAdmin.address, protocolAdmin.address, parseEther("1.01")))
        .to.be.revertedWith("Invalid prime percentage");
      });
      it("Should revert if prime is less than MIN_PERCENTAGE (0.01)", async () => {
        const [protocolAdmin] = await ethers.getSigners();
        const TokenInsurance = await ethers.getContractFactory(contracts.TOKEN_INSURANCE);
        await expect(TokenInsurance.deploy("Precatorio 105", "blockshield.PRECATORIO105", protocolAdmin.address, protocolAdmin.address, parseEther("0.009")))
        .to.be.revertedWith("Invalid prime percentage");
      });
      it("Should revert if prime is greater or equals than RWA yield", async () => {
        const [protocolAdmin] = await ethers.getSigners();
        const TokenInsurance = await ethers.getContractFactory(contracts.TOKEN_INSURANCE);
        const tokenRWAContractAddress = await deployTokenRWA();
        await expect(TokenInsurance.deploy("Precatorio 105", "blockshield.PRECATORIO105", tokenRWAContractAddress, protocolAdmin.address, parseEther("0.15")))
        .to.be.revertedWith("Prime must be less than yield");
      });
    });
    describe('success scenarios', async () => {
      it("Should assign vault correctly ", async () => {
        const { vaultContractAddress, tokenInsuranceContractAddress } = await loadFixture(deployProtocol);
        const tokenInsuranceContract = await ethers.getContractAt(contracts.TOKEN_INSURANCE, tokenInsuranceContractAddress);
        expect(await tokenInsuranceContract.vault()).to.equal(vaultContractAddress);
      });
      it("Should assign TokenRWA address to secured asset correctly ", async () => {
        const { tokenRWAContractAddress, tokenInsuranceContractAddress } = await loadFixture(deployProtocol);
        const tokenInsuranceContract = await ethers.getContractAt(contracts.TOKEN_INSURANCE, tokenInsuranceContractAddress);
        expect(await tokenInsuranceContract.securedAsset()).to.equal(tokenRWAContractAddress);
      });
      it("Should assign prime correctly", async () => {
        const { tokenInsuranceContractAddress } = await loadFixture(deployProtocol);
        const tokenInsuranceContract = await ethers.getContractAt(contracts.TOKEN_INSURANCE, tokenInsuranceContractAddress);
        expect(await tokenInsuranceContract.prime()).to.equal(parseEther("0.05"));
      });
      it("Should not mint any tokens of TokenInsurance", async () => {
        const { tokenInsuranceContractAddress } = await loadFixture(deployProtocol);
        const tokenInsuranceContract = await ethers.getContractAt(contracts.TOKEN_INSURANCE, tokenInsuranceContractAddress);
        expect(await tokenInsuranceContract.totalSupply()).to.equal(0);
      });
      it("Should set automation parameter as false", async () => {
        const { tokenInsuranceContractAddress } = await loadFixture(deployProtocol);
        const tokenInsuranceContract = await ethers.getContractAt(contracts.TOKEN_INSURANCE, tokenInsuranceContractAddress);
        expect(await tokenInsuranceContract.alreadyExecuted()).to.be.false;
      });
    });
  });

  describe("\n   Hire Insurance", function () {
    describe('error scenarios', async () => {
      it("Should revert if quantity_ is zero value", async () => {
        const { tokenInsuranceContractAddress } = await loadFixture(deployProtocol);
        const tokenInsuranceContract = await ethers.getContractAt(contracts.TOKEN_INSURANCE, tokenInsuranceContractAddress);
        await expect(tokenInsuranceContract.hireInsurance(0))
        .to.be.revertedWith("Cannot secure zero tokens");
      });
      it("Should revert if quantity_ is greater than RWA total supply", async () => {
        const { tokenInsuranceContractAddress } = await loadFixture(deployProtocol);
        const tokenInsuranceContract = await ethers.getContractAt(contracts.TOKEN_INSURANCE, tokenInsuranceContractAddress);
        await expect(tokenInsuranceContract.hireInsurance(parseEther("10001")))
        .to.be.revertedWith("Cannot secure more than associated RWA supply");
      });
      it("Should revert if quantity_ plus current TokenInsurance supply is greater than RWA total supply", async () => {
        const { tokenInsuranceContractAddress, protocolAdmin } = await loadFixture(deployProtocol);
        const tokenInsuranceContract = await ethers.getContractAt(contracts.TOKEN_INSURANCE, tokenInsuranceContractAddress);
        const ETHBalance = await ethers.provider.getBalance(protocolAdmin.address);

        // To hire insurance for RWA Total Supply it will need a million of ETH
        await tokenInsuranceContract.hireInsurance(parseEther("10000"), { value: parseEther("1000000") }); // Hire all RWA token insurances

        // Hire an extra Insurance
        await expect(tokenInsuranceContract.hireInsurance(parseEther("1")))
        .to.be.revertedWith("Cannot secure desired amount of tokens");
      });
      it("Should revert if ETH amount is less than required amount to hire", async () => {
        const { tokenInsuranceContractAddress } = await loadFixture(deployProtocol);
        const tokenInsuranceContract = await ethers.getContractAt(contracts.TOKEN_INSURANCE, tokenInsuranceContractAddress);
        await expect(tokenInsuranceContract.hireInsurance(parseEther("1")), { value: parseEther("99.99999") })
        .to.be.revertedWith("Insufficient ETH to hire insurance");
      });
    });
    describe('success scenarios', async () => {
      it("Should hire insurance and mint requested insurance tokens to signer", async () => {
        const { tokenInsuranceContractAddress, protocolAdmin } = await loadFixture(deployProtocol);
        const tokenInsuranceContract = await ethers.getContractAt(contracts.TOKEN_INSURANCE, tokenInsuranceContractAddress);
        await expect(tokenInsuranceContract.hireInsurance(parseEther("1"), { value: parseEther("100") }))
        .to.changeTokenBalances(
          tokenInsuranceContract,
          [protocolAdmin],
          [parseEther("1").valueOf()]
        );
      });
      it("Should hire insurance and transfer tokens from TokenRWA to Vault", async () => {
        const { tokenInsuranceContractAddress, tokenRWAContractAddress, vaultContractAddress } = await loadFixture(deployProtocol);
        const vaultContract = await ethers.getContractAt(contracts.VAULT, vaultContractAddress);
        const tokenRWAContract = await ethers.getContractAt(contracts.TOKEN_RWA, tokenRWAContractAddress);
        const tokenInsuranceContract = await ethers.getContractAt(contracts.TOKEN_INSURANCE, tokenInsuranceContractAddress);
        await expect(tokenInsuranceContract.hireInsurance(parseEther("1"), { value: parseEther("100") }))
        .to.changeTokenBalances(
          tokenRWAContract,
          [tokenRWAContract, vaultContract],
          [-parseEther("1").valueOf(), parseEther("1").valueOf()]
        );
      });
      it("Should hire insurance and send ETH from signer to Vault", async () => {
        const { tokenInsuranceContractAddress, vaultContractAddress, protocolAdmin } = await loadFixture(deployProtocol);
        const tokenInsuranceContract = await ethers.getContractAt(contracts.TOKEN_INSURANCE, tokenInsuranceContractAddress);
        await expect(tokenInsuranceContract.hireInsurance(parseEther("1"), { value: parseEther("100") }))
        .to.changeEtherBalances(
          [protocolAdmin, vaultContractAddress],
          [-parseEther("100").valueOf(), parseEther("100").valueOf()]
        );
      });
      it("Should hire insurance and send exact ETH from signer to Vault", async () => {
        const { tokenInsuranceContractAddress, vaultContractAddress, protocolAdmin } = await loadFixture(deployProtocol);
        const tokenInsuranceContract = await ethers.getContractAt(contracts.TOKEN_INSURANCE, tokenInsuranceContractAddress);
        await expect(tokenInsuranceContract.hireInsurance(parseEther("1"), { value: parseEther("105") }))
        .to.changeEtherBalances(
          [protocolAdmin, vaultContractAddress, tokenInsuranceContract],
          [-parseEther("100").valueOf(), parseEther("100").valueOf(), 0]
        );
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
      vault: vaultAddress
    }
    const tokenInsuranceContract = await TokenInsurance.deploy(insurance.name, insurance.symbol, insurance.securedAsset, insurance.vault, insurance.prime);
    const tokenInsuranceContractAddress = await tokenInsuranceContract.getAddress();
    console.log(`TokenInsurance address: ${tokenInsuranceContractAddress}`);
    return tokenInsuranceContractAddress;
  };
});
