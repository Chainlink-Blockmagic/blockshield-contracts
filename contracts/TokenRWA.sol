// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

contract TokenRWA is ERC20, ERC20Burnable, AccessControl {

    uint public dueDate;
    uint public yield;
    AggregatorV3Interface internal priceFeed;

     ///////////////////
    // Errors
    ///////////////////
    error TokenRWA__NeedsMoreThanZero();   

    constructor(string memory name_, string memory symbol_, uint256 totalSupply_, uint dueDate_, uint yield_) ERC20(name_, symbol_) {
        require(dueDate_ > block.timestamp, "Token due date must be in the future");
        require(yield_ > 0, "Token yield must be greater than zero");
         /**
        * Network: Sepolia
        * Aggregator: ETH/USD
        * Address: 0x694AA1769357215DE4FAC081bf1f309aDC325306
        */
        priceFeed = AggregatorV3Interface(0x694AA1769357215DE4FAC081bf1f309aDC325306);

        dueDate = dueDate_;
        yield = yield_;

        _mint(msg.sender, totalSupply_ * 10 ** decimals());
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);

    }

     ///////////////////
    // Modifiers
    ///////////////////
    modifier moreThanZero(uint256 amount) {
        if (amount == 0) {
            revert TokenRWA__NeedsMoreThanZero();
        }
        _;
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
        //Sent amountETH, how many usd I have
        uint256 ethUsd = uint256(getChainlinkDataFeedLatestAnswer());     //with 8 decimal places
        uint256 amountUSD = amountETH * ethUsd / 10**18;                    //ETH = 18 decimal places      
       return amountUSD;
    }

     function ethAmount(uint256 amountUSD) moreThanZero(amountUSD) public view returns (uint256) {
        //Sent amountUSD, how many eth I have
        uint256 ethUsd = uint256(getChainlinkDataFeedLatestAnswer());       //with 8 decimal places
        uint256 amountETH = (amountUSD * 10**18)/ ethUsd;                    //ETH = 18 decimal places     
       return amountETH;
    }
}
