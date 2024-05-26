// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "hardhat/console.sol";
import "./libraries/PercentageUtils.sol";

contract TokenRWA is ERC20, ERC20Burnable {

    using PercentageUtils for uint256;

    uint256 public dueDate;
    uint256 public yield;
    uint256 public totalValue;
    uint256 public unitValue;

    constructor(string memory name_, string memory symbol_, uint256 totalSupply_, uint256 totalValue_, uint256 dueDate_, uint256 yield_) ERC20(name_, symbol_) {
        require(bytes(name_).length > 0, "TokenRWA: Name cannot be empty");
        require(bytes(symbol_).length > 0, "TokenRWA: Symbol cannot be empty");
        require(bytes(symbol_).length > 3, "TokenRWA: Symbol must be longer than 3 characters");
        require(totalSupply_ > 0, "TokenRWA: Total supply must be greater than zero"); // TODO: This condition must be validated correctly. Something like totalValue_ GREATER THAN 100k
        require(totalValue_ > 0, "TokenRWA: Total value must be greater than zero"); // TODO: This condition must be validated correctly. Something like totalSupply_ GREATER THAN 10k
        
        
        require(dueDate_ > block.timestamp, "TokenRWA: Due date must be in the future");
        require(yield_.checkPercentageThreshold(), "TokenRWA: Invalid yield percentage");

        dueDate = dueDate_;
        yield = yield_;
        totalValue = totalValue_;
        unitValue = totalValue / totalSupply_ * 10 ** decimals();

        // _approve(address(this), vault, totalSupply_);
        // _mint(address(this), totalSupply_);
        _mint(msg.sender, totalSupply_);
    }

    /// @notice Retrieve RWA value into Ethereum through data feed
    function getUnitValue() external view returns (uint256) {
        return unitValue;
    }


    function calculateRWAValuePlusYield() external view returns (uint256) {
        return unitValue + (unitValue * yield / 10 ** decimals());
    }

}