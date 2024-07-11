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
import BigNumber from "bignumber.js";

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
    console.error("Failed to set up Osmosis:", error);
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
    console.error("Failed to set up Optimism:", error);
    return;
  }

  // Axelar setup
  let axelarBridge: AxelarBridge;
  try {
    console.log("Initializing Axelar...");
    axelarBridge = new AxelarBridge(axelarConfig.environment as Environment);
    console.log("Axelar setup complete");
  } catch (error) {
    console.error("Failed to set up Axelar:", error);
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
    console.error("Failed to set up cross-chain functionality:", error);
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

      console.log("Importing Optimism pool data to Neo4j...");
      if ("importDataToNeo4j" in optimismAggregator) {
        await (optimismAggregator as any).importDataToNeo4j(
          neo4jDriver,
          optimismPools!
        );
        console.log("Optimism pool data imported to Neo4j");
      } else {
        console.log(
          "importDataToNeo4j method not implemented for OptimismAggregator. Skipping Optimism data import."
        );
        // TODO: Implement importDataToNeo4j method for OptimismAggregator
      }
    } finally {
      await neo4jSession.close();
    }
  } catch (error) {
    console.error("Failed to fetch and store pool data:", error);
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

    if (result.success) {
      console.log(
        "Cross-chain transfer initiated successfully. Transaction hash:",
        result.txHash
      );

      // We don't have a direct way to get the received amount, so we'll use the original amount
      // Note: This assumes a 1:1 conversion rate, which may not be accurate in practice
      const estimatedReceivedAmount = new BigNumber(amount);

      console.log(
        "Estimated USDC amount to be received on Optimism:",
        estimatedReceivedAmount.toString()
      );

      // Wait for some time to allow the cross-chain transfer to complete
      // This is a placeholder. In a real scenario, you'd want to implement a way to check if the transfer is complete
      console.log("Waiting for cross-chain transfer to complete...");
      await new Promise((resolve) => setTimeout(resolve, 60000)); // Wait for 1 minute

      // Now attempt to receive and swap on Optimism
      console.log("Attempting to receive and swap on Optimism...");
      const finalToken = "OP";
      try {
        const swapResult = await optimismCrossChain.receiveAndSwap(
          "osmosis",
          estimatedReceivedAmount.toString(),
          finalToken
        );
        console.log("Receive and swap result on Optimism:", swapResult);
      } catch (swapError) {
        console.error("Failed to receive and swap on Optimism:", swapError);
        console.log(
          "The cross-chain transfer may not have completed yet. Please check your balance and try swapping manually later."
        );
      }
    } else {
      console.log("Cross-chain transfer failed to initiate.");
    }
  } catch (error) {
    console.error("Cross-chain operation failed:", error);
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
    console.error("Subgraph query failed:", error);
  }

  // Clean up
  console.log("Cleaning up...");
  await neo4jDriver.close();
  console.log("Neo4j connection closed");
}

main().catch((error) => {
  console.error("An error occurred in the main function:", error);
  process.exitCode = 1;
});
