// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FunctionsClient} from "@chainlink/contracts/src/v0.8/functions/v1_0_0/FunctionsClient.sol";
import {ConfirmedOwner} from "@chainlink/contracts/src/v0.8/shared/access/ConfirmedOwner.sol";
import {FunctionsRequest} from "@chainlink/contracts/src/v0.8/functions/v1_0_0/libraries/FunctionsRequest.sol";

/**
 * @title Functions contract used for Automation
*/
abstract contract FunctionWithUpdateRequest is
    FunctionsClient,
    ConfirmedOwner
{
    uint256 public lastBlockNumber;
    bytes public request;
    uint64 public subscriptionId;
    uint32 public gasLimit;
    bytes32 public donID;
    bytes32 public s_lastRequestId;
    bytes public s_lastResponse;
    bytes public s_lastError;

    bool public s_settled;

    error UnexpectedRequestID(bytes32 requestId);

    // Event to log responses
    event RequestRevertedWithErrorMsg(string reason);
    event RequestRevertedWithoutErrorMsg(bytes data);
    event ApiResponse(bytes32 indexed requestId, bytes response, bytes err, bool settled);
    event ApiRequest(bytes32 indexed requestId, address indexed tokenRWA, string symbol);

    constructor(address router_, address sender_) FunctionsClient(router_) ConfirmedOwner(sender_) {
        require(router_ != address(0), "Function: router_ cannot be zero");
        require(sender_ != address(0), "Function: sender_ cannot be zero");
    }

    function sendGetLiquidationRequest(address tokenRWA, string memory symbol) public {
        try
            i_router.sendRequest(
                subscriptionId,
                request,
                FunctionsRequest.REQUEST_DATA_VERSION,
                gasLimit,
                donID
            )
        returns (bytes32 requestId) {
            s_lastRequestId = requestId;
            emit RequestSent(requestId);
            emit ApiRequest(s_lastRequestId, tokenRWA, symbol);
        } catch Error(string memory reason) {
            emit RequestRevertedWithErrorMsg(reason);
        } catch (bytes memory data) {
            emit RequestRevertedWithoutErrorMsg(data);
        }
    }

    /// @notice Update the request settings
    /// @dev Only callable by the owner of the contract
    /// @param _request The new encoded CBOR request to be set. The request is encoded offchain
    /// @param _subscriptionId The new subscription ID to be set
    /// @param _gasLimit The new gas limit to be set
    /// @param _donID The new job ID to be set
    function updateRequest(
        bytes memory _request,
        uint64 _subscriptionId,
        uint32 _gasLimit,
        bytes32 _donID
    ) external onlyOwner {
        request = _request;
        subscriptionId = _subscriptionId;
        gasLimit = _gasLimit;
        donID = _donID;
    }

    /**
     * @notice Store latest result/error
     * @param requestId The request ID, returned by sendRequest()
     * @param response Aggregated response from the user code
     * @param err Aggregated error from the user code or from the execution pipeline
     * Either response or error parameter will be set, but never both
     */
    function fulfillRequest(
        bytes32 requestId,
        bytes memory response,
        bytes memory err
    ) internal override {
        if (s_lastRequestId != requestId) {
            revert UnexpectedRequestID(requestId);
        }
        s_lastResponse = response;
        s_lastError = err;
        s_settled = response.length > 0 ? abi.decode(response, (uint256)) == 1 : false;

        callVaultHandleRWAPayment();

        emit ApiResponse(requestId, s_lastResponse, s_lastError, s_settled);
    }


    function callVaultHandleRWAPayment() internal virtual;
}
