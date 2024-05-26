// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ITokenRWA {
    function unitValue() external view returns (uint256);
    function decimals() external view returns (uint256);
    function yield() external view returns (uint256);
    function dueDate() external view returns (uint256);
    function calculateRWAValuePlusYield() external view returns (uint256);
}