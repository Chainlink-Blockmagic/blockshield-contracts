// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ITokenRWA {
    function symbol() external view returns (string memory);
    function decimals() external view returns (uint256);
    function yield() external view returns (uint256);
    function dueDate() external view returns (uint256);
    function unitValue() external view returns (uint256);
    function calculateRWAValuePlusYield() external view returns (uint256);
    function allowSpendTokens(address spender, uint256 value) external;
}