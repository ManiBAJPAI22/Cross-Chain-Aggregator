# Cross-Chain Aggregator

A sophisticated cross-chain DeFi aggregator that enables seamless token swaps and transfers between Optimism and Osmosis using Axelar Bridge. This project implements advanced pathfinding algorithms to find optimal trading routes across multiple chains and liquidity pools.

## 🚀 Overview

The Cross-Chain Aggregator is a comprehensive DeFi solution that bridges the gap between Ethereum Layer 2 (Optimism) and Cosmos (Osmosis) ecosystems. It leverages Axelar's cross-chain infrastructure to enable users to:

- **Cross-chain token transfers** between Optimism and Osmosis
- **Optimal route finding** using advanced pathfinding algorithms
- **Multi-path trading** to minimize slippage and maximize returns
- **Real-time pool data aggregation** from multiple sources
- **Graph database integration** for complex relationship mapping

## 🏗️ Architecture

### Core Components

#### 1. **Chain Aggregators**

- **CosmosAggregator** (`src/cosmos/cosmos.ts`): Handles Osmosis DEX operations
- **OptimismAggregator** (`src/optimism/optimism.ts`): Manages Optimism Uniswap V3 operations

#### 2. **Cross-Chain Bridge**

- **AxelarBridge** (`src/axelar/AxelarBridge.ts`): Facilitates cross-chain transfers using Axelar Network

#### 3. **Wallet Management**

- **CosmosWallet** (`src/cosmos/wallet.ts`): Manages Osmosis wallet operations
- **OptimismWallet** (`src/optimism/wallet.ts`): Handles Optimism wallet functionality

#### 4. **Cross-Chain Operations**

- **CosmosCrossChain** (`src/cosmos/CosmosCrossChain.ts`): Orchestrates Osmosis cross-chain operations
- **OptimismCrossChain** (`src/optimism/OptimismCrossChain.ts`): Manages Optimism cross-chain operations

#### 5. **Smart Contracts**

- **OptimismReceiver** (`scripts/contracts/OptimismReceiver.sol`): Receives cross-chain transfers on Optimism

### Data Flow

```
User Request → Chain Aggregator → Pathfinding Algorithm → Multi-Path Execution → Cross-Chain Bridge → Destination Chain
```

## 🛠️ Technology Stack

### Core Technologies

- **TypeScript/JavaScript**: Primary development language
- **Ethers.js**: Ethereum/Optimism blockchain interaction
- **CosmJS**: Cosmos blockchain interaction
- **Axelar SDK**: Cross-chain bridge functionality

### Blockchain Networks

- **Optimism**: Ethereum Layer 2 scaling solution
- **Osmosis**: Cosmos-based DEX with AMM functionality
- **Axelar Network**: Cross-chain communication protocol

### Data Storage

- **Neo4j**: Graph database for relationship mapping and pathfinding
- **GraphQL**: Subgraph queries for Optimism pool data

### Development Tools

- **Hardhat**: Ethereum development environment
- **Node.js**: Runtime environment
- **BigNumber.js**: Precise decimal arithmetic

## 📋 Prerequisites

Before running this project, ensure you have:

- **Node.js** (v16 or higher)
- **npm** or **yarn** package manager
- **Neo4j Database** (local or cloud instance)
- **Axelar API Key** (for cross-chain operations)
- **Private Keys/Mnemonics** for both Optimism and Osmosis wallets

## 🔧 Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/ManiBAJPAI22/cross-chain-integration.git
   cd cross-chain-integration
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env` file in the root directory:

   ```env
   # Neo4j Database Configuration
   NEO4J_URI=bolt://localhost:7687
   NEO4J_USERNAME=neo4j
   NEO4J_PASSWORD=your_password

   # Wallet Configuration
   DEPLOYER_PRIVATE_KEY=your_optimism_private_key
   OSMOSIS_MNEMONIC=your_osmosis_mnemonic_phrase

   # Axelar Configuration
   AXELAR_API_KEY=your_axelar_api_key
   ```

4. **Configure network settings**
   Update the configuration files in the `config/` directory:
   - `config/optimism.json`: Optimism network settings
   - `config/cosmos.json`: Osmosis network settings
   - `config/axelar.json`: Axelar bridge configuration

## 🚀 Usage

### Basic Setup and Execution

1. **Start the main application**

   ```bash
   npm start
   # or
   npx ts-node src/index.ts
   ```

2. **Deploy smart contracts** (optional)
   ```bash
   cd scripts
   npm install
   npx hardhat deploy --network optimism
   ```

### Cross-Chain Transfer Example

The application automatically performs a cross-chain transfer from Osmosis to Optimism:

```typescript
// Example: Transfer 1 OSMO from Osmosis to Optimism
const result = await osmosisCrossChain.swapAndBridge(
  "OSMO", // Source token
  "1", // Amount
  "optimism", // Destination chain
  destinationAddress // Destination address
);
```

### Advanced Usage

#### 1. **Pool Data Aggregation**

```typescript
// Fetch Osmosis pool data
const osmosisPools = await cosmosAggregator.fetchPoolData();

// Fetch Optimism pool data
const optimismPools = await optimismAggregator.fetchPoolData();
```

#### 2. **Optimal Path Finding**

```typescript
// Execute order with optimal pathfinding
const result = await cosmosAggregator.executeOrder(
  signingClient,
  pools,
  "OSMO", // Start token
  "USDC", // End token
  new BigNumber("1"), // Amount
  senderAddress,
  1000, // Min liquidity
  3 // Max paths
);
```

#### 3. **Cross-Chain Operations**

```typescript
// Swap and bridge from source chain
const bridgeResult = await cosmosCrossChain.swapAndBridge(
  sourceToken,
  amount,
  destinationChain,
  destinationAddress
);

// Receive and swap on destination chain
const swapResult = await optimismCrossChain.receiveAndSwap(
  sourceChain,
  usdcAmount,
  destinationToken
);
```

## 🔍 Key Features

### 1. **Advanced Pathfinding Algorithm**

- **Multi-path execution**: Splits trades across multiple routes to minimize slippage
- **Liquidity optimization**: Prioritizes pools with higher liquidity
- **Slippage calculation**: Real-time slippage estimation and optimization
- **Graph-based routing**: Uses Neo4j for complex relationship mapping

### 2. **Cross-Chain Bridge Integration**

- **Axelar Network**: Secure cross-chain communication
- **Token bridging**: Seamless transfer between Optimism and Osmosis
- **Gas optimization**: Efficient gas usage across chains
- **Transaction monitoring**: Real-time status tracking

### 3. **Pool Data Management**

- **Real-time aggregation**: Live data from multiple DEX sources
- **Stablecoin validation**: Automatic detection and adjustment of stablecoin pools
- **Liquidity monitoring**: Continuous liquidity tracking
- **Data persistence**: Neo4j integration for complex queries

### 4. **Wallet Management**

- **Multi-chain support**: Unified interface for different blockchains
- **Secure key management**: Environment-based private key handling
- **Transaction signing**: Automated transaction signing and broadcasting
- **Balance monitoring**: Real-time balance tracking

## 📊 Configuration

### Network Configuration

#### Optimism (`config/optimism.json`)

```json
{
  "rpcUrl": "https://mainnet.optimism.io",
  "chainId": 10,
  "subgraphUrl": "https://gateway-arbitrum.network.thegraph.com/api/...",
  "tokens": {
    "ETH": {
      "address": "0x0000000000000000000000000000000000000000",
      "decimals": 18
    },
    "USDC": {
      "address": "0x7F5c764cBc14f9669B88837ca1490cCa17c31607",
      "decimals": 6
    }
  }
}
```

#### Osmosis (`config/cosmos.json`)

```json
{
  "osmosisRpcUrl": "https://rpc.osmosis.zone",
  "osmosisChainId": "osmosis-1",
  "tokens": {
    "OSMO": { "denom": "uosmo", "decimals": 6 },
    "ATOM": { "denom": "uatom", "decimals": 6 }
  }
}
```

#### Axelar (`config/axelar.json`)

```json
{
  "environment": "testnet",
  "gasReceiver": {
    "optimism": "0xbE406F0189A0B4cf3A05C286473D23791Dd44Cc6",
    "cosmos": "cosmos1jv65s3grqf6v6jl3dp4t6c9t9rk99cd8e9nj0g"
  }
}
```

## 🔒 Security Considerations

### Private Key Management

- **Environment variables**: Store private keys in `.env` files
- **Never commit secrets**: Ensure `.env` is in `.gitignore`
- **Key rotation**: Regularly rotate private keys
- **Multi-sig support**: Consider multi-signature wallets for production

### Smart Contract Security

- **Audit recommendations**: Conduct security audits before mainnet deployment
- **Access controls**: Implement proper access controls in smart contracts
- **Emergency stops**: Include emergency stop mechanisms
- **Upgradeability**: Consider upgradeable contract patterns

### Cross-Chain Security

- **Axelar validation**: Verify cross-chain message authenticity
- **Gas optimization**: Optimize gas usage to prevent transaction failures
- **Slippage protection**: Implement slippage protection mechanisms
- **Timeout handling**: Handle cross-chain transaction timeouts

## 🧪 Testing

### Unit Tests

```bash
npm test
```

### Integration Tests

```bash
npm run test:integration
```

### Smart Contract Tests

```bash
cd scripts
npx hardhat test
```

## 📈 Performance Optimization

### Database Optimization

- **Index creation**: Create appropriate Neo4j indexes
- **Query optimization**: Optimize Cypher queries for performance
- **Connection pooling**: Implement connection pooling for database connections

### Network Optimization

- **RPC endpoint selection**: Use reliable and fast RPC endpoints
- **Batch processing**: Implement batch processing for multiple operations
- **Caching**: Cache frequently accessed data

### Gas Optimization

- **Transaction batching**: Batch multiple transactions when possible
- **Gas estimation**: Implement accurate gas estimation
- **Priority fee optimization**: Optimize priority fees for faster inclusion

## 🚨 Troubleshooting

### Common Issues

1. **Neo4j Connection Issues**

   ```bash
   # Check Neo4j service status
   sudo systemctl status neo4j

   # Restart Neo4j service
   sudo systemctl restart neo4j
   ```

2. **RPC Endpoint Issues**

   ```bash
   # Test RPC endpoint connectivity
   curl -X POST -H "Content-Type: application/json" \
     --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
     https://mainnet.optimism.io
   ```

3. **Wallet Initialization Issues**
   - Verify private key/mnemonic format
   - Check network connectivity
   - Ensure sufficient balance for gas fees

### Debug Mode

Enable debug logging by setting the `DEBUG` environment variable:

```bash
DEBUG=* npm start
```

## 🤝 Contributing

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Commit your changes**: `git commit -m 'Add amazing feature'`
4. **Push to the branch**: `git push origin feature/amazing-feature`
5. **Open a Pull Request**

### Development Guidelines

- Follow TypeScript best practices
- Write comprehensive tests
- Update documentation for new features
- Follow conventional commit messages

## 📄 License

This project is licensed under the ISC License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Axelar Network** for cross-chain infrastructure
- **Osmosis** for Cosmos DEX functionality
- **Optimism** for Layer 2 scaling solution
- **Neo4j** for graph database technology

## 📞 Support

For support and questions:

- **Issues**: [GitHub Issues](https://github.com/ManiBAJPAI22/cross-chain-integration/issues)
- **Discussions**: [GitHub Discussions](https://github.com/ManiBAJPAI22/cross-chain-integration/discussions)
- **Documentation**: [Project Wiki](https://github.com/ManiBAJPAI22/cross-chain-integration/wiki)

## 🔄 Version History

- **v1.0.0**: Initial release with basic cross-chain functionality
- **v1.1.0**: Added advanced pathfinding algorithms
- **v1.2.0**: Integrated Neo4j for complex relationship mapping
- **v1.3.0**: Enhanced security and performance optimizations

---

**Note**: This project is for educational and development purposes. Always test thoroughly on testnets before using on mainnet. Use at your own risk and ensure you understand the implications of cross-chain operations.
