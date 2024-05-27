// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

library PercentageUtils {
    uint256 private constant MIN_PERCENTAGE = 1 * 10 ** 16;
    uint256 private constant MAX_PERCENTAGE = 1 ether;

    function checkPercentageThreshold(uint256 percentage) internal pure returns (bool) {
        return percentage >= MIN_PERCENTAGE && percentage <= MAX_PERCENTAGE;
    }
}