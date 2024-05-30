// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/ITokenInsurance.sol";
import "./interfaces/ITokenRWA.sol";

contract Vault is
    AccessControl,
    Ownable {

    /// @dev Access control constants
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    /// @notice Maps for each secured RWA an owner with insurance details
    /// @dev This structure only allows to have one insurance per client per RWA
    mapping(address => mapping(address => InsuranceDetails)) public hiredInsurances;

    /// @notice Holds the total amount saved by RWA
    mapping(address => uint256) public amountByAsset;

    /// @notice Map each secured RWA with a list of owners
    mapping(address => address[]) public insuranceOwnersByAsset;

    /// @notice Used to avoid insert a client twice
    mapping(address => bool) public existsInsuranceClient;

    struct InsuranceDetails {
        uint256 securedAmount; // value payed by the client
        uint256 quantity; // amount of tokens secured
    }

    event InsurancePaid (address indexed securedAsset_, address indexed insuranceClient_, uint256 quantity_, uint256 securedAmount_, uint256 insuranceCost);
    event RWAYieldPaid (address indexed securedAsset_, address indexed insuranceClient_, uint256 quantity_, uint256 securedAmount_, uint256 insuranceCost);

    constructor() Ownable(msg.sender) {
        _grantRole(ADMIN_ROLE, msg.sender);
    }

    function addHiredInsurance(address securedAsset_, address insuranceClient_, uint256 quantity_, uint256 securedAmount_) external payable onlyRole(ADMIN_ROLE) {
        // CHECK
        require(securedAsset_ != address(0), "securedAsset_ cannot be zero address");
        require(insuranceClient_ != address(0), "insuranceClient_ cannot be zero address");
        require(quantity_ > 0, "quantity_ cannot be zero");
        require(securedAmount_ > 0, "securedAmount_ cannot be zero");
        if (!existsInsuranceClient[insuranceClient_]) {
            insuranceOwnersByAsset[securedAsset_].push(insuranceClient_);
            hiredInsurances[securedAsset_][insuranceClient_] = InsuranceDetails({ quantity: quantity_, securedAmount: securedAmount_ });
        } else {
            InsuranceDetails storage insuranceDetails = hiredInsurances[securedAsset_][insuranceClient_];
            insuranceDetails.quantity += quantity_;
            insuranceDetails.securedAmount += securedAmount_;
        }
        existsInsuranceClient[insuranceClient_] = true;
        amountByAsset[securedAsset_] += securedAmount_;
    }

    function handleRWAPayment(bool liquidationResponse, address insurance) external {
        if (!liquidationResponse) payInsurance(insurance);
        else payRWAWithYield(insurance);
    }

    function payInsurance(address insurance) internal {
        payUser(insurance, false);
    }

    function payRWAWithYield(address insurance) internal {
        payUser(insurance, true);
    }

    function payUser(address insurance, bool isInsuracePaid) internal {
        require(insurance != address(0), "insurance cannot be zero address");

        ITokenInsurance insuranceContract = ITokenInsurance(insurance);
        address securedAsset = insuranceContract.securedAsset();
        address[] memory insuranceOwners = insuranceOwnersByAsset[securedAsset];

        for (uint i = 0; i < insuranceOwners.length; i++) {
            address currentInsuranceOwner = insuranceOwners[i];

            InsuranceDetails memory insuranceDetails = hiredInsurances[securedAsset][currentInsuranceOwner];
            uint256 insuranceCost = getInsuranceCost(insuranceContract, insuranceDetails.quantity);

            uint256 amountToTransfer;
            if (isInsuracePaid) amountToTransfer = insuranceDetails.securedAmount - insuranceCost;
            else amountToTransfer = (insuranceDetails.quantity * ITokenRWA(securedAsset).calculateRWAValuePlusYield()) - insuranceCost;

            payable(currentInsuranceOwner).transfer(amountToTransfer);

            if (isInsuracePaid) emit InsurancePaid(securedAsset, currentInsuranceOwner, insuranceDetails.quantity, insuranceDetails.securedAmount, insuranceCost);
            else emit RWAYieldPaid(securedAsset, currentInsuranceOwner, insuranceDetails.quantity, insuranceDetails.securedAmount, insuranceCost);
        }

        // TODO: SEND CCIP CALL TO TOKEN INSURANCE PRA TokenInsurance#selfdestruct()
    }

    function getInsuranceCost(ITokenInsurance insuranceContract, uint256 quantity) internal returns (uint256 insuranceCost) {
        uint256 prime = insuranceContract.prime();
        address securedAsset = insuranceContract.securedAsset();
        uint256 rwaValue = ITokenRWA(securedAsset).unitValue();
        uint256 rwaDecimals = ITokenRWA(securedAsset).decimals();
        uint256 insuranceValue = rwaValue * prime / 10 ** rwaDecimals;
        insuranceCost = quantity * insuranceValue / 10 ** rwaDecimals;
    }

    function withdraw() external onlyRole(ADMIN_ROLE) {
        payable(msg.sender).transfer(address(this).balance);
    }

    /// @notice Grants the ADMIN_ROLE to an account.
    /// @dev Throw if msg.sender has not ADMIN_ROLE role.
    /// @dev Throw if account is address zero. Message: "TokenInsurance: account is the zero address"
    /// @param account The address to grant the role
    function grantAdminRole(address account) public onlyRole(ADMIN_ROLE) {
        require(account != address(0), "Vault: account is the zero address");
        _grantRole(ADMIN_ROLE, account);
    }

    /// @notice Revokes the ADMIN_ROLE from an account.
    /// @dev Throw if msg.sender has not ADMIN_ROLE role.
    /// @dev Throw if account is address zero. Message: "TokenInsurance: Cannot revoke own admin role"
    /// @param account The address to grant the role
    function revokeAdminRole(address account) public onlyRole(ADMIN_ROLE) {
        require(account != msg.sender, "Vault: Cannot revoke own admin role"); // Prevent self-revocation
        _revokeRole(ADMIN_ROLE, account);
    }

    // Function to receive Ether. msg.data must be empty
    receive() external payable {}

    // Fallback function is called when msg.data is not empty
    fallback() external payable {}
}