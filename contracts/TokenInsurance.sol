// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FunctionsClient} from "@chainlink/contracts/src/v0.8/functions/v1_0_0/FunctionsClient.sol";
import {ConfirmedOwner} from "@chainlink/contracts/src/v0.8/shared/access/ConfirmedOwner.sol";
import {FunctionsRequest} from "@chainlink/contracts/src/v0.8/functions/v1_0_0/libraries/FunctionsRequest.sol";
import {AutomationCompatibleInterface} from "@chainlink/contracts/src/v0.8/automation/AutomationCompatible.sol";

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "./interfaces/ITokenRWA.sol";
import "./interfaces/IVault.sol";
import "./libraries/PercentageUtils.sol";

contract TokenInsurance is
    ERC20,
    ERC20Burnable,
    ReentrancyGuard,
    AutomationCompatibleInterface,
    FunctionsClient,
    AccessControl
{
    using SafeERC20 for IERC20;
    using PercentageUtils for uint256;
    using FunctionsRequest for FunctionsRequest.Request;

   /// @dev Access control constants
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    /// @notice Vault is the contract who holds the RWAs tokens and waits liquidation
    address public vault;

    /// @notice Is the token related to the warranty
    address public securedAsset;
    
    /// @notice Prime represent the value of the inssurance. It is a percentage applied to the value of the RWA
    uint256 public prime;

    //////////////////////////////////////
    /// Chainlink Automation Variables ///
    //////////////////////////////////////
    /// @notice Used to run the chainlink automation only once
    bool public alreadyExecuted;
    /////////////////////////////////////

    ////////////////////////////////////
    /// Chainlink Function Variables ///
    ////////////////////////////////////
    /// @dev Supported networks https://docs.chain.link/chainlink-functions/supported-networks
    address router;
    bytes32 donID;

    // Callback gas limit
    uint32 gasLimit = 300000;

    /// @notice Used to hold chainlink function information
    /// @dev State variables to store the last request ID, response, and error
    bytes32 public s_lastRequestId;
    bytes public s_lastResponse;
    bytes public s_lastError;

    /// @notice State variable to store the returned RWA Liquidation info
    bool public settled;

    /// @notice Subscription ID of Chainlink function
    uint64 subscriptionId;

    /// @notice Fetchs if a RWA token was liquidated or not
    /// @dev JavaScript source code
    /// @dev Documentation: https://github.com/Chainlink-Blockmagic/blockshield-insurance-service
    string source =
        "const tokenRWASymbol = args[0];"
        "// Execute the API request (Promise)"
        "const apiResponse = await Functions.makeHttpRequest({"
        "    url: `https://blockshield-insurance-service-d541038b7771.herokuapp.com/api/v1/assets/${tokenRWASymbol}/settled`"
        "});"
        "if (apiResponse.error) {"
        "    console.error(apiResponse.error);"
        "    throw Error('Request failed');"
        "}"
        "// Example JSON response"
        "const { data } = apiResponse;"
        "console.log('API response data:', JSON.stringify(data, null, 2));"
        "// Extract the boolean value"
        "const settled = data.settled;"
        "// Convert the boolean to uint8 (false -> 0, true -> 1)"
        "const settledUint8 = settled ? 1 : 0;"
        "// Return encoded message"
        "return Functions.encodeUint256(settledUint8);"
    ;

    // Custom error type
    error UnexpectedRequestID(bytes32 requestId);

    // Event to log responses
    event Response(
        bytes32 indexed requestId,
        bool settled,
        bytes response,
        bytes err
    );
    event Request(
        bytes32 indexed requestId,
        string tokenRWA,
        string symbol
    );
    /////////////////////////////////////

    /// @notice It will mint the total supply of the RWA secured asset to the contract itself
    constructor(string memory name_, string memory symbol_, address securedAsset_, address vault_, uint256 prime_, address router_, bytes32 donID_, uint32 gasLimit_) ERC20(name_, symbol_) FunctionsClient(router_) {
        require(bytes(name_).length > 0, "Name cannot be empty");
        require(bytes(symbol_).length > 0, "Symbol cannot be empty");
        require(bytes(symbol_).length > 3, "Symbol must be longer than 3 characters");
        require(securedAsset_ != address(0), "Secured asset cannot be zero");
        require(vault_ != address(0), "Vault address cannot be zero");
        require(prime_.checkPercentageThreshold(), "Invalid prime percentage");
        require(prime_ < ITokenRWA(securedAsset_).yield(), "Prime must be less than yield");
        require(router_ != address(0), "Router address cannot be zero");
        require(donID_ != bytes32(0), "DonID cannot be empty");
        require(gasLimit_ > 0, "gasLimit_ must be greater than zero");

        vault = vault_;
        securedAsset = securedAsset_;
        prime = prime_;

        router = router_;
        donID = donID_;
        gasLimit = gasLimit_;

        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, address(this));
    }

    function hireInsurance(uint256 quantity_) external payable nonReentrant {
        require(subscriptionId > 0, "subscriptionId_ is not yet configured");
        require(quantity_ > 0, "Cannot secure zero tokens");
        require(quantity_ <= IERC20(securedAsset).totalSupply(), "Cannot secure more than associated RWA supply");
        require(totalSupply() + quantity_ <= IERC20(securedAsset).totalSupply(), "Cannot secure desired amount of tokens");

        //FIXME: Trocar para requerir USDC em lugar de ETH
        uint256 requiredAmount_ = ITokenRWA(securedAsset).unitValue() / 10 ** ITokenRWA(securedAsset).decimals() * quantity_;
        require(msg.value >= requiredAmount_, "Insufficient ETH to hire insurance");
        // TODO: check for possible maximum amount per user

        // Transferir pra uma multisig wallet (ou seja alguma wallet que possamos controlar) a quantidade de Precatorio105 que o cliente compro
         // TODO: Refactor to send tokens through CCIP sendTokens
        // SendMessageCCIP(jasjsajasjas)

        // Mint TokenInsurance desired amount of tokens to msg.sender
        _mint(msg.sender, quantity_);

        ////////////////////////////////////////////////////////////
        // TODO: Refactor to send CCIP message
        // Allow TokenInsurance to spend TokenRWA balance in its behalf
        ITokenRWA(securedAsset).allowSpendTokens(address(this), quantity_);

        // TODO: This call will be in vault logic
        // Transfer TokenRWA amount of tokens to vault
        IERC20(securedAsset).safeTransferFrom(securedAsset, vault, quantity_);

        // Cadastar registro no vault
        IVault(vault).addHiredInsurance(securedAsset, msg.sender, quantity_, requiredAmount_);

        // FIXME: This code will be replaced by a USDC token transfer to Vault through CCIP
        // Pay insurance to vault
        payable(vault).transfer(requiredAmount_);

        // Calculate excess amount
        uint256 excessAmount = msg.value - requiredAmount_;
        if (excessAmount > 0) {
            payable(msg.sender).transfer(excessAmount);
        }
        //////////////////////////////////////////////////////////////////////
    }

    function checkUpkeep(bytes calldata /* checkData */) external view override returns (bool upkeepNeeded, bytes memory performData) {
        upkeepNeeded = !alreadyExecuted && isDueDateArrived();
        performData = new bytes(0);
    }

    function performUpkeep(bytes calldata /* performData */) external override {
        if (!alreadyExecuted && isDueDateArrived()) {
            string[] memory requestData = new string[](1);
            requestData[0] = Strings.toHexString(uint256(uint160(securedAsset)), 20);
            sendRequest(requestData);
            alreadyExecuted = true;
        }
    }

    function isDueDateArrived() internal view returns (bool) {
        return block.timestamp >= ITokenRWA(securedAsset).dueDate();
    }

    function setSubscriptionId(uint64 subscriptionId_) external {
        require(subscriptionId_ > 0, "Cannot secure zero tokens");
        subscriptionId = subscriptionId_;
    }

    /**
     * @notice Sends an HTTP request for character information
     * @param args The arguments to pass to the HTTP request
     * @return requestId The ID of the request
     */
    function sendRequest(string[] memory args) public onlyRole(ADMIN_ROLE) returns (bytes32 requestId) {
        FunctionsRequest.Request memory req;
        req.initializeRequestForInlineJavaScript(source); // Initialize the request with JS code
        if (args.length > 0) req.setArgs(args); // Set the arguments for the request

        // Send the request and store the request ID
        s_lastRequestId = _sendRequest(
            req.encodeCBOR(),
            subscriptionId,
            gasLimit,
            donID
        );

        string memory symbol = ITokenRWA(securedAsset).symbol();
        string memory tokenRWA = Strings.toHexString(uint256(uint160(securedAsset)), 20);
        emit Request(s_lastRequestId, tokenRWA, symbol);

        return s_lastRequestId;
    }

    /**
     * @notice Callback function for fulfilling a request
     * @param requestId The ID of the request to fulfill
     * @param response The HTTP response data
     * @param err Any errors from the Functions request
     */
    function fulfillRequest(
        bytes32 requestId,
        bytes memory response,
        bytes memory err
    ) internal override {
        if (s_lastRequestId != requestId) {
            revert UnexpectedRequestID(requestId); // Check if request IDs match
        }
        // Update the contract's state variables with the response and any errors
        s_lastResponse = response;
        settled = response.length > 0 ? abi.decode(response, (uint256)) == 1 : false;
        s_lastError = err;

        bool liquidationResponse = settled;
        // TODO: CCIP call
        IVault(vault).handleRWAPayment(liquidationResponse, securedAsset);

        // Emit an event to log the response
        emit Response(requestId, settled, s_lastResponse, s_lastError);
    }
}
