"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const cosmos_1 = require("./cosmos/cosmos");
const optimism_1 = require("./optimism/optimism");
const AxelarBridge_1 = require("./axelar/AxelarBridge");
const CosmosCrossChain_1 = require("./cosmos/CosmosCrossChain");
const OptimismCrossChain_1 = require("./optimism/OptimismCrossChain");
const wallet_1 = require("./cosmos/wallet");
const wallet_2 = require("./optimism/wallet");
const neo4j_driver_1 = __importDefault(require("neo4j-driver"));
const axios_1 = __importDefault(require("axios"));
const cosmosConfig = require("../config/cosmos.json");
const optimismConfig = require("../config/optimism.json");
const axelarConfig = require("../config/axelar.json");
dotenv_1.default.config();
console.log("OSMOSIS_MNEMONIC from env:", process.env.OSMOSIS_MNEMONIC ? "Found" : "Not found");
function testRpcEndpoint(url) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const response = yield axios_1.default.post(url, {
                jsonrpc: "2.0",
                id: 1,
                method: "health",
                params: [],
            });
            console.log("RPC endpoint health check response:", response.data);
            return true;
        }
        catch (error) {
            console.error("Failed to connect to RPC endpoint:", error);
            return false;
        }
    });
}
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log("Starting main function...");
        // Neo4j setup
        let neo4jDriver;
        try {
            neo4jDriver = neo4j_driver_1.default.driver(process.env.NEO4J_URI, neo4j_driver_1.default.auth.basic(process.env.NEO4J_USERNAME, process.env.NEO4J_PASSWORD));
            console.log("Connected to Neo4j database");
        }
        catch (error) {
            console.error("Failed to connect to Neo4j:", error);
            return;
        }
        // Osmosis setup
        let osmosisWallet;
        let osmosisAggregator;
        try {
            console.log("Testing Osmosis RPC endpoint...");
            const rpcIsHealthy = yield testRpcEndpoint(cosmosConfig.osmosisRpcUrl);
            if (!rpcIsHealthy) {
                console.error("Osmosis RPC endpoint is not responding correctly");
                return;
            }
            console.log("Initializing Osmosis wallet...");
            osmosisWallet = new wallet_1.CosmosWallet(cosmosConfig.osmosisChainId);
            const mnemonic = process.env.OSMOSIS_MNEMONIC;
            if (!mnemonic) {
                console.log("OSMOSIS_MNEMONIC not found in environment variables. Attempting to use Keplr.");
            }
            else {
                console.log("OSMOSIS_MNEMONIC found in environment variables. Length:", mnemonic.split(" ").length);
            }
            yield osmosisWallet.initialize(cosmosConfig.osmosisRpcUrl, mnemonic);
            console.log("Osmosis wallet initialized successfully");
            console.log("Initializing Osmosis aggregator...");
            osmosisAggregator = new cosmos_1.CosmosAggregator();
            console.log("Osmosis aggregator initialized");
            console.log("Osmosis setup complete");
            // Log the Osmosis address
            const osmosisAddress = yield osmosisWallet.getAddress();
            console.log("Osmosis address:", osmosisAddress);
            // Check Osmosis balance
            const osmosisBalance = yield osmosisWallet.getBalance();
            console.log("Osmosis balance:", osmosisBalance, "uosmo");
        }
        catch (error) {
            console.error("Failed to set up Osmosis:");
            if (error instanceof Error) {
                console.error("Error name:", error.name);
                console.error("Error message:", error.message);
                console.error("Error stack:", error.stack);
            }
            else {
                console.error(error);
            }
            return;
        }
        // Optimism setup
        let optimismWallet;
        let optimismAggregator;
        try {
            console.log("Initializing Optimism wallet...");
            optimismWallet = new wallet_2.OptimismWallet();
            yield optimismWallet.initialize(process.env.DEPLOYER_PRIVATE_KEY, optimismConfig.rpcUrl);
            console.log("Optimism wallet initialized successfully");
            console.log("Initializing Optimism aggregator...");
            optimismAggregator = new optimism_1.OptimismAggregator(optimismConfig.rpcUrl, optimismConfig.subgraphUrl, optimismWallet);
            console.log("Optimism aggregator initialized");
            console.log("Optimism setup complete");
        }
        catch (error) {
            console.error("Failed to set up Optimism:");
            if (error instanceof Error) {
                console.error("Error name:", error.name);
                console.error("Error message:", error.message);
                console.error("Error stack:", error.stack);
            }
            else {
                console.error(error);
            }
            return;
        }
        // Axelar setup
        let axelarBridge;
        try {
            console.log("Initializing Axelar...");
            axelarBridge = new AxelarBridge_1.AxelarBridge(axelarConfig.environment);
            console.log("Axelar setup complete");
        }
        catch (error) {
            console.error("Failed to set up Axelar:");
            if (error instanceof Error) {
                console.error("Error name:", error.name);
                console.error("Error message:", error.message);
                console.error("Error stack:", error.stack);
            }
            else {
                console.error(error);
            }
            return;
        }
        // Cross-Chain setup
        let osmosisCrossChain;
        let optimismCrossChain;
        try {
            console.log("Initializing Osmosis cross-chain...");
            osmosisCrossChain = new CosmosCrossChain_1.CosmosCrossChain(axelarConfig.environment, cosmosConfig.osmosisChainId);
            yield osmosisCrossChain.initialize(cosmosConfig.osmosisRpcUrl, process.env.OSMOSIS_MNEMONIC);
            console.log("Osmosis cross-chain initialized successfully");
            console.log("Initializing Optimism cross-chain...");
            optimismCrossChain = new OptimismCrossChain_1.OptimismCrossChain(optimismConfig.rpcUrl, optimismConfig.subgraphUrl, axelarConfig.environment);
            yield optimismCrossChain.initialize(process.env.DEPLOYER_PRIVATE_KEY, optimismConfig.rpcUrl);
            console.log("Optimism cross-chain initialized successfully");
            console.log("Cross-chain setup complete");
        }
        catch (error) {
            console.error("Failed to set up cross-chain functionality:");
            if (error instanceof Error) {
                console.error("Error name:", error.name);
                console.error("Error message:", error.message);
                console.error("Error stack:", error.stack);
            }
            else {
                console.error(error);
            }
            return;
        }
        // Example: Fetch and store pool data
        try {
            console.log("Fetching Osmosis pool data...");
            const osmosisPools = yield osmosisAggregator.fetchPoolData();
            console.log("Fetching Optimism pool data...");
            const optimismPools = yield optimismAggregator.fetchPoolData();
            const neo4jSession = neo4jDriver.session();
            try {
                console.log("Importing Osmosis pool data to Neo4j...");
                yield osmosisAggregator.importDataToNeo4j(neo4jDriver, osmosisPools);
                console.log("Osmosis pool data imported to Neo4j");
                // Assume similar method exists for Optimism
                // console.log("Importing Optimism pool data to Neo4j...");
                // await optimismAggregator.importDataToNeo4j(neo4jDriver, optimismPools!);
                // console.log("Optimism pool data imported to Neo4j");
            }
            finally {
                yield neo4jSession.close();
            }
        }
        catch (error) {
            console.error("Failed to fetch and store pool data:");
            if (error instanceof Error) {
                console.error("Error name:", error.name);
                console.error("Error message:", error.message);
                console.error("Error stack:", error.stack);
            }
            else {
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
            const destinationAddress = yield optimismWallet.getAddress();
            const result = yield osmosisCrossChain.swapAndBridge(sourceToken, amount, destinationChain, destinationAddress);
            console.log("Cross-chain transfer result:", result);
            // Example: Receive and swap on Optimism
            console.log("Receiving and swapping on Optimism...");
            const receivedAmount = "1000000"; // Assuming 1 USDC (6 decimals)
            const finalToken = "OP";
            const swapResult = yield optimismCrossChain.receiveAndSwap("osmosis", receivedAmount, finalToken);
            console.log("Receive and swap result on Optimism:", swapResult);
        }
        catch (error) {
            console.error("Cross-chain operation failed:");
            if (error instanceof Error) {
                console.error("Error name:", error.name);
                console.error("Error message:", error.message);
                console.error("Error stack:", error.stack);
            }
            else {
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
            const subgraphResponse = yield axios_1.default.post(optimismConfig.subgraphUrl, {
                query: subgraphQuery,
            });
            console.log("Top 5 Optimism pools by TVL:", subgraphResponse.data.data.pools);
        }
        catch (error) {
            console.error("Subgraph query failed:");
            if (error instanceof Error) {
                console.error("Error name:", error.name);
                console.error("Error message:", error.message);
                console.error("Error stack:", error.stack);
            }
            else {
                console.error(error);
            }
        }
        // Clean up
        console.log("Cleaning up...");
        yield neo4jDriver.close();
        console.log("Neo4j connection closed");
    });
}
main().catch((error) => {
    console.error("An error occurred in the main function:");
    if (error instanceof Error) {
        console.error("Error name:", error.name);
        console.error("Error message:", error.message);
        console.error("Error stack:", error.stack);
    }
    else {
        console.error(error);
    }
    process.exitCode = 1;
});
