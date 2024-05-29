// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ITokenDeployer {
    function deployTokenRWA(
        string memory name_,
        string memory symbol_,
        uint256 totalSupply_,
        uint256 totalValue_,
        uint256 dueDate_,
        uint256 yield_,
        address aggregatorNetwork_
    ) external returns (address);
    function deployTokenInsurance(
        string memory name_,
        string memory symbol_,
        address rwa_,
        address vault_,
        uint256 prime_,
        address router_,
        bytes32 donID_,
        uint32 gasLimit_
    ) external returns (address);
}