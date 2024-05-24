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

     function usdAmount(uint256 amountETH) public view returns (uint256) {
        //Sent amountETH, how many usd I have
        uint256 ethUsd = uint256(getChainlinkDataFeedLatestAnswer());     //with 8 decimal places
        uint256 amountUSD = amountETH * ethUsd / 10**18;                    //ETH = 18 decimal places
      //  uint256 amountToken = amountUSD / tokenPrice / 10**(8/2);  //8 decimal places from ETHUSD / 2 decimal places from token
      //  return amountToken;
       return amountUSD;
    }

   

}
