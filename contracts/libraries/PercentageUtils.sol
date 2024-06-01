// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

library PercentageUtils {
    uint256 private constant MIN_PERCENTAGE = 1 * 10 ** 16;
    uint256 private constant MAX_PERCENTAGE = 1 ether;

    function checkPercentageThreshold(uint256 percentage) internal pure returns (bool) {
        return percentage >= MIN_PERCENTAGE && percentage <= MAX_PERCENTAGE;
    }

    function toDecimals(uint256 num, uint8 decimals) internal pure returns (uint256) { 
        return num * 10 ** decimals;
    }
    function toInteger(uint256 num, uint8 decimals) internal pure returns (uint256) {
        return num / 10 ** decimals;
    }
}
