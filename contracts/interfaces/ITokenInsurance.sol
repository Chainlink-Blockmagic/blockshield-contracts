// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ITokenInsurance {
    function prime() external returns (uint256);
    function securedAsset() external returns (address);
}