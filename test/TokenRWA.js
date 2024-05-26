const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { expect } = require("chai");
const { parseEther, parseUnits, formatUnits } = require("ethers");
const { BigNumber } = require('bignumber.js');

const contracts = {
  VAULT: "Vault",
  TOKEN_RWA: "TokenRWA",
  TOKEN_INSURANCE: "TokenInsurance",
  TOKEN_FACTORY: "TokenFactory"
};

const NOW_IN_SECS = new Date().getTime() / 1000;
const ONE_DAY_IN_SECS = 24 * 60 * 60;

const ONE_MILLION = parseEther("1000000");
const TEN_THOUSAND = parseEther("10000");

describe("TokenRWA", function () {

  async function deployProtocol() {
    const [protocolAdmin] = await ethers.getSigners();
    const provider = ethers.provider;
    const tokenRWAContractAddress = await deployTokenRWA();
    return {
      protocolAdmin,
      provider,
      tokenRWAContractAddress
    };
  }

  describe("Deployment", function () {
    describe('error scenarios', async () => {
      it("Should revert if name is empty", async () => {
        const TokenRWA = await ethers.getContractFactory(contracts.TOKEN_RWA);
        await expect(TokenRWA.deploy("", "PRECATORIO105", TEN_THOUSAND, ONE_MILLION, parseEther("1"), parseEther("0.15")))
        .to.be.revertedWith("TokenRWA: Name cannot be empty");
      });
      it("Should revert if symbol is empty", async () => {
        const TokenRWA = await ethers.getContractFactory(contracts.TOKEN_RWA);
        await expect(TokenRWA.deploy("Precatorio 105", "", TEN_THOUSAND, ONE_MILLION, 0, 0))
        .to.be.revertedWith("TokenRWA: Symbol cannot be empty");
      });
      it("Should revert if symbol is less than 3 characters", async () => {
        const TokenRWA = await ethers.getContractFactory(contracts.TOKEN_RWA);
        await expect(TokenRWA.deploy("Precatorio 105", "PR", TEN_THOUSAND, ONE_MILLION, parseEther("1"), parseEther("0.15")))
        .to.be.revertedWith("TokenRWA: Symbol must be longer than 3 characters");
      });
      it("Should revert if total supply is zero", async () => {
        const TokenRWA = await ethers.getContractFactory(contracts.TOKEN_RWA);
        await expect(TokenRWA.deploy("Precatorio 105", "PRECATORIO105", 0, ONE_MILLION, parseEther("1"), parseEther("0.15")))
        .to.be.revertedWith("TokenRWA: Total supply must be greater than zero");
      });
      it("Should revert if total value is zero", async () => {
        const TokenRWA = await ethers.getContractFactory(contracts.TOKEN_RWA);
        await expect(TokenRWA.deploy("Precatorio 105", "PRECATORIO105", TEN_THOUSAND, 0, parseEther("1"), parseEther("0.15")))
        .to.be.revertedWith("TokenRWA: Total value must be greater than zero");
      });
      it("Should revert if due date is zero", async () => {
        const TokenRWA = await ethers.getContractFactory(contracts.TOKEN_RWA);
        await expect(TokenRWA.deploy("Precatorio 105", "PRECATORIO105", TEN_THOUSAND, ONE_MILLION, 0, parseEther("0.15")))
        .to.be.revertedWith("TokenRWA: Due date must be in the future");
      });
      it("Should revert if due date is before block timestamp", async () => {
        const YESTERDAY = parseUnits(parseInt(NOW_IN_SECS - ONE_DAY_IN_SECS).toString(), 0);
        const TokenRWA = await ethers.getContractFactory(contracts.TOKEN_RWA);
        await expect(TokenRWA.deploy("Precatorio 105", "PRECATORIO105", TEN_THOUSAND, ONE_MILLION, YESTERDAY, parseEther("0.15")))
        .to.be.revertedWith("TokenRWA: Due date must be in the future");
      });
      it("Should revert if yield is zero", async () => {
        const TOMORROW = parseUnits(parseInt(NOW_IN_SECS + ONE_DAY_IN_SECS).toString(), 0);
        const TokenRWA = await ethers.getContractFactory(contracts.TOKEN_RWA);
        await expect(TokenRWA.deploy("Precatorio 105", "PRECATORIO105", TEN_THOUSAND, ONE_MILLION, TOMORROW, 0))
        .to.be.revertedWith("TokenRWA: Invalid yield percentage");
      });
      it("Should revert if yield is greater than MAX_PERCENTAGE (1)", async () => {
        const TOMORROW = parseUnits(parseInt(NOW_IN_SECS + ONE_DAY_IN_SECS).toString(), 0);
        const TokenRWA = await ethers.getContractFactory(contracts.TOKEN_RWA);
        await expect(TokenRWA.deploy("Precatorio 105", "PRECATORIO105", TEN_THOUSAND, ONE_MILLION, TOMORROW, parseEther("1.01")))
        .to.be.revertedWith("TokenRWA: Invalid yield percentage");
      });
      it("Should revert if yield is less than MIN_PERCENTAGE (0.01)", async () => {
        const TOMORROW = parseUnits(parseInt(NOW_IN_SECS + ONE_DAY_IN_SECS).toString(), 0);
        const TokenRWA = await ethers.getContractFactory(contracts.TOKEN_RWA);
        await expect(TokenRWA.deploy("Precatorio 105", "PRECATORIO105", TEN_THOUSAND, ONE_MILLION, TOMORROW, parseEther("0.009")))
        .to.be.revertedWith("TokenRWA: Invalid yield percentage");
      });
    });
    describe("ok scenarios", function () {
      it("Should deploy token RWA with the right attributes and minting all the token supply to the signer", async function () {
        const { tokenRWAContractAddress, protocolAdmin } = await loadFixture(deployProtocol);
        const tokenRWAContract = await ethers.getContractAt(contracts.TOKEN_RWA, tokenRWAContractAddress);
  
        const name = await tokenRWAContract.name();
        expect(name).to.equal("Precatorio 105");
  
        const symbol = await tokenRWAContract.symbol();
        expect(symbol).to.equal("PRECATORIO105");
  
        const decimals = await tokenRWAContract.decimals();
        console.log(`decimals: ${decimals}`);
        expect(decimals).to.equal(18);
  
        // Set correct total supply
        const totalSupply = await tokenRWAContract.totalSupply(); // 10,000
        console.log(`totalSupply: ${totalSupply}`);
        expect(totalSupply).to.equal(TEN_THOUSAND);
  
        // Mint tokens to Signer
        const tokenRWABalance = await tokenRWAContract.balanceOf(protocolAdmin.address);
        console.log(`tokenRWABalance: ${tokenRWABalance}`);
        expect(tokenRWABalance).to.equal(TEN_THOUSAND);
  
        // Set correct total value
        const tokenRWATotalValue = await tokenRWAContract.totalValue(); // 1,000,000
        console.log(`tokenRWATotalValue: ${tokenRWATotalValue}`);
        expect(tokenRWATotalValue).to.equal(ONE_MILLION);
  
        // Set correct unit value
        const tokenRWAUnitValue = await tokenRWAContract.unitValue();
        console.log(`tokenRWAUnitValue: ${tokenRWAUnitValue}`);
        expect(tokenRWAUnitValue).to.equal(BigNumber(tokenRWATotalValue).div(totalSupply).multipliedBy(parseEther("1")));
  
        const tokenRWADueDate = await tokenRWAContract.dueDate();
        console.log(`tokenRWADueDate: ${tokenRWADueDate}`);
        expect(tokenRWADueDate).to.equal(parseUnits(parseInt(NOW_IN_SECS + ONE_DAY_IN_SECS).toString(), 0));
  
        const tokenRWAYield = await tokenRWAContract.yield();
        console.log(`tokenRWAYield: ${tokenRWAYield}`);
        expect(tokenRWAYield).to.equal(parseEther("0.15"));
      });
      it("Should calculate the RWA Yield correctly", async function () {
        const { tokenRWAContractAddress } = await loadFixture(deployProtocol);
        const tokenRWAContract = await ethers.getContractAt(contracts.TOKEN_RWA, tokenRWAContractAddress);
  
        const tokenRWAYield = await tokenRWAContract.yield();
        console.log(`tokenRWAYield: ${tokenRWAYield}`);
  
        const tokenRWAUnitValue = await tokenRWAContract.unitValue();
        console.log(`tokenRWAUnitValue: ${tokenRWAUnitValue}`);
  
        const yieldAmount = await tokenRWAContract.calculateRWAValuePlusYield();
        console.log(`yieldAmount: ${yieldAmount}`);
        expect(yieldAmount).to.equal(parseEther("115")); // Unit value plus yield
      });
      it("Should deploy token RWA with a correct yield", async () => {
        const TOMORROW = parseUnits(parseInt(NOW_IN_SECS + ONE_DAY_IN_SECS).toString(), 0);
        const TokenRWA = await ethers.getContractFactory(contracts.TOKEN_RWA);
        const tokenRWAContract = await TokenRWA.deploy("Precatorio 105", "PRECATORIO105", TEN_THOUSAND, ONE_MILLION, TOMORROW, parseEther("1"));
        expect(await tokenRWAContract.yield()).to.equal(parseEther("1"));
      });
      it("Should deploy when yield is equals MIN_PERCENTAGE (0.01)", async () => {
        const TOMORROW = parseUnits(parseInt(NOW_IN_SECS + ONE_DAY_IN_SECS).toString(), 0);
        const TokenRWA = await ethers.getContractFactory(contracts.TOKEN_RWA);
        const tokenRWAContract = await TokenRWA.deploy("Precatorio 105", "PRECATORIO105", TEN_THOUSAND, ONE_MILLION, TOMORROW, parseEther("0.01"));
        expect(await tokenRWAContract.yield()).to.equal(parseEther("0.01"));
      });
    });
  });

  const deployTokenRWA = async () => {
    console.log(" --- Deploying Token RWA contract --- ");
    const TokenRWA = await ethers.getContractFactory(contracts.TOKEN_RWA);
    const TOMORROW = parseUnits(parseInt(NOW_IN_SECS + ONE_DAY_IN_SECS).toString(), 0);
    const rwa = {
      name: "Precatorio 105",
      symbol: "PRECATORIO105",
      totalSupply: TEN_THOUSAND,
      totalValue: ONE_MILLION,
      yield: parseEther("0.15"), // 15% yield
      dueDate: TOMORROW,
    }
    const tokenRWAContract = await TokenRWA.deploy(rwa.name, rwa.symbol, rwa.totalSupply, rwa.totalValue, rwa.dueDate, rwa.yield);
    const tokenRWAContractAddress = await tokenRWAContract.getAddress();
    console.log(`TokenRWA address: ${tokenRWAContractAddress}`);
    return tokenRWAContractAddress;
  };
});
