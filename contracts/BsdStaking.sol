// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.25;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract BSDStaking is Ownable {

    ///////////////////
    // Errors
    ///////////////////
    error BSDStaking__NeedsMoreThanZero();   
    error BSDStaking__TransferFailed();

    // USDC token address
    address public bsdAddress;

    // Staking period in seconds
    uint256 public stakingPeriod;

    // Annual Percentage Yield (APY)
    uint256 public apy;

    // Mapping of user addresses to their staking information
    mapping(address => StakingInfo) public stakingInfo;

    // Struct to store staking information for each user
    struct StakingInfo {
        uint256 amountStaked;
        uint256 stakingTimestamp;
        uint256 rewardsEarned;
    }

    ///////////////////
    // Events
    ///////////////////
    // Event emitted when a user stakes BSD
    event Staked(address indexed user, uint256 amount);

    // Event emitted when a user unstakes BSD
    event Unstaked(address indexed user, uint256 amount);

    // Event emitted when a user claims rewards
    event RewardsClaimed(address indexed user, uint256 amount);

    ///////////////////
    // Modifiers
    ///////////////////
    modifier moreThanZero(uint256 amount) {
        if (amount == 0) {
            revert BSDStaking__NeedsMoreThanZero();
        }
        _;
    }

    constructor(address _bscAddress, uint256 _stakingPeriod, uint256 _apy)  Ownable(msg.sender) {        
        bsdAddress = _bscAddress;
        stakingPeriod = _stakingPeriod;
        apy = _apy;       
    }

    // Function to stake BSD
    function stake(uint256 amount) moreThanZero(amount) public {      

        // Transfer BSD tokens from the user to the contract
        bool success = IERC20(bsdAddress).transferFrom(msg.sender, address(this), amount);
        if (!success) {
            revert BSDStaking__TransferFailed();
        }

        // Update staking information for the user
        StakingInfo storage userStakingInfo = stakingInfo[msg.sender];
        userStakingInfo.amountStaked += amount;
        userStakingInfo.stakingTimestamp = block.timestamp;     

        emit Staked(msg.sender, amount);
    }

    // Function to unstake BSD
    function unstake() public {
        StakingInfo storage userStakingInfo = stakingInfo[msg.sender];
        require(userStakingInfo.amountStaked > 0, "User has no staked BSD");

        // Calculate rewards earned
        uint256 timeStaked = block.timestamp - userStakingInfo.stakingTimestamp;
        uint256 rewardsEarned = calculateRewards(userStakingInfo.amountStaked, timeStaked);

        // Transfer staked BSD tokens back to the user
        bool success = IERC20(bsdAddress).transfer(msg.sender, userStakingInfo.amountStaked);
        if (!success) {
            revert BSDStaking__TransferFailed();
        }

        // Update staking information for the user
        userStakingInfo.amountStaked = 0;
        userStakingInfo.stakingTimestamp = 0;
        userStakingInfo.rewardsEarned += rewardsEarned;

        emit Unstaked(msg.sender, userStakingInfo.amountStaked);
        emit RewardsClaimed(msg.sender, rewardsEarned);
    }

    // Function to claim rewards
    function claimRewards() public {
        StakingInfo storage userStakingInfo = stakingInfo[msg.sender];
        require(userStakingInfo.rewardsEarned > 0, "User has no unclaimed rewards");

        // Transfer rewards to the user
         bool success = IERC20(bsdAddress).transfer(msg.sender, userStakingInfo.rewardsEarned);

        if (!success) {
            revert BSDStaking__TransferFailed();
        }

        // Reset rewards earned
        userStakingInfo.rewardsEarned = 0;

        emit RewardsClaimed(msg.sender, userStakingInfo.rewardsEarned);
    }

    // Function to calculate rewards earned
    function calculateRewards(uint256 amountStaked, uint256 timeStaked) public view returns (uint256) {
        // Calculate daily APY
        uint256 dailyAPY = apy / 365;

        // Calculate rewards earned
        return amountStaked * dailyAPY * timeStaked / 86400;
    }

    // Function to set the staking period
    function setStakingPeriod(uint256 _stakingPeriod) public onlyOwner {
        stakingPeriod = _stakingPeriod;
    }

    // Function to set the APY
    function setAPY(uint256 _apy) public onlyOwner {
        apy = _apy;
    }
}