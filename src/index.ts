import dotenv from "dotenv";
import { ethers } from "ethers";
import { SigningStargateClient } from "@cosmjs/stargate";
import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
import { AxelarQueryAPI, Environment } from "@axelar-network/axelarjs-sdk";
import { CosmosAggregator } from "./cosmos/cosmos";
import { OptimismAggregator } from "./optimism/optimism";
import { AxelarBridge } from "./axelar/AxelarBridge";
import { CosmosCrossChain } from "./cosmos/CosmosCrossChain";
import { OptimismCrossChain } from "./optimism/OptimismCrossChain";
import { CosmosWallet } from "./cosmos/wallet";
import { OptimismWallet } from "./optimism/wallet";
import neo4j from "neo4j-driver";
import axios from "axios";
const cosmosConfig = require("../../config/cosmos.json");
const optimismConfig = require("../../config/optimism.json");
const axelarConfig = require("../../config/axelar.json");

dotenv.config();

async function main() {
  // Neo4j setup
  const neo4jDriver = neo4j.driver(
    process.env.NEO4J_URI!,
    neo4j.auth.basic(process.env.NEO4J_USERNAME!, process.env.NEO4J_PASSWORD!)
  );
  console.log("Connected to Neo4j database");

  // Cosmos setup
  const cosmosWallet = new CosmosWallet();
  await cosmosWallet.initialize(
    process.env.COSMOS_MNEMONIC!,
    cosmosConfig.rpcUrl
  );
  const cosmosClient = await SigningStargateClient.connectWithSigner(
    cosmosConfig.rpcUrl,
    await cosmosWallet.getWallet()
  );
  const cosmosAggregator = new CosmosAggregator();
  console.log("Cosmos setup complete");

  // Optimism setup
  const optimismProvider = new ethers.JsonRpcProvider(optimismConfig.rpcUrl);
  const optimismWallet = new OptimismWallet();
  await optimismWallet.initialize(
    process.env.DEPLOYER_PRIVATE_KEY!,
    optimismConfig.rpcUrl
  );
  const optimismAggregator = new OptimismAggregator(
    optimismConfig.rpcUrl,
    optimismConfig.subgraphUrl,
    optimismWallet
  );
  console.log("Optimism setup complete");

  // Axelar setup
  const axelarQuery = new AxelarQueryAPI({
    environment: axelarConfig.environment as Environment,
  });
  const axelarBridge = new AxelarBridge();
  console.log("Axelar setup complete");

  // Cross-Chain setup
  const cosmosCrossChain = new CosmosCrossChain(
    axelarConfig.environment as Environment
  );
  await cosmosCrossChain.initialize(
    process.env.COSMOS_MNEMONIC!,
    cosmosConfig.rpcUrl
  );

  const optimismCrossChain = new OptimismCrossChain(
    optimismConfig.rpcUrl,
    optimismConfig.subgraphUrl,
    axelarConfig.environment as Environment
  );
  await optimismCrossChain.initialize(
    process.env.DEPLOYER_PRIVATE_KEY!,
    optimismConfig.rpcUrl
  );
  console.log("Cross-chain setup complete");

  // Example: Fetch and store pool data
  const cosmosPools = await cosmosAggregator.fetchPoolData();
  const optimismPools = await optimismAggregator.fetchPoolData();

  const neo4jSession = neo4jDriver.session();
  try {
    await cosmosAggregator.importDataToNeo4j(neo4jDriver, cosmosPools!);
    console.log("Cosmos pool data imported to Neo4j");

    // Assume similar method exists for Optimism
    // await optimismAggregator.importDataToNeo4j(neo4jDriver, optimismPools!);
    // console.log("Optimism pool data imported to Neo4j");
  } finally {
    await neo4jSession.close();
  }

  // Example: Cross-chain transfer from Cosmos to Optimism
  const sourceToken = "ATOM";
  const amount = "1"; // 1 ATOM
  const destinationChain = "optimism";
  const destinationAddress = await optimismWallet.getAddress();

  try {
    const result = await cosmosCrossChain.swapAndBridge(
      sourceToken,
      amount,
      destinationChain,
      destinationAddress
    );
    console.log("Cross-chain transfer result:", result);

    // Example: Receive and swap on Optimism
    const receivedAmount = "1000000"; // Assuming 1 USDC (6 decimals)
    const finalToken = "ETH";
    const swapResult = await optimismCrossChain.receiveAndSwap(
      "cosmos",
      receivedAmount,
      finalToken
    );
    console.log("Receive and swap result on Optimism:", swapResult);
  } catch (error) {
    console.error("Cross-chain operation failed:", error);
  }

  // Example: Query Optimism subgraph
  const subgraphQuery = `
        {
            pools(first: 5, orderBy: totalValueLockedUSD, orderDirection: desc) {
                id
                token0 {
                    symbol
                }
                token1 {
                    symbol
                }
                totalValueLockedUSD
            }
        }
    `;
  try {
    const subgraphResponse = await axios.post(optimismConfig.subgraphUrl, {
      query: subgraphQuery,
    });
    console.log(
      "Top 5 Optimism pools by TVL:",
      subgraphResponse.data.data.pools
    );
  } catch (error) {
    console.error("Subgraph query failed:", error);
  }

  // Clean up
  await neo4jDriver.close();
  console.log("Neo4j connection closed");
}

main().catch((error) => {
  console.error("An error occurred in the main function:", error);
  process.exitCode = 1;
});
