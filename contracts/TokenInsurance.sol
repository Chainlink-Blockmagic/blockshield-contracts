// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@chainlink/contracts/src/v0.8/automation/AutomationCompatible.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/ITokenRWA.sol";
import "./interfaces/IVault.sol";

contract TokenInsurance is ERC20, ERC20Burnable, AccessControl, ReentrancyGuard, AutomationCompatibleInterface {
    using SafeERC20 for IERC20;

    /// @notice Vault is the contract who holds the RWAs tokens and waits liquidation
    address private vault;

    /// @notice Is the token related to the warranty
    address public securedAsset;

    /// @notice Due date and yield represent the value 
    uint public dueDate;
    uint public yield;

    /// @notice Prime represent the value 
    uint public prime;

    /// @notice Used to run the chainlink automation only once
    bool public alreadyExecuted;

    /// @notice It will mint the total supply of the RWA secured asset to the contract itself
    constructor(string memory name_, string memory symbol_, uint dueDate_, uint yield_, address securedAsset_, uint prime_, address vault_) ERC20(name_, symbol_) {
        require(vault_ != address(0), "Vault address cannot be zero address");
        require(securedAsset_ != address(0), "Secured asset cannot be zero address");
        require(dueDate_ > block.timestamp, "Token due date must be in the future.");
        require(yield_ > 0, "Token yield must be greater than zero");
        require(prime_ > 0, "Token prime must be greater than zero");

        vault = vault_;
        securedAsset = securedAsset_;
        dueDate = dueDate_;
        yield = yield_;
        prime = prime_;

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function hireInsurance(uint256 quantity_) external payable nonReentrant returns (bool) {
        require(quantity_ > 0, "Invalid amount of tokens to secure");
        require(quantity_ <= IERC20(securedAsset).totalSupply(), "Invalid amount of tokens to secure");
        require(totalSupply() + quantity_ <= IERC20(securedAsset).totalSupply(), "Insurance supply plus current insurance hiring must be less or equals than secured asset supply");

        //TODO: Mantemos o valor
        uint256 requiredAmount_ = ITokenRWA(securedAsset).value() / ITokenRWA(securedAsset).decimals() * quantity_;
        require(msg.value >= requiredAmount_, "Insufficient ETH to conclude insurance purchase for the desired amount of tokens");
        // TODO: check for possible maximum amount per user

        // Transferir pra uma multisig wallet (ou seja alguma wallet que possamos controlar) a quantidade de Precatorio105 que o cliente compro
        IERC20(securedAsset).safeTransferFrom(address(this), vault, quantity_);
        
        // Mintamos para msg.sender a quantidade de tokens desejados
        _mint(msg.sender, quantity_);

        // Cadastar registro no vault
        IVault(vault).addInsurance(securedAsset, msg.sender, quantity_, requiredAmount_);
        // Pay insurance to vault
        payable(vault).transfer(msg.value);

        // Calculate excess amount
        uint256 excessAmount = msg.value - requiredAmount_;
        if (excessAmount > 0) {
            payable(msg.sender).transfer(excessAmount);
        }
        return true;
    }

    function checkUpkeep(bytes calldata /* checkData */) external view override returns (bool upkeepNeeded, bytes memory /* performData */) {
        upkeepNeeded = !alreadyExecuted && isDueDateArrived();
    }

    function performUpkeep(bytes calldata /* performData */) external override {
        if (!alreadyExecuted && isDueDateArrived()) {
            // TODO: calls function API asking if RWA was paid
            bool liquidationResponse = false;
            IVault(vault).handleRWAPayment(liquidationResponse, securedAsset);
            alreadyExecuted = true;
        }
    }

    function isDueDateArrived() internal view returns (bool) {
        return block.timestamp >= dueDate;
    }

}
