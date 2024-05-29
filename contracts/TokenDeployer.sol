// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./TokenRWA.sol";
import "./TokenInsurance.sol";

contract TokenDeployer {

    function deployTokenRWA(
        string memory name_,
        string memory symbol_,
        uint256 totalSupply_,
        uint256 totalValue_,
        uint256 dueDate_,
        uint256 yield_,
        address aggregatorNetwork_
    ) external returns (address) {
        /**
        * Network: Sepolia
        * Aggregator: ETH/USD
        * Address: 0x694AA1769357215DE4FAC081bf1f309aDC325306
        */
        TokenRWA rwa = new TokenRWA(name_, symbol_, totalSupply_, totalValue_, dueDate_, yield_, aggregatorNetwork_);
        return address(rwa);
    }

    function deployTokenInsurance(
        string memory name_,
        string memory symbol_,
        address rwa_,
        address vault_,
        uint256 prime_,
        address router_,
        bytes32 donID_,
        uint32 gasLimit_
    ) external returns (address) {
        TokenInsurance insurance = new TokenInsurance(
            string(abi.encodePacked("blockshield", name_)),
            symbol_,
            rwa_,
            vault_,
            prime_,
            router_,
            donID_,
            gasLimit_
        );
        return address(insurance);
    }
}
