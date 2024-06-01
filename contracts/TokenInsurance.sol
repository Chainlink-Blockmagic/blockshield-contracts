// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";
import {AutomationCompatibleInterface} from "@chainlink/contracts/src/v0.8/automation/AutomationCompatible.sol";
import {FunctionsClient} from "@chainlink/contracts/src/v0.8/functions/v1_0_0/FunctionsClient.sol";
import {ConfirmedOwner} from "@chainlink/contracts/src/v0.8/shared/access/ConfirmedOwner.sol";
import {FunctionsRequest} from "@chainlink/contracts/src/v0.8/functions/v1_0_0/libraries/FunctionsRequest.sol";

// TODO: It brings conflict with supportInterface of CCIP contract inherited by BlockshieldMessageReceiver.sol
// import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import "./libraries/PercentageUtils.sol";
import "./FunctionWithUpdateRequest.sol";
import "./BlockshieldMessageSender.sol";
import "./BlockshieldMessageReceiver.sol";

contract TokenInsurance is
    ERC20,
    ERC20Burnable,
    ReentrancyGuard,
    AutomationCompatibleInterface,
    // AccessControl,
    FunctionWithUpdateRequest,
    BlockshieldMessageSender,
    BlockshieldMessageReceiver
{
    using SafeERC20 for IERC20;
    using PercentageUtils for uint256;
    // using FunctionsRequest for FunctionsRequest.Request;

//    /// @dev Access control constants
//     bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    /// @notice DataFeed aggregator to retrieve price for USD/USDC
    AggregatorV3Interface internal priceFeed;

    /// @notice Vault is the contract who holds the RWAs tokens and waits liquidation
    address public vault;

    /// @notice Prime represent the value of the inssurance. It is a percentage applied to the value of the RWA
    uint256 public prime;

    /// @notice Automation
    bool public alreadyExecuted;

    /// @notice Clients who bought insurance
    address[] insuranceClients;

    /// @notice Is the token related to the warranty
    TokenRWAInfo public tokenRWAInfo;
    struct TokenRWAInfo {
        address securedAsset;
        uint256 totalSupply;
        uint256 totalValue;
        uint256 dueDate;
        string symbol;
        bool isSet;
    }

    event InsuranceHired(bytes32 indexed messageId, address indexed sender, address insurance, uint256 amount);
    event HandlePayment(bytes32 indexed messageId, address indexed securedAsset, bool liquidationResponse);
    event UserPayment(address indexed inusrance, address indexed client, uint256 paymentValue, uint256 totalValue, uint256 insuranceTotalCost);
    event PerformUpkeep(address indexed securedAsset, address indexed insurance);

    ///////////////////
    // Modifiers
    ///////////////////
    modifier moreThanZero(uint256 amount) {
        if (amount == 0) {
            revert TokenInsurance__NeedsMoreThanZero();
        }
        _;
    }

    ///////////////////
    // Errors
    ///////////////////
    error TokenInsurance__NeedsMoreThanZero();

    /// @notice It will mint the total supply of the RWA secured asset to the contract itself
    constructor(
        string memory name_,
        string memory symbol_,
        uint256 prime_,
        address routerFunctions_,
        address routerCCIP_,
        address aggregatorNetwork
    )
        ERC20(name_, symbol_)
        FunctionWithUpdateRequest(routerFunctions_, msg.sender)
        BlockshieldMessageSender(routerCCIP_)
        BlockshieldMessageReceiver(routerCCIP_)
    {
        require(bytes(name_).length > 0, "Name cannot be empty");
        require(bytes(symbol_).length > 0, "Symbol cannot be empty");
        require(bytes(symbol_).length > 3, "Symbol min length is 3");
        require(prime_.checkPercentageThreshold(), "Invalid prime percentage");
        require(aggregatorNetwork != address(0), "TokenInsurance: aggregatorNetwork cannot be zero address");

        prime = prime_;
        priceFeed = AggregatorV3Interface(aggregatorNetwork);

        // _grantRole(ADMIN_ROLE, msg.sender);
        // _grantRole(ADMIN_ROLE, address(this));
    }

    function hireInsurance(uint256 quantity_) external nonReentrant {
        if (transferTokenAddress == address(0)) revert ZeroAddress();
        require(vault != address(0), "vault is not set yet");
        require(tokenRWAInfo.isSet, "tokenRWAInfo is not set yet");
        require(quantity_ > 0, "Invalid quantity");
        require(quantity_ <= tokenRWAInfo.totalSupply, "Quantity is greater than supply");
        require(totalSupply() + quantity_ <= tokenRWAInfo.totalSupply, "Not suficient insurance in stock");

        // Calculate the required amount for insurance payment
        uint256 requiredAmount_ = getRwaTotalValue(quantity_);

        // Validate USDC amount
        require(IERC20(transferTokenAddress).balanceOf(msg.sender) >= requiredAmount_, "Insufficient USDC");
        // TODO: check for possible maximum amount per user

        // Make CCIP call sending USDC from msg.sender and making a contract call
        bytes memory data = abi.encodeWithSignature(
            "addHiredInsurance(address,address,address,uint256,uint256)",
            tokenRWAInfo.securedAsset,
            address(this),
            msg.sender,
            quantity_,
            requiredAmount_
        );
        bytes32 messageId = sendMethodCallWithUSDC(vault, requiredAmount_, data);

        // Mint TokenInsurance desired amount of tokens to msg.sender
        _mint(msg.sender, quantity_);
        insuranceClients.push(msg.sender);

        emit InsuranceHired(messageId, msg.sender, address(this), requiredAmount_);
    }

    function isDueDateArrived() internal view returns (bool) {
        return block.timestamp >= tokenRWAInfo.dueDate;
    }

    function checkUpkeep(bytes calldata /* checkData */) public view override returns (bool upkeepNeeded, bytes memory performData) {
        upkeepNeeded = !alreadyExecuted && isDueDateArrived() && request.length > 0;
        performData = new bytes(0);
    }

    function performUpkeep(bytes calldata /* performData */) external override {
        (bool upkeepNeeded, ) = this.checkUpkeep(abi.encode(""));
        require(upkeepNeeded, "checkUpkeep not met");
        sendGetLiquidationRequest(tokenRWAInfo.securedAsset, tokenRWAInfo.symbol);
        alreadyExecuted = true;
        emit PerformUpkeep(tokenRWAInfo.securedAsset, address(this));
    }

    function callVaultHandleRWAPayment() internal override {
        bool liquidationResponse = s_settled;
        bytes memory data = abi.encodeWithSignature(
            "handleRWAPayment(bool,address,uint256)",
            liquidationResponse,
            tokenRWAInfo.securedAsset,
            prime
        );
        bytes32 messageId = sendMethodCallWithUSDC(vault, 0, data);
        emit HandlePayment(messageId, tokenRWAInfo.securedAsset, liquidationResponse);
    }

    function updateTokenRWADetails(TokenRWAInfo calldata rwa) external onlyOwner {
        if (rwa.securedAsset == address(0)) revert ZeroAddress();
        tokenRWAInfo = rwa;
    }

    function payInsuranceClients() external {
        for (uint i = 0; i < insuranceClients.length; i++) {
            address currentInsuranceOwner = insuranceClients[i];
            uint256 quantity = IERC20(address(this)).balanceOf(currentInsuranceOwner);
            (uint256 totalValue, uint256 insuranceTotalCost) = getUserPaymentAmount(quantity);
            uint256 paymentValue = totalValue - insuranceTotalCost;
            IERC20(transferTokenAddress).safeTransfer(currentInsuranceOwner, paymentValue);
            _burn(currentInsuranceOwner, quantity);
            emit UserPayment(address(this), currentInsuranceOwner, paymentValue, totalValue, insuranceTotalCost);
        }
    }

    function getUserPaymentAmount(uint256 quantity) internal view returns (uint256, uint256) {
        uint256 rwaUnitValue = getRwaUnitValue();
        uint256 paymentTokenDecimals = getPaymentTokenDecimals();
        uint256 insuranceUnitValue = rwaUnitValue * prime / 10 ** paymentTokenDecimals;
        uint256 insuranceTotalCost = quantity * insuranceUnitValue / 10 ** paymentTokenDecimals;
        uint256 totalValue = getRwaTotalValue(quantity);
        return (totalValue, insuranceTotalCost);
    }

    function getRwaTotalValue(uint256 quantity) public view returns (uint256 totalValue) {
        totalValue = getRwaUnitValue() * quantity / 10 ** getPaymentTokenDecimals();
    }

    function approve(address _transferTokenAddress, address _router, uint256 _amount) internal override {
        IERC20(_transferTokenAddress).approve(address(_router), _amount);
    }

    function getRwaUnitValue() public view returns (uint256 unitValue) {
        unitValue = tokenRWAInfo.totalValue * 10 ** getPaymentTokenDecimals() / tokenRWAInfo.totalSupply;
    }

    function getPaymentTokenDecimals() public view returns (uint256 unitValue) {
        return IERC20Metadata(transferTokenAddress).decimals();
    }

    function setVault(address vault_) external onlyOwner {
        if (vault_ != address(0)) {
            vault = vault_;
        }
    }

    /// @notice Returns the last price on network data feed
    function getLatestPrice() public view returns (int) {
        (
            /*uint80 roundID*/,
            int price,
            /*uint startedAt*/,
            /*uint timeStamp*/, 
            /*uint80 answeredInRound*/
        ) = priceFeed.latestRoundData();
        return price;
    }
}
