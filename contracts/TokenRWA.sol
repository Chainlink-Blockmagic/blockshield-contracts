// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract TokenRWA is ERC20, ERC20Burnable, AccessControl {

    uint256 public dueDate;
    uint256 public yield;
    uint256 public totalValue;
    uint256 public value;

    constructor(string calldata name_, string calldata symbol_, uint256 totalSupply_, uint256 totalValue_, uint256 dueDate_, uint256 yield_) ERC20(name_, symbol_) {
        require(totalValue_ > 0, "Token total value must be greater than zero");
        require(dueDate_ > block.timestamp, "Token due date must be in the future");
        require(yield_ > 0, "Token yield must be greater than zero");

        dueDate = dueDate_;
        yield = yield_;
        totalValue = totalValue_;
        value = totalValue / totalSupply_ * 10 ** decimals();

        _mint(msg.sender, totalSupply_ * 10 ** decimals());
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    /// @notice Retrieve RWA value into Ethereum through data feed
    function getValue() external view returns (uint256) {
        return value;
    }

    function calculateRWAYield() external view returns (uint256) {
        return value * yield / 10 ** decimals();
    }

}
