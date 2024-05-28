// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./TokenInsurance.sol";
import "./TokenRWA.sol";

contract TokenFactory is AccessControl, Ownable {

    /// @dev Access control constants
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    uint public tokenCount;
    SecuredRwa[] public tokens;
    mapping(address => address) public rwaSecured;

    struct SecuredRwa {
        address rwa;
        address insurance;
    }

    event TokenRWADeployed(address indexed tokenAddress, uint256 indexed projectIndex, address deployer);
    event TokenInsuranceDeployed(address indexed tokenAddress, uint256 indexed projectIndex, address deployer);

    constructor() Ownable(msg.sender) {
        tokens.push(SecuredRwa({ rwa: address(0), insurance: address(0) }));
        _grantRole(ADMIN_ROLE, msg.sender);
    }

    function createSecuredRWA(string memory name_, string memory symbol_, uint256 totalSupply_, uint256 totalValue_, uint256 dueDate_, uint256 yield_, uint256 prime_, address vault_, address router_, bytes32 donID_, uint32 gasLimit_) public onlyRole(ADMIN_ROLE) returns (address, address) {
        /**
        * Network: Sepolia
        * Aggregator: ETH/USD
        * Address: 0x694AA1769357215DE4FAC081bf1f309aDC325306
        */
        TokenRWA rwa = new TokenRWA(name_, symbol_, totalSupply_, totalValue_, dueDate_, yield_, 0x694AA1769357215DE4FAC081bf1f309aDC325306);
        TokenInsurance insurance = new TokenInsurance(string(abi.encodePacked("blockshield", name_)), symbol_, address(rwa), vault_, prime_, router_, donID_, gasLimit_);
        SecuredRwa memory item = SecuredRwa({ rwa: address(rwa), insurance: address(insurance) });
        tokens.push(item);
        rwaSecured[address(rwa)] = address(insurance);
        tokenCount += 1;
        emit TokenRWADeployed(address(rwa), tokenCount, msg.sender);
        emit TokenInsuranceDeployed(address(rwa), tokenCount, msg.sender);
       return (address(rwa), address(insurance));
    }

    function getAllTokens() external view onlyRole(ADMIN_ROLE) returns(SecuredRwa[] memory) {
        return tokens;
    }
}