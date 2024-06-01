# blockshield-contracts


# Prerequisites

### Chainlink CCIP Prerequisites
Select two compatible CCIP networks. Check on lanes in following link [CCIP Testnet Lanes](https://docs.chain.link/ccip/supported-networks/v1_2_0/testnet)

After we selected compatible networks, we will need to filter by those who support USDC transfer tokens. 

To do that:
1. Go to [CCIP Testnet Lanes](https://docs.chain.link/ccip/supported-networks/v1_2_0/testnet)
2. Select a Lane testnet (This will show the compatibility between the selected networks and the destination networks it supports)
3. Scroll down to Transferable tokens table. Here you will find wich tokens are available
4. Look for USDC support.

### Chainlink Functions Prerequisites
We are transferring tokens from Blockchain A to Blockchain B. However we need also to select a **Source Blockchain Network**  that must be compatible with CCIP Functions. So after filtering the pair of blockchains selected for CCIP we will check if our **Source Blockchain Network** is compatible with chainlink functions. 

Check this link [Functions - Supported networks](https://docs.chain.link/chainlink-functions/supported-networks)

### Chainlink Automation
Also we need compatibility for Chainlink Automations in **Source Blockchain Network**. 

So check [Automations - Supported networks](https://docs.chain.link/chainlink-automation/overview/supported-networks)

## Compatible networks
| Network | CCIP Available Lanes | CCIP with USDC support| Function | Automation |
| :---: | :---: | :---: | :---: | :---: | 
| Polygon Amoy      | [Avalanche Fuji, Arbitrum Sepolia, Optimism Sepolia, Ethereum Sepolia              ] | x | x | x |
| Avalanche Fuji    | [                Arbitrum Sepolia, Optimism Sepolia, Ethereum Sepolia, Polygon Amoy] | x | x | x |
| Arbitrum Sepolia  | [Avalanche Fuji,                   Optimism Sepolia, Ethereum Sepolia              ] | x | x | x |
| Optimism Sepolia  | [Avalanche Fuji, Arbitrum Sepolia,                 , Ethereum Sepolia, Polygon Amoy] | x | x | x |
| Ethereum Sepolia  | [Avalanche Fuji, Arbitrum Sepolia, Optimism Sepolia,                 , Polygon Amoy] | x | x | x |

# Deploy steps
1. Deploy Vault in Ethereum Sepolia
  - Send 5 LINK tokens to Vault
2. Deploy TokenRWA in Ethereum Sepolia
  - Set USDC Ethereum Sepolia address: `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238`

3. Create a one Function Subscription in Chainlink [here](https://functions.chain.link/) and use same network used to deploy **TokenInsurance** contract
  - Create the subscription (copy subscription ID)
  - Add LINK funds in the correspondant network
  - Add Consumer: send the **TokenInsurance** contract address (can be added later)

4. Deploy TokenInsurance in Polygon Amoy
  - To use the `AggregatorV3Interface` to retrieve the last price for `USDC/USD` on *Polygon Amoy*, the address is: `0x1b8739bB4CdF0089d07097A9Ae5Bd274b29C6F16`
  - Send 5 LINK tokens to TokenInsurance

Interact with TokenInsurance
5. Execute following methods:
  - updateSenderCrossChainProperties() to provide CCIP needed attributes 
    ```bash
    { _destinationChainSelector: 16015286601757825753, _linkAddress: 0x0Fd9e8d3aF1aaee056EB9e802c3A762a667b1904, _transferTokenAddress (USDC): 0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582 }
    ```
  - setVault() with vault contract address
  - setToken() with tokenRWA contract address
    ```
    struct TokenRWAInfo {
        address securedAsset;
        uint256 totalSupply;
        uint256 totalValue;
        uint256 dueDate;
        string symbol;
        bool isSet;
    }
    ```
    - tuple: ```["0x967B332Dc38F9b40136F715Ca162f945A6fA7eCE",1000000000000000000000000,1000000000000000000000000,1717194614,"PRECATORIO105",true]```
6. Update Function request by script runing the following script
```bash
yarn update-request:amoy <SUBSCRIPTION_ID> <CONSUMER_ADDRESS (TokenInsurance address)> <TOKEN_RWA_SYMBOL>
```

### Links
1. https://faucet.circle.com
2. https://amoy.polygonscan.com
3. https://amoy.polygonscan.com/token/0x41e94eb019c0762f9bfcf9fb1e58725bfb0e7582
4. https://faucets.chain.link/polygon-amoy
