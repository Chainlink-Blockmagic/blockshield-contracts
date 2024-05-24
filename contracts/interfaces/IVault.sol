// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IVault {
    function addHiredInsurance(address securedAsset, address insuranceClient, uint256 quantity, uint256 securedAmount) external payable returns (bool);
    function handleRWAPayment(bool liquidationResponse, address securedAsset_) external returns (bool);
}