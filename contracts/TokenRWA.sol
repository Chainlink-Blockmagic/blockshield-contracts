// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "./libraries/PercentageUtils.sol";

contract TokenRWA is ERC20, ERC20Burnable, AccessControl {
    using PercentageUtils for uint256;

    /// @dev Access control constants
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    uint256 public dueDate;
    uint256 public yield;
    uint256 public totalValue;
    uint256 public unitValue;

    AggregatorV3Interface internal priceFeed;

    ///////////////////
    // Modifiers
    ///////////////////
    modifier moreThanZero(uint256 amount) {
        if (amount == 0) {
            revert TokenRWA__NeedsMoreThanZero();
        }
        _;
    }

    ///////////////////
    // Errors
    ///////////////////
    error TokenRWA__NeedsMoreThanZero();

    constructor(string memory name_, string memory symbol_, uint256 totalSupply_, uint256 totalValue_, uint256 dueDate_, uint256 yield_, address aggregatorNetwork) ERC20(name_, symbol_) {
        require(bytes(name_).length > 0, "TokenRWA: Name cannot be empty");
        require(bytes(symbol_).length > 0, "TokenRWA: Symbol cannot be empty");
        require(bytes(symbol_).length > 3, "TokenRWA: Symbol must be longer than 3 characters");
        require(totalSupply_ > 0, "TokenRWA: Total supply must be greater than zero"); // TODO: This condition must be validated correctly. Something like totalValue_ GREATER THAN 100k
        require(totalValue_ > 0, "TokenRWA: Total value must be greater than zero"); // TODO: This condition must be validated correctly. Something like totalSupply_ GREATER THAN 10k
        require(dueDate_ > block.timestamp, "TokenRWA: Due date must be in the future");
        require(yield_.checkPercentageThreshold(), "TokenRWA: Invalid yield percentage");
        require(aggregatorNetwork != address(0), "TokenRWA: aggregatorNetwork cannot be zero address");

        dueDate = dueDate_;
        yield = yield_;
        totalValue = totalValue_;
        unitValue = totalValue * 10 ** decimals() / totalSupply_;
        priceFeed = AggregatorV3Interface(aggregatorNetwork);

        _grantRole(ADMIN_ROLE, msg.sender);
        _mint(address(this), totalSupply_);
    }

    /**
    * Returns the latest price
    */
    function getChainlinkDataFeedLatestAnswer() public view returns (int) {
        (
            /*uint80 roundID*/,
            int price,
            /*uint startedAt*/,
            /*uint timeStamp*/,
            /*uint80 answeredInRound*/
        ) = priceFeed.latestRoundData();
        return price;
    }

    function usdAmount(uint256 amountETH) moreThanZero(amountETH) public view returns (uint256) {
        // Sent amountETH, how many usd I have
        uint256 ethUsd = uint256(getChainlinkDataFeedLatestAnswer());     // with 8 decimal places
        uint256 amountUSD = amountETH * ethUsd / 10**18;                  //ETH = 18 decimal places
        return amountUSD;
    }

     function ethAmount(uint256 amountUSD) moreThanZero(amountUSD) public view returns (uint256) {
        // Sent amountUSD, how many eth I have
        uint256 ethUsd = uint256(getChainlinkDataFeedLatestAnswer());   // with 8 decimal places
        uint256 amountETH = (amountUSD * 10**18)/ ethUsd;               // ETH = 18 decimal places
        return amountETH;
    }

    /// @notice Retrieve RWA value into Ethereum through data feed
    function getUnitValue() external view returns (uint256) {
        return unitValue;
    }

    function calculateRWAValuePlusYield() external view returns (uint256) {
        return unitValue + (unitValue * yield / 10 ** decimals());
    }

    function allowSpendTokens(address spender, uint256 value) external onlyRole(ADMIN_ROLE) {
        require(spender != address(0), "Spender address cannot be zero");
        _approve(address(this), spender, value);
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
}
