// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract TokenRWA is ERC20, ERC20Burnable, AccessControl {

    uint public dueDate;
    uint public yield;

    constructor(string memory name_, string memory symbol_, uint256 totalSupply_, uint dueDate_, uint yield_) ERC20(name_, symbol_) {
        require(dueDate_ > block.timestamp, "Token due date must be in the future");
        require(yield_ > 0, "Token yield must be greater than zero");

        dueDate = dueDate_;
        yield = yield_;

        _mint(msg.sender, totalSupply_ * 10 ** decimals());
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

}
