// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../TokenInsurance.sol";
// import "hardhat/console.sol";

contract MockTokenInsurance is TokenInsurance {
    bool private dueDateArrivedMock;

    constructor(
      string memory name_,
      string memory symbol_,
      uint256 prime_,
      address routerFunctions_,
      address routerCCIP_
    ) TokenInsurance(name_, symbol_, prime_, routerFunctions_, routerCCIP_) {}

    function sendMethodCallWithUSDC(
        address,
        uint256,
        bytes memory
    ) internal pure override returns (bytes32) {
      return keccak256(abi.encodePacked(""));
    }

    function sendGetLiquidationRequest(
        address,
        string memory
    ) public override pure {}
}