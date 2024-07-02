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
const stargate_1 = require("@cosmjs/stargate");
const axelarjs_sdk_1 = require("@axelar-network/axelarjs-sdk");
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
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        // Neo4j setup
        const neo4jDriver = neo4j_driver_1.default.driver(process.env.NEO4J_URI, neo4j_driver_1.default.auth.basic(process.env.NEO4J_USERNAME, process.env.NEO4J_PASSWORD));
        console.log("Connected to Neo4j database");
        // Cosmos setup
        let cosmosWallet;
        let cosmosClient;
        let cosmosAggregator;
        try {
            cosmosWallet = new wallet_1.CosmosWallet();
            yield cosmosWallet.initialize(process.env.COSMOS_MNEMONIC, cosmosConfig.rpcUrl);
            cosmosClient = yield stargate_1.SigningStargateClient.connectWithSigner(cosmosConfig.rpcUrl, yield cosmosWallet.getWallet());
            cosmosAggregator = new cosmos_1.CosmosAggregator();
            console.log("Cosmos setup complete");
        }
        catch (error) {
            console.error("Failed to set up Cosmos:", error);
            return;
        }
        // Osmosis setup
        let osmosisWallet;
        let osmosisClient;
        try {
            osmosisWallet = new wallet_1.CosmosWallet();
            yield osmosisWallet.initialize(process.env.COSMOS_MNEMONIC, cosmosConfig.osmosisRpcUrl);
            osmosisClient = yield stargate_1.SigningStargateClient.connectWithSigner(cosmosConfig.osmosisRpcUrl, yield osmosisWallet.getWallet());
            console.log("Osmosis setup complete");
        }
        catch (error) {
            console.error("Failed to set up Osmosis:", error);
            return;
        }
        // Optimism setup
        let optimismWallet;
        let optimismAggregator;
        try {
            optimismWallet = new wallet_2.OptimismWallet();
            yield optimismWallet.initialize(process.env.DEPLOYER_PRIVATE_KEY, optimismConfig.rpcUrl);
            optimismAggregator = new optimism_1.OptimismAggregator(optimismConfig.rpcUrl, optimismConfig.subgraphUrl, optimismWallet);
            console.log("Optimism setup complete");
        }
        catch (error) {
            console.error("Failed to set up Optimism:", error);
            return;
        }
        // Axelar setup
        try {
            const axelarQuery = new axelarjs_sdk_1.AxelarQueryAPI({
                environment: axelarConfig.environment,
            });
            const axelarBridge = new AxelarBridge_1.AxelarBridge();
            console.log("Axelar setup complete");
        }
        catch (error) {
            console.error("Failed to set up Axelar:", error);
            return;
        }
        // Cross-Chain setup
        let cosmosCrossChain;
        let optimismCrossChain;
        try {
            cosmosCrossChain = new CosmosCrossChain_1.CosmosCrossChain(axelarConfig.environment);
            yield cosmosCrossChain.initialize(process.env.COSMOS_MNEMONIC, cosmosConfig.rpcUrl);
            optimismCrossChain = new OptimismCrossChain_1.OptimismCrossChain(optimismConfig.rpcUrl, optimismConfig.subgraphUrl, axelarConfig.environment);
            yield optimismCrossChain.initialize(process.env.DEPLOYER_PRIVATE_KEY, optimismConfig.rpcUrl);
            console.log("Cross-chain setup complete");
        }
        catch (error) {
            console.error("Failed to set up cross-chain functionality:", error);
            return;
        }
        // Example: Fetch and store pool data
        try {
            const cosmosPools = yield cosmosAggregator.fetchPoolData();
            const optimismPools = yield optimismAggregator.fetchPoolData();
            const neo4jSession = neo4jDriver.session();
            try {
                yield cosmosAggregator.importDataToNeo4j(neo4jDriver, cosmosPools);
                console.log("Cosmos pool data imported to Neo4j");
                // Assume similar method exists for Optimism
                // await optimismAggregator.importDataToNeo4j(neo4jDriver, optimismPools!);
                // console.log("Optimism pool data imported to Neo4j");
            }
            finally {
                yield neo4jSession.close();
            }
        }
        catch (error) {
            console.error("Failed to fetch and store pool data:", error);
            return;
        }
        // Example: Cross-chain transfer from Cosmos to Optimism
        try {
            const sourceToken = "ATOM";
            const amount = "1"; // 1 ATOM
            const destinationChain = "optimism";
            const destinationAddress = yield optimismWallet.getAddress();
            const result = yield cosmosCrossChain.swapAndBridge(sourceToken, amount, destinationChain, destinationAddress);
            console.log("Cross-chain transfer result:", result);
            // Example: Receive and swap on Optimism
            const receivedAmount = "1000000"; // Assuming 1 USDC (6 decimals)
            const finalToken = "ETH";
            const swapResult = yield optimismCrossChain.receiveAndSwap("cosmos", receivedAmount, finalToken);
            console.log("Receive and swap result on Optimism:", swapResult);
        }
        catch (error) {
            console.error("Cross-chain operation failed:", error);
        }
        // Example: Query Optimism subgraph
        try {
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
            console.error("Subgraph query failed:", error);
        }
        // Clean up
        yield neo4jDriver.close();
        console.log("Neo4j connection closed");
    });
}
main().catch((error) => {
    console.error("An error occurred in the main function:", error);
    process.exitCode = 1;
});
