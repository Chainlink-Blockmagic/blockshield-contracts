// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract TokenInsurance is ERC20, ERC20Burnable, AccessControl {

    /// @notice Is the token related to the warranty
    address securedAsset;

    /// @notice Due date and yield represent the value 
    uint public dueDate;
    uint public yield;

    /// @notice Prime represent the value 
    uint public prime;

    constructor(string memory name_, string memory symbol_, uint256 totalSupply_, uint dueDate_, uint yield_, address securedAsset_, uint prime_) ERC20(name_, symbol_) {
        require(securedAsset_ != address(0), "Invalid address");
        require(dueDate_ > block.timestamp, "Token due date must be in the future.");
        require(yield_ > 0, "Token yield must be greater than zero");
        require(prime_ > 0, "Token prime must be greater than zero");

        securedAsset = securedAsset_;
        dueDate = dueDate_;
        yield = yield_;
        prime = prime_;

        _mint(msg.sender, totalSupply_ * 10 ** decimals());
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

}
