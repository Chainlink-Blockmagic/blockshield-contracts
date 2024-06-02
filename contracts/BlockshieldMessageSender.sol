// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Client} from "@chainlink/contracts-ccip/src/v0.8/ccip/libraries/Client.sol";
import {IRouterClient} from "@chainlink/contracts-ccip/src/v0.8/ccip/interfaces/IRouterClient.sol";
import {LinkTokenInterface} from "@chainlink/contracts/src/v0.8/shared/interfaces/LinkTokenInterface.sol";

/// @title BlockshieldMessageSender
/// @notice Send EVM2AnyMessage CrossChain using CCIP protocol
/// @dev https://docs.chain.link/ccip/supported-networks
abstract contract BlockshieldMessageSender {
    /// @dev Contract variables
    IRouterClient public router;
    LinkTokenInterface public linkToken;

    address public blockshieldOwner;
    uint64 public destinationChainSelector;
    address public linkAddress;
    address public transferTokenAddress;
    address public routerAddress;
    
    /// @dev Custom errors to provide more descriptive revert messages
    /// @dev Used to make sure contract has enough balance to cover the fees
    error NotEnoughBalance(uint256 currentBalance, uint256 calculatedFees);
    /// @dev Revert if address parameter is zero
    error ZeroAddress();
    /// @dev Revert if token balance is zero
    error NothingToWithdraw();

    /// @dev Events to emit onchain
    event MessageSent(
        bytes32 indexed messageId, // The unique ID of the CCIP message.
        uint64 indexed destinationChainSelector, // The chain selector of the destination chain.
        address receiver, // The address of the receiver on the destination chain.
        address token, // The token address that was transferred.
        uint256 tokenAmount, // The token amount that was transferred.
        address feeToken, // the token address used to pay CCIP fees.
        uint256 fees // The fees paid for sending the message.
    );

    /// @dev OnlyOwner modifier function
    modifier onlyBlockshieldOwner() {
        require(msg.sender == blockshieldOwner);
        _;
    }

    /// @param _routerAddress The router address for the sender chain 
    constructor(address _routerAddress) {
        if (_routerAddress == address(0)) revert ZeroAddress();
        blockshieldOwner = msg.sender;
        routerAddress = _routerAddress;
        router = IRouterClient(routerAddress);
    }

    /// @dev Send cross-chain message
    /// @param _destinationReceiverAddress The destination address of the contract receiving the message
    /// @param _amount The amount to send on message
    /// @param _data The encodedWithSignature method and their parameters
    function sendMethodCallWithUSDC(
        address _destinationReceiverAddress, 
        uint256 _amount,
        bytes memory _data
    ) internal virtual returns (bytes32) {
        if (_destinationReceiverAddress == address(0)) revert ZeroAddress();
        Client.EVMTokenAmount[] memory tokenAmounts = new Client.EVMTokenAmount[](1);

        if (_amount > 0) {
            Client.EVMTokenAmount memory tokenAmount = Client.EVMTokenAmount({
                token: transferTokenAddress,
                amount: _amount
            });
            tokenAmounts[0] = tokenAmount;
        }

        Client.EVM2AnyMessage memory message = Client.EVM2AnyMessage({
            receiver: abi.encode(_destinationReceiverAddress),
            data: _data,
            tokenAmounts: tokenAmounts,
            extraArgs: Client._argsToBytes(
                Client.EVMExtraArgsV1({ gasLimit: 980_000 })
            ),
            feeToken: address(linkToken)
        });

        uint256 fees = router.getFee(destinationChainSelector, message);

        if (fees > linkToken.balanceOf(address(this)))
            revert NotEnoughBalance(linkToken.balanceOf(address(this)), fees);
        
        linkToken.approve(routerAddress, fees);

        approve(transferTokenAddress, address(router), _amount);

        bytes32 messageId = router.ccipSend(destinationChainSelector, message);
        
        emit MessageSent(
            messageId,
            destinationChainSelector,
            _destinationReceiverAddress,
            transferTokenAddress,
            _amount,
            address(linkToken),
            fees
        );

        return messageId;
    }

    /// @dev Configure the destination chain properties
    /// @param _destinationChainSelector  The destination chain selector
    /// @param _linkAddress The link token on the sender chain
    /// @param _transferTokenAddress The token that will be sent on message
    function updateSenderCrossChainProperties(
        uint64 _destinationChainSelector,
        address _linkAddress,
        address _transferTokenAddress
    ) external onlyBlockshieldOwner {
        destinationChainSelector = _destinationChainSelector;
        linkAddress = _linkAddress;
        transferTokenAddress = _transferTokenAddress;
        linkToken = LinkTokenInterface(linkAddress);
    }

    /// @dev Retrieve LINK balance of an account
    /// @param account The account to use to get the balance of
    function linkBalance(address account) public view returns (uint256) {
        return linkToken.balanceOf(account);
    }

    function approve(address _transferTokenAddress, address _router, uint256 _amount) internal virtual;

    /// @notice Allows the owner of the contract to withdraw all tokens of a specific ERC20 token.
    /// @dev This function reverts with a 'NothingToWithdraw' error if there are no tokens to withdraw.
    /// @param _beneficiary The address to which the tokens will be sent.
    /// @param _token The contract address of the ERC20 token to be withdrawn.
    function withdrawToken(address _beneficiary,address _token) public virtual;
}
