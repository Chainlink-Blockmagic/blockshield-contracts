// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Client} from "@chainlink/contracts-ccip/src/v0.8/ccip/libraries/Client.sol";
import {CCIPReceiver} from "@chainlink/contracts-ccip/src/v0.8/ccip/applications/CCIPReceiver.sol";

/// @title BlockshieldMessageReceiver
/// @notice Send EVM2AnyMessage CrossChain using CCIP protocol
abstract contract VaultMessageReceiver is CCIPReceiver {
    event InsureCallErrorEvent(
        bytes32 indexed messageId, // The unique ID of the CCIP message.
        address sender, // The address of the sender from the source chain.
        address token, // The token address that was transferred.
        uint256 tokenAmount // The token amount that was transferred.
    );
    event InsureEvent(address indexed _account, uint256 _amount);
    event MessageReceived(
        bytes32 indexed messageId, // The unique ID of the CCIP message.
        address sender, // The address of the sender from the source chain.
        address token, // The token address that was transferred.
        uint256 tokenAmount // The token amount that was transferred.
    );

    bytes32 private s_lastReceivedMessageId;    // Store the last received messageId.
    address private s_lastReceivedTokenAddress; // Store the last received token address.
    uint256 private s_lastReceivedTokenAmount;  // Store the last received amount.
    bytes32 private s_lastReceivedData;         // Store the last received data.

    address public vault;

    constructor(address _router, address vault_) CCIPReceiver(_router) {
        vault = vault_;
    }

    function _ccipReceive(Client.Any2EVMMessage memory message) internal override {
        s_lastReceivedMessageId = message.messageId;

        // (bool success, ) = address(this).call(message.data);
        (bool success, ) = vault.call(message.data);

        s_lastReceivedTokenAddress = message.destTokenAmounts[0].token;
        s_lastReceivedTokenAmount = message.destTokenAmounts[0].amount;
        s_lastReceivedData = message.data;

        if (success) {
            emit MessageReceived(
                s_lastReceivedMessageId,
                abi.decode(message.sender, (address)),
                s_lastReceivedTokenAddress,
                s_lastReceivedTokenAmount,
                s_lastReceivedData
            );
        } else {
            emit InsureCallErrorEvent(
                s_lastReceivedMessageId,
                abi.decode(message.sender, (address)),
                s_lastReceivedTokenAddress,
                s_lastReceivedTokenAmount,
                s_lastReceivedData
            );
            revert();
        }
    }  
}
