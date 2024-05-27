const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { expect } = require("chai");
const { parseEther, parseUnits } = require("ethers");
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
      it("Should set name correctly", async function () {
        const { tokenRWAContractAddress } = await loadFixture(deployProtocol);
        const tokenRWAContract = await ethers.getContractAt(contracts.TOKEN_RWA, tokenRWAContractAddress);
        const name = await tokenRWAContract.name();
        expect(name).to.equal("Precatorio 105");
      });
      it("Should set symbol correctly", async function () {
        const { tokenRWAContractAddress } = await loadFixture(deployProtocol);
        const tokenRWAContract = await ethers.getContractAt(contracts.TOKEN_RWA, tokenRWAContractAddress);
        const symbol = await tokenRWAContract.symbol();
        expect(symbol).to.equal("PRECATORIO105");
      });
      it("Should set decimals correctly", async function () {
        const { tokenRWAContractAddress } = await loadFixture(deployProtocol);
        const tokenRWAContract = await ethers.getContractAt(contracts.TOKEN_RWA, tokenRWAContractAddress);
        const decimals = await tokenRWAContract.decimals();
        expect(decimals).to.equal(18);
      });
      it("Should set total supply correctly", async function () {
        const { tokenRWAContractAddress } = await loadFixture(deployProtocol);
        const tokenRWAContract = await ethers.getContractAt(contracts.TOKEN_RWA, tokenRWAContractAddress);
        const totalSupply = await tokenRWAContract.totalSupply(); // 10,000
        expect(totalSupply).to.equal(TEN_THOUSAND);
      });
      it("Should set total value correctly", async function () {
        const { tokenRWAContractAddress } = await loadFixture(deployProtocol);
        const tokenRWAContract = await ethers.getContractAt(contracts.TOKEN_RWA, tokenRWAContractAddress);
        const tokenRWATotalValue = await tokenRWAContract.totalValue(); // 1,000,000
        expect(tokenRWATotalValue).to.equal(ONE_MILLION);
      });
      it("Should set unit value correctly", async function () {
        const { tokenRWAContractAddress } = await loadFixture(deployProtocol);
        const tokenRWAContract = await ethers.getContractAt(contracts.TOKEN_RWA, tokenRWAContractAddress);
        const tokenRWAUnitValue = await tokenRWAContract.unitValue();
        const totalSupply = await tokenRWAContract.totalSupply();
        const tokenRWATotalValue = await tokenRWAContract.totalValue();
        expect(tokenRWAUnitValue).to.equal(BigNumber(tokenRWATotalValue).div(totalSupply).multipliedBy(parseEther("1")));
      });
      it("Should set due date correctly", async function () {
        const { tokenRWAContractAddress } = await loadFixture(deployProtocol);
        const tokenRWAContract = await ethers.getContractAt(contracts.TOKEN_RWA, tokenRWAContractAddress);
        const tokenRWADueDate = await tokenRWAContract.dueDate();
        const TOMORROW = parseUnits(parseInt(NOW_IN_SECS + ONE_DAY_IN_SECS).toString(), 0);
        expect(tokenRWADueDate).to.equal(TOMORROW);
      });
      it("Should set yield correctly", async function () {
        const { tokenRWAContractAddress } = await loadFixture(deployProtocol);
        const tokenRWAContract = await ethers.getContractAt(contracts.TOKEN_RWA, tokenRWAContractAddress);
        const tokenRWAYield = await tokenRWAContract.yield();
        expect(tokenRWAYield).to.equal(parseEther("0.15"));
      });
      it("Should mint total supply of tokens to the contract itself", async function () {
        const { tokenRWAContractAddress } = await loadFixture(deployProtocol);
        const tokenRWAContract = await ethers.getContractAt(contracts.TOKEN_RWA, tokenRWAContractAddress);
        const tokenRWABalance = await tokenRWAContract.balanceOf(tokenRWAContractAddress);
        expect(tokenRWABalance).to.equal(TEN_THOUSAND);
      });
      it("Should grant admin role to deployer", async function () {
        const { tokenRWAContractAddress, protocolAdmin } = await loadFixture(deployProtocol);
        const tokenRWAContract = await ethers.getContractAt(contracts.TOKEN_RWA, tokenRWAContractAddress);
        const adminRole = await tokenRWAContract.ADMIN_ROLE();
        const hasRole = await tokenRWAContract.hasRole(adminRole, protocolAdmin.address);
        expect(hasRole).to.equal(true);
      });
      it("Should calculate the RWA Yield correctly", async function () {
        const { tokenRWAContractAddress } = await loadFixture(deployProtocol);
        const tokenRWAContract = await ethers.getContractAt(contracts.TOKEN_RWA, tokenRWAContractAddress);
  
        const tokenRWAYield = await tokenRWAContract.yield();
        const tokenRWAUnitValue = await tokenRWAContract.unitValue();
        const decimals = await tokenRWAContract.decimals();

        const yieldAmount = await tokenRWAContract.calculateRWAValuePlusYield();
        const expectedYieldAmount = BigNumber(tokenRWAUnitValue).multipliedBy(tokenRWAYield).div(BigNumber(10).pow(decimals));
        expect(yieldAmount).to.equal(BigNumber(tokenRWAUnitValue).plus(expectedYieldAmount)); // Unit value plus yield
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
      it("Should deploy when yield is equals MAX_PERCENTAGE (1)", async () => {
        const TOMORROW = parseUnits(parseInt(NOW_IN_SECS + ONE_DAY_IN_SECS).toString(), 0);
        const TokenRWA = await ethers.getContractFactory(contracts.TOKEN_RWA);
        const tokenRWAContract = await TokenRWA.deploy("Precatorio 105", "PRECATORIO105", TEN_THOUSAND, ONE_MILLION, TOMORROW, parseEther("1"));
        expect(await tokenRWAContract.yield()).to.equal(parseEther("1"));
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
