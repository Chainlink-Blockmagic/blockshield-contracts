// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../Vault.sol";

contract MockVault is Vault {
    bool private dueDateArrivedMock;

    constructor(
      address routerCCIP_
    ) Vault(routerCCIP_) {}

    function sendMessage(
        address,
        uint256,
        bytes memory
    ) internal pure override returns (bytes32) {
      return keccak256(abi.encodePacked(""));
    }
}