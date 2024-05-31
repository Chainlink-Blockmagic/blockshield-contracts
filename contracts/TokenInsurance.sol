// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AutomationCompatibleInterface} from "@chainlink/contracts/src/v0.8/automation/AutomationCompatible.sol";

import {FunctionsClient} from "@chainlink/contracts/src/v0.8/functions/v1_0_0/FunctionsClient.sol";
import {ConfirmedOwner} from "@chainlink/contracts/src/v0.8/shared/access/ConfirmedOwner.sol";
import {FunctionsRequest} from "@chainlink/contracts/src/v0.8/functions/v1_0_0/libraries/FunctionsRequest.sol";

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

import "./libraries/PercentageUtils.sol";
import "./FunctionWithUpdateRequest.sol";
import "./BlockshieldMessageSender.sol";

import "hardhat/console.sol";

contract TokenInsurance is
    ERC20,
    ERC20Burnable,
    ReentrancyGuard,
    AutomationCompatibleInterface,
    AccessControl,
    FunctionWithUpdateRequest,
    BlockshieldMessageSender
{
    using SafeERC20 for IERC20;
    using PercentageUtils for uint256;
    // using FunctionsRequest for FunctionsRequest.Request;

   /// @dev Access control constants
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    /// @notice Vault is the contract who holds the RWAs tokens and waits liquidation
    address public vault;

    /// @notice Is the token related to the warranty
    address public securedAsset;
    
    /// @notice Prime represent the value of the inssurance. It is a percentage applied to the value of the RWA
    uint256 public prime;

    /// @notice Automation
    bool public alreadyExecuted;

    TokenRWAInfo public tokenRWAInfo;
    struct TokenRWAInfo {
        uint256 totalSupply;
        uint256 unitValue;
        uint256 decimals;
        uint256 dueDate;
        string symbol;
    }

    event InsuranceHired(address indexed sender, address insurance, uint256 amount);

    /// @notice It will mint the total supply of the RWA secured asset to the contract itself
    constructor(
        string memory name_,
        string memory symbol_,
        address securedAsset_,
        address vault_,
        uint256 prime_,
        uint256 yield_,
        address routerFunctions_,
        address routerCCIP_
    )
        ERC20(name_, symbol_)
        FunctionWithUpdateRequest(routerFunctions_, msg.sender)
        BlockshieldMessageSender(routerCCIP_)
    {
        require(bytes(name_).length > 0, "Name cannot be empty");
        require(bytes(symbol_).length > 0, "Symbol cannot be empty");
        require(bytes(symbol_).length > 3, "Symbol must be longer than 3 characters");
        require(securedAsset_ != address(0), "Secured asset cannot be zero");
        require(vault_ != address(0), "Vault address cannot be zero");
        require(prime_.checkPercentageThreshold(), "Invalid prime percentage");
        require(yield_.checkPercentageThreshold(), "Prime must be less than yield");
        require(prime_ < yield_, "Prime must be less than yield");

        vault = vault_;
        securedAsset = securedAsset_;
        prime = prime_;

        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, address(this));
    }

    function hireInsurance(uint256 quantity_) external nonReentrant {
        require(quantity_ > 0, "Cannot secure zero tokens");
        require(transferTokenAddress != address(0), "transferTokenAddress cannot be zero address");
        require(quantity_ <= tokenRWAInfo.totalSupply, "Cannot secure more than associated RWA supply");
        require(totalSupply() + quantity_ <= tokenRWAInfo.totalSupply, "Cannot secure desired amount of tokens");

        // Calculate the required amount for insurance payment
        uint256 requiredAmount_ = tokenRWAInfo.unitValue * quantity_ / 10 ** tokenRWAInfo.decimals;

        // Validate USDC amount
        require(IERC20(transferTokenAddress).balanceOf(msg.sender) == requiredAmount_, "Insufficient USDC to hire insurance");
        // TODO: check for possible maximum amount per user

        // Mint TokenInsurance desired amount of tokens to msg.sender
        _mint(msg.sender, quantity_);

        // Make CCIP call sending USDC from msg.sender and making a contract call
        bytes memory data = abi.encodeWithSignature(
            "addHiredInsurance(address,address,uint256,uint256)",
            securedAsset,
            msg.sender,
            quantity_,
            requiredAmount_
        );
        sendMethodCallWithUSDC(requiredAmount_, data);

        emit InsuranceHired(msg.sender, address(this), requiredAmount_);
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
        require(upkeepNeeded, "RWA asset was not yet liquidated or already executed");
        sendGetLiquidationRequest(securedAsset, tokenRWAInfo.symbol);
        alreadyExecuted = true;
    }

    function callVaultHandleRWAPayment() internal override {
        // IVault(vault).handleRWAPayment(liquidationResponse, securedAsset);
        bool liquidationResponse = s_settled;
        bytes memory data = abi.encodeWithSignature(
            "handleRWAPayment(bool,address,uint256)",
            liquidationResponse,
            securedAsset,
            prime
        );
        sendMethodCallWithUSDC(0, data);
    }

    function approve(address _transferTokenAddress, address _router, uint256 _amount) internal override {
        IERC20(_transferTokenAddress).approve(address(_router), _amount);
    }

    function updateTokenRWADetails(TokenRWAInfo calldata rwa) external onlyRole(ADMIN_ROLE) {
        tokenRWAInfo = rwa;
    }
}
