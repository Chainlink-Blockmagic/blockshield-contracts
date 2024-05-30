// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IRWALiquidationFunctionWithUpdateRequest {
    function sendRequest(address tokenRWA, string memory symbol) external;
}