// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@chainlink/contracts/src/v0.8/automation/AutomationCompatible.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/ITokenRWA.sol";
import "./interfaces/IVault.sol";
import "./libraries/PercentageUtils.sol";

contract TokenInsurance is ERC20, ERC20Burnable, ReentrancyGuard, AutomationCompatibleInterface {
    using SafeERC20 for IERC20;
    using PercentageUtils for uint256;

    /// @notice Vault is the contract who holds the RWAs tokens and waits liquidation
    address public vault;

    /// @notice Is the token related to the warranty
    address public securedAsset;
    
    /// @notice Prime represent the value of the inssurance. It is a percentage applied to the value of the RWA
    uint256 public prime;

    /// @notice Used to run the chainlink automation only once
    bool public alreadyExecuted;

    /// @notice It will mint the total supply of the RWA secured asset to the contract itself
    constructor(string memory name_, string memory symbol_, address securedAsset_, address vault_, uint256 prime_) ERC20(name_, symbol_) {
        require(bytes(name_).length > 0, "Name cannot be empty");
        require(bytes(symbol_).length > 0, "Symbol cannot be empty");
        require(bytes(symbol_).length > 3, "Symbol must be longer than 3 characters");
        require(securedAsset_ != address(0), "Secured asset cannot be zero");
        require(vault_ != address(0), "Vault address cannot be zero");
        require(prime_.checkPercentageThreshold(), "Invalid prime percentage");
        require(prime_ < ITokenRWA(securedAsset_).yield(), "Prime must be less than yield");

        vault = vault_;
        securedAsset = securedAsset_;
        prime = prime_;
    }

    function hireInsurance(uint256 quantity_) external payable nonReentrant {
        require(quantity_ > 0, "Cannot secure zero tokens");
        require(quantity_ <= IERC20(securedAsset).totalSupply(), "Cannot secure more than associated RWA supply");
        require(totalSupply() + quantity_ <= IERC20(securedAsset).totalSupply(), "Cannot secure desired amount of tokens");

        //FIXME: Trocar para requerir USDC em lugar de ETH
        uint256 requiredAmount_ = ITokenRWA(securedAsset).unitValue() / 10 ** ITokenRWA(securedAsset).decimals() * quantity_;
        require(msg.value >= requiredAmount_, "Insufficient ETH to hire insurance");
        // TODO: check for possible maximum amount per user

        // Transferir pra uma multisig wallet (ou seja alguma wallet que possamos controlar) a quantidade de Precatorio105 que o cliente compro
         // TODO: Refactor to send tokens through CCIP sendTokens
        // SendMessageCCIP(jasjsajasjas)

        // Mint TokenInsurance desired amount of tokens to msg.sender
        _mint(msg.sender, quantity_);

        // TODO: Refactor to send CCIP message
        // Allow TokenInsurance to spend TokenRWA balance in its behalf
        ITokenRWA(securedAsset).allowSpendTokens(address(this), quantity_);

        // TODO: This call will be in vault logic
        // Transfer TokenRWA amount of tokens to vault
        IERC20(securedAsset).safeTransferFrom(securedAsset, vault, quantity_);

        // Cadastar registro no vault
        IVault(vault).addHiredInsurance(securedAsset, msg.sender, quantity_, requiredAmount_);

        // FIXME: This code will be replaced by a USDC token transfer to Vault through CCIP
        // Pay insurance to vault
        payable(vault).transfer(requiredAmount_);

        // // Calculate excess amount
        uint256 excessAmount = msg.value - requiredAmount_;
        if (excessAmount > 0) {
            payable(msg.sender).transfer(excessAmount);
        }
    }

    function checkUpkeep(bytes calldata /* checkData */) external view override returns (bool upkeepNeeded, bytes memory performData) {
        upkeepNeeded = !alreadyExecuted && isDueDateArrived();
        performData = new bytes(0);
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
        return block.timestamp >= ITokenRWA(securedAsset).dueDate();
    }

}
