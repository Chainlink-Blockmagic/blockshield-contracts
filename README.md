# blockshield-contracts

# Deploy steps

## Prerequisites

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
| Network | CCIP Lanes available | CCIP with USDC support| Function | Automation |
| :---: | :---: | :---: | :---: | :---: | 
| Polygon Amoy | Avalanche Fuji | x | x | x |
| Polygon Amoy | Arbitrum Sepolia  | x | x | x |
| Polygon Amoy | Optimism Sepolia | x | x | x |
| Polygon Amoy | Ethereum Sepolia | x | x | x |
| Avalanche Fuji | Arbitrum Sepolia | x | x | x |
| Avalanche Fuji | Optimism Sepolia | x | x | x |
| Avalanche Fuji | Polygon Amoy | x | x | x |
| Avalanche Fuji | Ethereum Sepolia | x | x | x |
| Arbitrum Sepolia | Avalanche Fuji | x | x | x |
| Arbitrum Sepolia | Ethereum Sepolia | x | x | x |
| Arbitrum Sepolia | Optimism Sepolia | x | x | x |
| Optimism Sepolia | Avalanche Fuji | x | x | x |
| Optimism Sepolia | Ethereum Sepolia | x | x | x |
| Optimism Sepolia | Arbitrum Sepolia | x | x | x |
| Optimism Sepolia | Polygon Amoy | x | x | x |
| Ethereum Sepolia | Avalanche Fuji | x | x | x |
| Ethereum Sepolia | Arbitrum Sepolia | x | x | x |
| Ethereum Sepolia | Optimism Sepolia | x | x | x |
| Ethereum Sepolia | Polygon Amoy | x | x | x |
