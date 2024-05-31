// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Client} from "@chainlink/contracts-ccip/src/v0.8/ccip/libraries/Client.sol";
import {IERC20} from "@chainlink/contracts-ccip/src/v0.8/vendor/openzeppelin-solidity/v4.8.3/contracts/token/ERC20/IERC20.sol";
import {IRouterClient} from "@chainlink/contracts-ccip/src/v0.8/ccip/interfaces/IRouterClient.sol";
import {LinkTokenInterface} from "@chainlink/contracts/src/v0.8/shared/interfaces/LinkTokenInterface.sol";


/// @title BlockshieldMessageSender
/// @notice Send EVM2AnyMessage CrossChain using CCIP protocol
/// @dev https://docs.chain.link/ccip/supported-networks
contract BlockshieldMessageSender {
    /// @dev Contract variables
    IRouterClient public router;
    LinkTokenInterface public linkToken;
    
    address public owner;
    uint64 public destinationChainSelector;
    address public destinationReceiver;
    address public linkAddress;
    address public transferTokenAddress;
    address public routerAddress;
    
    /// @dev Custom errors to provide more descriptive revert messages
    /// @dev Used to make sure contract has enough balance to cover the fees
    error NotEnoughBalance(uint256 currentBalance, uint256 calculatedFees); 
    /// @dev Used when trying to withdraw but there's nothing to withdraw
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
    modifier onlyOwner() {
        require(msg.sender == owner);
        _;
    }

    constructor(uint64 _destinationChainSelector,
        address _destinationReceiverAddress,
        address _routerAddress,
        address _linkAddress,
        address _transferTokenAddress) 
    {
        owner = msg.sender;
        destinationChainSelector = _destinationChainSelector;
        routerAddress = _routerAddress;
        linkAddress = _linkAddress;
        transferTokenAddress = _transferTokenAddress;

        router = IRouterClient(routerAddress);
        linkToken = LinkTokenInterface(linkAddress);
        
        destinationReceiver = _destinationReceiverAddress;
    }

    /// @dev Send cross-chain message
    /// @param _amount The amount to send on message
    function SendMethodCallWithUSDC(uint256 _amount, bytes calldata data) external returns (bytes32) {
        Client.EVMTokenAmount[] memory tokenAmounts = new Client.EVMTokenAmount[](1);
        Client.EVMTokenAmount memory tokenAmount = Client.EVMTokenAmount({
            token: transferTokenAddress,
            amount: _amount
        });
        tokenAmounts[0] = tokenAmount;

        Client.EVM2AnyMessage memory message = Client.EVM2AnyMessage({
            receiver: abi.encode(destinationReceiver),
            data: data,
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
        IERC20(transferTokenAddress).approve(address(router), _amount);

        bytes32 messageId = router.ccipSend(destinationChainSelector, message);
        
        emit MessageSent(
            messageId,
            destinationChainSelector,
            destinationReceiver,
            transferTokenAddress,
            _amount,
            address(linkToken),
            fees
        );

        return messageId;
    }

    /// @dev Configure the destination chain properties
    /// @param _destinationChainSelector  The destination chain selector
    /// @param _destinationReceiverAddress The destination receiver address
    /// @param _routerAddress The router address for the sender chain 
    /// @param _linkAddress The link token on the sender chain
    /// @param _transferTokenAddress The token that will be sent on message
    function updateSenderCrossChainProperties(
        uint64 _destinationChainSelector,
        address _destinationReceiverAddress,
        address _routerAddress,
        address _linkAddress,
        address _transferTokenAddress
    ) external onlyOwner {
        destinationChainSelector = _destinationChainSelector;
        routerAddress = _routerAddress;
        linkAddress = _linkAddress;
        transferTokenAddress = _transferTokenAddress;

        router = IRouterClient(routerAddress);
        linkToken = LinkTokenInterface(linkAddress);
        
        destinationReceiver = _destinationReceiverAddress;
    }

    /// @dev Retrieve LINK balance of an account
    /// @param account The account to use to get the balance of
    function linkBalance(address account) public view returns (uint256) {
        return linkToken.balanceOf(account);
    }

    /// @dev Accepts ETH transfers
    receive() external payable {}
}
