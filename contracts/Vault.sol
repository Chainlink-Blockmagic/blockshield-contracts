// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./interfaces/ITokenInsurance.sol";
import "./interfaces/ITokenRWA.sol";

contract Vault is AccessControl, Ownable {

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
    mapping(address => bool) public insuranceClientCheck;

    struct InsuranceDetails {
        uint256 securedAmount; // value payed by the client
        uint256 quantity; // amount of tokens secured
    }

    event InsurancePaid (address indexed securedAsset_, address indexed insuranceClient_, uint256 quantity_, uint256 securedAmount_, uint256 insuranceCost);
    event RWAYieldPaid (address indexed securedAsset_, address indexed insuranceClient_, uint256 quantity_, uint256 securedAmount_, uint256 insuranceCost);

    constructor() Ownable(msg.sender) {
        _grantRole(ADMIN_ROLE, msg.sender);
    }

    function addHiredInsurance(address securedAsset_, address insuranceClient_, uint256 quantity_, uint256 securedAmount_) external payable onlyRole(ADMIN_ROLE) returns (bool) {
        // CHECK
        require(securedAsset_ != address(0), "securedAsset_ cannot be zero address");
        require(insuranceClient_ != address(0), "insuranceClient_ cannot be zero address");
        require(quantity_ > 0, "_amount cannot be zero");
        require(securedAmount_ > 0, "_amount cannot be zero");

        if (!insuranceClientCheck[insuranceClient_]) {
            insuranceOwnersByAsset[securedAsset_].push(insuranceClient_);
        }
        insuranceClientCheck[insuranceClient_] = true;
        InsuranceDetails memory insuranceDetails = hiredInsurances[securedAsset_][insuranceClient_];
        insuranceDetails.quantity += quantity_;
        insuranceDetails.securedAmount += securedAmount_;
        amountByAsset[securedAsset_] += securedAmount_;

        return true;
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
            else amountToTransfer = (insuranceDetails.securedAmount * ITokenRWA(securedAsset).calculateRWAYield()) - insuranceCost;

            payable(currentInsuranceOwner).transfer(amountToTransfer);

            if (isInsuracePaid) emit InsurancePaid(securedAsset, currentInsuranceOwner, insuranceDetails.quantity, insuranceDetails.securedAmount, insuranceCost);
            else emit RWAYieldPaid(securedAsset, currentInsuranceOwner, insuranceDetails.quantity, insuranceDetails.securedAmount, insuranceCost);
        }
    }

    function getInsuranceCost(ITokenInsurance insuranceContract, uint256 quantity) internal returns (uint256 insuranceCost) {
        uint256 prime = insuranceContract.prime();
        address securedAsset = insuranceContract.securedAsset();
        uint256 rwaValue = ITokenRWA(securedAsset).value();
        uint256 rwaDecimals = ITokenRWA(securedAsset).decimals();
        uint256 insuranceValue = rwaValue * prime / 10 ** rwaDecimals;
        insuranceCost = quantity * insuranceValue / 10 ** rwaDecimals;
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