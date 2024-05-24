// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ITokenRWA {
    function value() external returns (uint256);
    function decimals() external returns (uint256);
}