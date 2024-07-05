import dotenv from "dotenv";
import { ethers } from "ethers";
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

const cosmosConfig = require("../config/cosmos.json");
const optimismConfig = require("../config/optimism.json");
const axelarConfig = require("../config/axelar.json");

dotenv.config();

console.log(
  "OSMOSIS_MNEMONIC from env:",
  process.env.OSMOSIS_MNEMONIC ? "Found" : "Not found"
);

async function testRpcEndpoint(url: string): Promise<boolean> {
  try {
    const response = await axios.post(url, {
      jsonrpc: "2.0",
      id: 1,
      method: "health",
      params: [],
    });
    console.log("RPC endpoint health check response:", response.data);
    return true;
  } catch (error) {
    console.error("Failed to connect to RPC endpoint:", error);
    return false;
  }
}

async function main() {
  console.log("Starting main function...");

  // Neo4j setup
  let neo4jDriver;
  try {
    neo4jDriver = neo4j.driver(
      process.env.NEO4J_URI!,
      neo4j.auth.basic(process.env.NEO4J_USERNAME!, process.env.NEO4J_PASSWORD!)
    );
    console.log("Connected to Neo4j database");
  } catch (error) {
    console.error("Failed to connect to Neo4j:", error);
    return;
  }

  // Osmosis setup
  let osmosisWallet: CosmosWallet;
  let osmosisAggregator: CosmosAggregator;

  try {
    console.log("Testing Osmosis RPC endpoint...");
    const rpcIsHealthy = await testRpcEndpoint(cosmosConfig.osmosisRpcUrl);
    if (!rpcIsHealthy) {
      console.error("Osmosis RPC endpoint is not responding correctly");
      return;
    }

    console.log("Initializing Osmosis wallet...");
    osmosisWallet = new CosmosWallet(cosmosConfig.osmosisChainId);

    const mnemonic = process.env.OSMOSIS_MNEMONIC;
    if (!mnemonic) {
      console.log(
        "OSMOSIS_MNEMONIC not found in environment variables. Attempting to use Keplr."
      );
    } else {
      console.log(
        "OSMOSIS_MNEMONIC found in environment variables. Length:",
        mnemonic.split(" ").length
      );
    }

    await osmosisWallet.initialize(cosmosConfig.osmosisRpcUrl, mnemonic);
    console.log("Osmosis wallet initialized successfully");

    console.log("Initializing Osmosis aggregator...");
    osmosisAggregator = new CosmosAggregator();
    console.log("Osmosis aggregator initialized");

    console.log("Osmosis setup complete");

    // Log the Osmosis address
    const osmosisAddress = await osmosisWallet.getAddress();
    console.log("Osmosis address:", osmosisAddress);

    // Check Osmosis balance
    const osmosisBalance = await osmosisWallet.getBalance();
    console.log("Osmosis balance:", osmosisBalance, "uosmo");
  } catch (error) {
    console.error("Failed to set up Osmosis:");
    if (error instanceof Error) {
      console.error("Error name:", error.name);
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
    } else {
      console.error(error);
    }
    return;
  }

  // Optimism setup
  let optimismWallet: OptimismWallet;
  let optimismAggregator: OptimismAggregator;

  try {
    console.log("Initializing Optimism wallet...");
    optimismWallet = new OptimismWallet();
    await optimismWallet.initialize(
      process.env.DEPLOYER_PRIVATE_KEY!,
      optimismConfig.rpcUrl
    );
    console.log("Optimism wallet initialized successfully");

    console.log("Initializing Optimism aggregator...");
    optimismAggregator = new OptimismAggregator(
      optimismConfig.rpcUrl,
      optimismConfig.subgraphUrl,
      optimismWallet
    );
    console.log("Optimism aggregator initialized");

    console.log("Optimism setup complete");
  } catch (error) {
    console.error("Failed to set up Optimism:");
    if (error instanceof Error) {
      console.error("Error name:", error.name);
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
    } else {
      console.error(error);
    }
    return;
  }

  // Axelar setup
  let axelarBridge: AxelarBridge;
  try {
    console.log("Initializing Axelar...");
    axelarBridge = new AxelarBridge(axelarConfig.environment as Environment);
    console.log("Axelar setup complete");
  } catch (error) {
    console.error("Failed to set up Axelar:");
    if (error instanceof Error) {
      console.error("Error name:", error.name);
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
    } else {
      console.error(error);
    }
    return;
  }

  // Cross-Chain setup
  let osmosisCrossChain: CosmosCrossChain;
  let optimismCrossChain: OptimismCrossChain;

  try {
    console.log("Initializing Osmosis cross-chain...");
    osmosisCrossChain = new CosmosCrossChain(
      axelarConfig.environment as Environment,
      cosmosConfig.osmosisChainId
    );
    await osmosisCrossChain.initialize(
      cosmosConfig.osmosisRpcUrl,
      process.env.OSMOSIS_MNEMONIC
    );
    console.log("Osmosis cross-chain initialized successfully");

    console.log("Initializing Optimism cross-chain...");
    optimismCrossChain = new OptimismCrossChain(
      optimismConfig.rpcUrl,
      optimismConfig.subgraphUrl,
      axelarConfig.environment as Environment
    );
    await optimismCrossChain.initialize(
      process.env.DEPLOYER_PRIVATE_KEY!,
      optimismConfig.rpcUrl
    );
    console.log("Optimism cross-chain initialized successfully");

    console.log("Cross-chain setup complete");
  } catch (error) {
    console.error("Failed to set up cross-chain functionality:");
    if (error instanceof Error) {
      console.error("Error name:", error.name);
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
    } else {
      console.error(error);
    }
    return;
  }

  // Example: Fetch and store pool data
  try {
    console.log("Fetching Osmosis pool data...");
    const osmosisPools = await osmosisAggregator.fetchPoolData();
    console.log("Fetching Optimism pool data...");
    const optimismPools = await optimismAggregator.fetchPoolData();

    const neo4jSession = neo4jDriver.session();
    try {
      console.log("Importing Osmosis pool data to Neo4j...");
      await osmosisAggregator.importDataToNeo4j(neo4jDriver, osmosisPools!);
      console.log("Osmosis pool data imported to Neo4j");

      // Assume similar method exists for Optimism
      // console.log("Importing Optimism pool data to Neo4j...");
      // await optimismAggregator.importDataToNeo4j(neo4jDriver, optimismPools!);
      // console.log("Optimism pool data imported to Neo4j");
    } finally {
      await neo4jSession.close();
    }
  } catch (error) {
    console.error("Failed to fetch and store pool data:");
    if (error instanceof Error) {
      console.error("Error name:", error.name);
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
    } else {
      console.error(error);
    }
    return;
  }

  // Example: Cross-chain transfer from Osmosis to Optimism
  try {
    console.log("Initiating cross-chain transfer from Osmosis to Optimism...");
    const sourceToken = "OSMO";
    const amount = "1"; // 1 OSMO
    const destinationChain = "optimism";
    const destinationAddress = await optimismWallet.getAddress();

    const result = await osmosisCrossChain.swapAndBridge(
      sourceToken,
      amount,
      destinationChain,
      destinationAddress
    );
    console.log("Cross-chain transfer result:", result);

    // Example: Receive and swap on Optimism
    console.log("Receiving and swapping on Optimism...");
    const receivedAmount = "1000000"; // Assuming 1 USDC (6 decimals)
    const finalToken = "OP";
    const swapResult = await optimismCrossChain.receiveAndSwap(
      "osmosis",
      receivedAmount,
      finalToken
    );
    console.log("Receive and swap result on Optimism:", swapResult);
  } catch (error) {
    console.error("Cross-chain operation failed:");
    if (error instanceof Error) {
      console.error("Error name:", error.name);
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
    } else {
      console.error(error);
    }
  }

  // Example: Query Optimism subgraph
  try {
    console.log("Querying Optimism subgraph...");
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
    const subgraphResponse = await axios.post(optimismConfig.subgraphUrl, {
      query: subgraphQuery,
    });
    console.log(
      "Top 5 Optimism pools by TVL:",
      subgraphResponse.data.data.pools
    );
  } catch (error) {
    console.error("Subgraph query failed:");
    if (error instanceof Error) {
      console.error("Error name:", error.name);
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
    } else {
      console.error(error);
    }
  }

  // Clean up
  console.log("Cleaning up...");
  await neo4jDriver.close();
  console.log("Neo4j connection closed");
}

main().catch((error) => {
  console.error("An error occurred in the main function:");
  if (error instanceof Error) {
    console.error("Error name:", error.name);
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);
  } else {
    console.error(error);
  }
  process.exitCode = 1;
});
