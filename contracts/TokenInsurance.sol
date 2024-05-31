// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AutomationCompatibleInterface} from "@chainlink/contracts/src/v0.8/automation/AutomationCompatible.sol";

import {FunctionsClient} from "@chainlink/contracts/src/v0.8/functions/v1_0_0/FunctionsClient.sol";
import {ConfirmedOwner} from "@chainlink/contracts/src/v0.8/shared/access/ConfirmedOwner.sol";
import {FunctionsRequest} from "@chainlink/contracts/src/v0.8/functions/v1_0_0/libraries/FunctionsRequest.sol";

// TODO: It brings conflict with supportInterface of CCIP contract inherited by BlockshieldMessageReceiver.sol
// import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
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

    /// @notice Vault is the contract who holds the RWAs tokens and waits liquidation
    address public vault;

    /// @notice Is the token related to the warranty
    address public securedAsset;
    
    /// @notice Prime represent the value of the inssurance. It is a percentage applied to the value of the RWA
    uint256 public prime;

    /// @notice Automation
    bool public alreadyExecuted;

    /// @notice Clients who bought insurance
    address[] insuranceClients;

    TokenRWAInfo public tokenRWAInfo;
    struct TokenRWAInfo {
        uint256 totalSupply;
        uint256 unitValue;
        uint256 decimals;
        uint256 dueDate;
        string symbol;
        bool isSet;
    }

    event InsuranceHired(bytes32 indexed messageId, address indexed sender, address insurance, uint256 amount);
    event HandlePayment(bytes32 indexed messageId, address indexed securedAsset, bool liquidationResponse);
    event UserPayment(address indexed inusrance, address indexed client, uint256 paymentValue, uint256 totalValue, uint256 insuranceTotalCost);
    event PerformUpkeep(address indexed securedAsset, address indexed insurance);

    /// @notice It will mint the total supply of the RWA secured asset to the contract itself
    constructor(
        string memory name_,
        string memory symbol_,
        address securedAsset_,
        address vault_,
        uint256 prime_,
        address routerFunctions_,
        address routerCCIP_
    )
        ERC20(name_, symbol_)
        FunctionWithUpdateRequest(routerFunctions_, msg.sender)
        BlockshieldMessageSender(routerCCIP_)
        BlockshieldMessageReceiver(routerCCIP_)
    {
        require(bytes(name_).length > 0, "Name cannot be empty");
        require(bytes(symbol_).length > 0, "Symbol cannot be empty");
        require(bytes(symbol_).length > 3, "Symbol min length is 3");
        if (securedAsset_ == address(0)) revert ZeroAddress();
        if (vault_ == address(0)) revert ZeroAddress();
        require(prime_.checkPercentageThreshold(), "Invalid prime percentage");

        vault = vault_;
        securedAsset = securedAsset_;
        prime = prime_;

        // _grantRole(ADMIN_ROLE, msg.sender);
        // _grantRole(ADMIN_ROLE, address(this));
    }

    function hireInsurance(uint256 quantity_) external nonReentrant {
        if (transferTokenAddress == address(0)) revert ZeroAddress();
        require(tokenRWAInfo.isSet, "tokenRWAInfo is not set yet");
        require(quantity_ > 0, "Invalid quantity");
        require(quantity_ <= tokenRWAInfo.totalSupply, "Quantity is greater than supply");
        require(totalSupply() + quantity_ <= tokenRWAInfo.totalSupply, "Not suficient insurance in stock");

        // Calculate the required amount for insurance payment
        uint256 requiredAmount_ = getRwaTotalValue(quantity_);

        // Validate USDC amount
        require(IERC20(transferTokenAddress).balanceOf(msg.sender) == requiredAmount_, "Insufficient USDC");
        // TODO: check for possible maximum amount per user

        // Make CCIP call sending USDC from msg.sender and making a contract call
        bytes memory data = abi.encodeWithSignature(
            "addHiredInsurance(address,address,address,uint256,uint256)",
            securedAsset,
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
        sendGetLiquidationRequest(securedAsset, tokenRWAInfo.symbol);
        alreadyExecuted = true;
        emit PerformUpkeep(securedAsset, address(this));
    }

    function callVaultHandleRWAPayment() internal override {
        bool liquidationResponse = s_settled;
        bytes memory data = abi.encodeWithSignature(
            "handleRWAPayment(bool,address,uint256)",
            liquidationResponse,
            securedAsset,
            prime
        );
        bytes32 messageId = sendMethodCallWithUSDC(vault, 0, data);
        emit HandlePayment(messageId, securedAsset, liquidationResponse);
    }

    function updateTokenRWADetails(TokenRWAInfo calldata rwa) external onlyOwner {
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
        uint256 rwaUnitValue = tokenRWAInfo.unitValue;
        uint256 rwaDecimals = tokenRWAInfo.decimals;
        uint256 insuranceUnitValue = rwaUnitValue * prime / 10 ** rwaDecimals;
        uint256 insuranceTotalCost = quantity * insuranceUnitValue / 10 ** rwaDecimals;
        uint256 totalValue = getRwaTotalValue(quantity);
        return (totalValue, insuranceTotalCost);
    }

    function getRwaTotalValue(uint256 quantity) public view returns (uint256 totalValue) {
        totalValue = tokenRWAInfo.unitValue * quantity / 10 ** tokenRWAInfo.decimals;
    }

    function setVault(address vault_) external onlyOwner {
        if (vault_ != address(0)) {
            vault = vault_;
        }
    }

    function setSecuredAsset(address securedAsset_) external onlyOwner {
        if (securedAsset_ != address(0)) {
            securedAsset = securedAsset_;
        }
    }

    function approve(address _transferTokenAddress, address _router, uint256 _amount) internal override {
        IERC20(_transferTokenAddress).approve(address(_router), _amount);
    }
}
