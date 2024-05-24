// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract Vault is AccessControl, Ownable {

    /// @dev Access control constants
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    /// @notice Maps for each secured RWA an owner with insurance details
    /// @dev This structure only allows to have one insurance per client per RWA
    mapping(address => mapping(address => InsuranceDetails)) public insurances;

    /// @notice Holds the total amount saved by RWA
    mapping(address => uint256) public amountByAsset;

    /// @notice Map each secured RWA with a list of owners
    mapping(address => address[]) public insuranceOwnersByAsset;

    /// @notice Used to avoid insert a client twice
    mapping(address => bool) public insuranceClientCheck;

    struct InsuranceDetails {
        uint256 securedAmount; // value payed by the client
        uint256 quantity; // amount of tokens secured
    }

    constructor() Ownable(msg.sender) {
        _grantRole(ADMIN_ROLE, msg.sender);
    }

    function addInsurance(address securedAsset_, address insuranceClient_, uint256 quantity_, uint256 securedAmount_) external payable onlyRole(ADMIN_ROLE) returns (bool) {
        // CHECK
        require(securedAsset_ != address(0), "securedAsset_ cannot be zero address");
        require(insuranceClient_ != address(0), "insuranceClient_ cannot be zero address");
        require(quantity_ > 0, "_amount cannot be zero");
        require(securedAmount_ > 0, "_amount cannot be zero");

        if (!insuranceClientCheck[insuranceClient_]) {
            insuranceOwnersByAsset[securedAsset_].push(insuranceClient_);
        }
        insuranceClientCheck[insuranceClient_] = true;
        InsuranceDetails memory insuranceDetails = insurances[securedAsset_][insuranceClient_];
        insuranceDetails.quantity += quantity_;
        insuranceDetails.securedAmount += securedAmount_;
        amountByAsset[securedAsset_] += securedAmount_;

        return true;
    }

    function payInsurance(address securedAsset_) internal returns (bool) {
        address[] memory insuranceOwners = insuranceOwnersByAsset[securedAsset_];
        for (uint i = 0; i < insuranceOwners.length; i++) {
            InsuranceDetails memory insuranceDetails = insurances[securedAsset_][insuranceOwners[i]];
            
        }
        return true;
    }

    function payRWAWithYield(address securedAsset_) internal returns (bool) {
        address[] memory insuranceOwners = insuranceOwnersByAsset[securedAsset_];
        for (uint i = 0; i < insuranceOwners.length; i++) {
            InsuranceDetails memory insuranceDetails = insurances[securedAsset_][insuranceOwners[i]];
            
        }
        return true;
    }


    function handleRWAPayment(bool liquidationResponse, address securedAsset_) external returns (bool) {
        if (!liquidationResponse) {
            payInsurance(securedAsset_);
        } else { // This means that the RWA was paid successfully. No Insurance to activate
            // Aqui tiro do balance
            // Valor pago pelo seguro + yield
            payRWAWithYield(securedAsset_);
        }
        return true;
    }

    function withdraw() external onlyRole(ADMIN_ROLE) {
        payable(msg.sender).transfer(address(this).balance);
    }

    /// @notice Set ADMIN role to an address
    /// @param newAdmin a new admin address 
    function grantAdminRole(address newAdmin) external onlyRole(ADMIN_ROLE) {
        require(newAdmin != address(0), "Vault: newAdmin is the zero address");
        _grantRole(ADMIN_ROLE, newAdmin);
    }
}