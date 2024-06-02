// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// TODO: It brings conflict with supportInterface of CCIP contract inherited by BlockshieldMessageReceiver.sol
// import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./libraries/PercentageUtils.sol";
import "./interfaces/ITokenInsurance.sol";
import "./interfaces/ITokenRWA.sol";
import "./BlockshieldMessageSender.sol";
import "./BlockshieldMessageReceiver.sol";

contract Vault is
    // AccessControl,
    Ownable,
    BlockshieldMessageSender,
    BlockshieldMessageReceiver {

    using SafeERC20 for IERC20;
    using PercentageUtils for uint256;

    // /// @dev Access control constants
    // bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    /// @notice Map each secured RWA it correspondant insurance
    mapping(address => address) public insuranceAddressByRwa;

    /// @notice Maps for each Insurance an owner with insurance details
    /// @dev This structure only allows to have one insurance per client per RWA
    mapping(address => mapping(address => InsuranceDetails)) public hiredInsurances;

    /// @notice Holds the total amount saved by RWA
    mapping(address => uint256) public amountByAsset;

    /// @notice Map each Insurance with a list of owners
    mapping(address => address[]) public insuranceOwnersByInsuranceAddress;

    /// @notice Used to avoid insert a client twice
    /// @dev TokenRWA => TokenInsurance => InsuranceClient => bool
    mapping(address => mapping(address => mapping(address => bool))) public existsInsuranceClient;

    struct InsuranceDetails {
        uint256 securedAmount; // value payed by the client
        uint256 quantity; // amount of tokens secured
    }

    event InsurancePaid (address indexed securedAsset_, address indexed insuranceClient_, uint256 quantity_, uint256 securedAmount_, uint256 insuranceCost);
    event RWAYieldPaid (address indexed securedAsset_, address indexed insuranceClient_, uint256 quantity_, uint256 securedAmount_, uint256 insuranceCost);
    event InsuranceHiringAdded(address indexed securedAsset_, address indexed insuranceClient_, uint256 amount);
    event InsuranceWithoutClients (address indexed securedAsset_);
    event InsuranceTotalPayment(
        bytes32 indexed messageId, // The unique ID of the CCIP message
        address indexed securedAsset_,
        address paymentReceiver,
        uint256 quantity_);

    constructor(
        address routerCCIP_
    )
        Ownable(msg.sender)
        BlockshieldMessageSender(routerCCIP_)
        BlockshieldMessageReceiver(routerCCIP_)
    {
        // _grantRole(ADMIN_ROLE, msg.sender);
    }

    function addHiredInsurance(
        address securedAsset_,
        address insuranceAddress_,
        address insuranceClient_,
        uint256 quantity_,
        uint256 securedAmount_
    ) external {
        // CHECK
        require(securedAsset_ != address(0), "securedAsset_ cannot be zero address");
        require(insuranceAddress_ != address(0), "insuranceAddress_ cannot be zero address");
        require(insuranceClient_ != address(0), "insuranceClient_ cannot be zero address");
        require(quantity_ > 0, "quantity_ cannot be zero");
        require(securedAmount_ > 0, "securedAmount_ cannot be zero");

        if (!existsInsuranceClient[securedAsset_][insuranceAddress_][insuranceClient_]) {
            insuranceOwnersByInsuranceAddress[insuranceAddress_].push(insuranceClient_);
            hiredInsurances[insuranceAddress_][insuranceClient_] = InsuranceDetails({ quantity: quantity_, securedAmount: securedAmount_ });
        } else {
            InsuranceDetails storage insuranceDetails = hiredInsurances[insuranceAddress_][insuranceClient_];
            insuranceDetails.quantity += quantity_;
            insuranceDetails.securedAmount += securedAmount_;
        }
        insuranceAddressByRwa[securedAsset_] = insuranceAddress_;
        existsInsuranceClient[securedAsset_][insuranceAddress_][insuranceClient_] = true;
        amountByAsset[securedAsset_] += securedAmount_;

        // TODO: Refactor to send CCIP message
        // Allow TokenInsurance to spend TokenRWA balance in its behalf
        uint256 tokenBalance = quantity_.toDecimals(ITokenRWA(securedAsset_).decimals());
        ITokenRWA(securedAsset_).allowSpendTokens(address(this), tokenBalance);

        // Transfer tokens from TokenRWA to Vault
        IERC20(securedAsset_).safeTransferFrom(securedAsset_, address(this), tokenBalance);

        emit InsuranceHiringAdded(securedAsset_, insuranceClient_, securedAmount_);
    }

    function handleRWAPayment(bool liquidationResponse, address securedAsset, uint256 insurancePrime) external {
        if (!liquidationResponse) payInsurance(securedAsset, insurancePrime);
        else payRWAWithYield(securedAsset, insurancePrime);
    }

    function payInsurance(address securedAsset, uint256 insurancePrime) internal {
        payUser(securedAsset, false, insurancePrime);
    }

    function payRWAWithYield(address securedAsset, uint256 insurancePrime) internal {
        payUser(securedAsset, true, insurancePrime);
    }

    function payUser(address securedAsset_, bool isInsuracePaid, uint256 insurancePrime) internal {
        require(securedAsset_ != address(0), "insurance cannot be zero address");
        address insuranceAddress_ = insuranceAddressByRwa[securedAsset_];
        address[] memory insuranceOwners = insuranceOwnersByInsuranceAddress[insuranceAddress_];

        uint256 totalAmount;

        for (uint i = 0; i < insuranceOwners.length; i++) {
            address currentInsuranceOwner = insuranceOwners[i];

            InsuranceDetails memory insuranceDetails = hiredInsurances[insuranceAddress_][currentInsuranceOwner];
            uint256 insuranceCost = getTotalInsuranceCostInTokenTransferDecimals(securedAsset_, insurancePrime, insuranceDetails.quantity);

            uint256 amountToTransfer;
            if (isInsuracePaid) amountToTransfer = insuranceDetails.securedAmount - insuranceCost;
            else amountToTransfer = (insuranceDetails.quantity * ITokenRWA(securedAsset_).calculateRWAValuePlusYield()) - insuranceCost;

            totalAmount += amountToTransfer;

            if (isInsuracePaid) emit InsurancePaid(securedAsset_, currentInsuranceOwner, insuranceDetails.quantity, insuranceDetails.securedAmount, insuranceCost);
            else emit RWAYieldPaid(securedAsset_, currentInsuranceOwner, insuranceDetails.quantity, insuranceDetails.securedAmount, insuranceCost);
        }

        if (insuranceOwners.length > 0) {
            bytes32 messageId = sendMessage(
                insuranceAddress_,
                totalAmount,
                abi.encodeWithSignature("payInsuranceClients()")
            );

            emit InsuranceTotalPayment(
                messageId,
                securedAsset_,
                insuranceAddress_,
                totalAmount
            );
        } else {
            emit InsuranceWithoutClients(securedAsset_);
        }
    }

    function getTotalInsuranceCostInTokenTransferDecimals(
        address securedAsset,
        uint256 insurancePrime,
        uint256 quantityToUnit
    ) internal view returns (uint256 insuranceTotalCost) {
        uint8 paymentTokenDecimals = ITokenRWA(securedAsset).getPaymentTokenDecimals();
        uint256 rwaUnitValue = ITokenRWA(securedAsset).getRwaUnitValueInTokenTransferDecimals();
        uint8 rwaDecimals = ITokenRWA(securedAsset).decimals();

        // Convert rwaUnitValue to 18 decimals
        uint8 diffDecimals = rwaDecimals - paymentTokenDecimals;
        uint256 rwaUnitValueIn18Decimals = rwaUnitValue * 10**diffDecimals;

        // Calculate the insurance unit value
        uint256 insuranceUnitValue = (rwaUnitValueIn18Decimals * insurancePrime) / 10**rwaDecimals;

        // Convert the result back to 6 decimals if needed
        uint256 insuranceUnitValueIn6Decimals = insuranceUnitValue / 10**diffDecimals;

        // Total cost
        insuranceTotalCost = quantityToUnit * insuranceUnitValueIn6Decimals;
    }

    function withdraw() external onlyOwner {
        payable(msg.sender).transfer(address(this).balance);
    }

    // /// @notice Grants the ADMIN_ROLE to an account.
    // /// @dev Throw if msg.sender has not ADMIN_ROLE role.
    // /// @dev Throw if account is address zero. Message: "TokenInsurance: account is the zero address"
    // /// @param account The address to grant the role
    // function grantAdminRole(address account) public onlyRole(ADMIN_ROLE) {
    //     require(account != address(0), "Vault: account is the zero address");
    //     _grantRole(ADMIN_ROLE, account);
    // }

    // /// @notice Revokes the ADMIN_ROLE from an account.
    // /// @dev Throw if msg.sender has not ADMIN_ROLE role.
    // /// @dev Throw if account is address zero. Message: "TokenInsurance: Cannot revoke own admin role"
    // /// @param account The address to grant the role
    // function revokeAdminRole(address account) public onlyRole(ADMIN_ROLE) {
    //     require(account != msg.sender, "Vault: Cannot revoke own admin role"); // Prevent self-revocation
    //     _revokeRole(ADMIN_ROLE, account);
    // }

    function approve(address _transferTokenAddress, address _router, uint256 _amount) internal override {
        IERC20(_transferTokenAddress).approve(address(_router), _amount);
    }

    function withdrawToken(address _beneficiary,address _token) public override
    {
        // Retrieve the balance of this contract
        uint256 amount = IERC20(_token).balanceOf(address(this));

        // Revert if there is nothing to withdraw
        if (amount == 0) revert NothingToWithdraw();

        IERC20(_token).safeTransfer(_beneficiary, amount);
    }
}