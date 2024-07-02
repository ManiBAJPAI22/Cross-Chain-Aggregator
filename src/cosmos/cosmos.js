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
exports.CosmosAggregator = void 0;
const axios_1 = __importDefault(require("axios"));
const bignumber_js_1 = __importDefault(require("bignumber.js"));
const neo4j_driver_1 = __importDefault(require("neo4j-driver"));
const stargate_1 = require("@cosmjs/stargate");
const proto_signing_1 = require("@cosmjs/proto-signing");
const readline_1 = require("readline");
const dotenv_1 = __importDefault(require("dotenv"));
// Load environment variables
dotenv_1.default.config();
// Set BigNumber configuration
bignumber_js_1.default.config({ DECIMAL_PLACES: 18, ROUNDING_MODE: bignumber_js_1.default.ROUND_DOWN });
class CosmosAggregator {
    constructor() {
        this.URI = process.env.NEO4J_URI || "bolt://localhost:7687";
        this.AUTH = {
            username: process.env.NEO4J_USERNAME || "neo4j",
            password: process.env.NEO4J_PASSWORD || "password",
        };
        this.API_URL =
            "https://api-osmosis.imperator.co/pools/v2/all?low_liquidity=false";
        this.STABLECOINS = new Set(["USDC", "USDT", "DAI", "BUSD"]);
    }
    fetchPoolData() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const response = yield axios_1.default.get(this.API_URL);
                return response.data;
            }
            catch (error) {
                console.error(`Failed to fetch pool data: ${error}`);
                return null;
            }
        });
    }
    validateStablecoinPools(pools) {
        for (const [poolId, poolAssets] of Object.entries(pools)) {
            const stablecoinAssets = poolAssets.filter((asset) => this.STABLECOINS.has(asset.symbol));
            if (stablecoinAssets.length >= 2) {
                const stablecoinAmounts = stablecoinAssets.map((asset) => new bignumber_js_1.default(asset.amount));
                const avgAmount = stablecoinAmounts
                    .reduce((a, b) => a.plus(b))
                    .dividedBy(stablecoinAmounts.length);
                let adjusted = false;
                stablecoinAssets.forEach((asset) => {
                    const ratio = new bignumber_js_1.default(asset.amount).dividedBy(avgAmount);
                    if (ratio.isLessThan("0.95") || ratio.isGreaterThan("1.05")) {
                        console.warn(`Suspicious stablecoin in pool ${poolId}: ${asset.symbol} ratio: ${ratio.toString()}`);
                        const poolIndex = poolAssets.findIndex((a) => a.symbol === asset.symbol);
                        pools[poolId][poolIndex].amount = avgAmount.toString();
                        adjusted = true;
                    }
                });
                if (adjusted) {
                    console.info(`Adjusted stablecoins in pool ${poolId} to balanced ratios`);
                }
            }
        }
    }
    importDataToNeo4j(driver, pools) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!pools) {
                console.error("No data to import");
                return;
            }
            const session = driver.session();
            try {
                yield session.writeTransaction((tx) => this.clearDatabase(tx));
                for (const [poolId, poolAssets] of Object.entries(pools)) {
                    yield session.writeTransaction((tx) => this.createPoolRelationships(tx, poolId, poolAssets));
                }
                console.info("Data import completed successfully.");
            }
            catch (error) {
                console.error(`Failed to import data to Neo4j: ${error}`);
            }
            finally {
                yield session.close();
            }
        });
    }
    clearDatabase(tx) {
        tx.run("MATCH (n) DETACH DELETE n");
    }
    createPoolRelationships(tx, poolId, poolAssets) {
        const query = `
      UNWIND $assets AS asset
      MERGE (t:Token {symbol: asset.symbol})
      SET t.denom = asset.denom
      WITH collect(t) as tokens
      UNWIND tokens as t1
      UNWIND tokens as t2
      WITH t1, t2
      WHERE t1 <> t2
      MERGE (t1)-[p:POOL {id: $pool_id}]->(t2)
      SET p.liquidity = $totalLiquidity,
          p.weight = 1.0 / toFloat($totalLiquidity)
      WITH t1, t2, p
      MATCH (asset {symbol: t1.symbol}) WHERE asset IN $assets
      SET p.amount = asset.amount
    `;
        const totalLiquidity = poolAssets
            .reduce((sum, asset) => sum.plus(new bignumber_js_1.default(asset.amount)), new bignumber_js_1.default(0))
            .toString();
        tx.run(query, {
            assets: poolAssets,
            pool_id: poolId,
            totalLiquidity: totalLiquidity,
        });
    }
    executeOrder(client_1, pools_1, startToken_1, endToken_1, inputAmount_1, sender_1) {
        return __awaiter(this, arguments, void 0, function* (client, pools, startToken, endToken, inputAmount, sender, minLiquidity = 1000, maxPaths = 3) {
            const driver = neo4j_driver_1.default.driver(this.URI, neo4j_driver_1.default.auth.basic(this.AUTH.username, this.AUTH.password));
            const session = driver.session();
            try {
                const poolInfos = Object.entries(pools).map(([id, assets]) => ({
                    id,
                    assets,
                    liquidity: this.calculatePoolLiquidity(assets),
                }));
                const optimalStrategy = yield this.findOptimalTradingStrategy(session, startToken, endToken, inputAmount, poolInfos, 7, // maxDepth
                minLiquidity, maxPaths);
                if (optimalStrategy.paths.length === 0) {
                    console.warn(`No conversion path found from ${startToken} to ${endToken}`);
                    return new bignumber_js_1.default(0);
                }
                console.info(`Executing order: ${inputAmount.toString()} ${startToken} to ${endToken}`);
                console.info(`Number of paths: ${optimalStrategy.paths.length}`);
                console.info(`Estimated total output: ${optimalStrategy.totalExpectedOutput.toFixed(6)} ${endToken}`);
                const swapMsgs = [];
                let totalOutput = new bignumber_js_1.default(0);
                for (let i = 0; i < optimalStrategy.paths.length; i++) {
                    const { path, poolIds } = optimalStrategy.paths[i];
                    const pathAmount = optimalStrategy.amounts[i];
                    console.info(`\nPath ${i + 1}:`);
                    console.info(`Amount: ${pathAmount.toString()} ${startToken}`);
                    console.info(`Route: ${path.join(" -> ")}`);
                    let currentAmount = pathAmount;
                    let currentToken = startToken;
                    for (let j = 0; j < poolIds.length; j++) {
                        const poolAssets = pools[poolIds[j]];
                        const nextToken = path[j + 1];
                        const { outputAmount, slippage } = this.simulateSwap(poolAssets, currentToken, nextToken, currentAmount);
                        console.info(`Swap in pool ${poolIds[j]}: ${currentAmount.toString()} ${currentToken} -> ${outputAmount.toFixed(6)} ${nextToken}`);
                        console.info(`Slippage for this hop: ${slippage.multipliedBy(100).toFixed(2)}%`);
                        swapMsgs.push({
                            sender,
                            routes: [
                                {
                                    poolId: BigInt(poolIds[j]),
                                    tokenOutDenom: poolAssets.find((asset) => asset.symbol === nextToken).denom,
                                },
                            ],
                            tokenIn: {
                                denom: poolAssets.find((asset) => asset.symbol === currentToken)
                                    .denom,
                                amount: currentAmount.toString(),
                            },
                            tokenOutMinAmount: outputAmount.multipliedBy(0.99).toFixed(0), // 1% slippage tolerance
                        });
                        currentAmount = outputAmount;
                        currentToken = nextToken;
                    }
                    console.info(`Path ${i + 1} output: ${currentAmount.toFixed(6)} ${endToken}`);
                    totalOutput = totalOutput.plus(currentAmount);
                }
                // Encode swap messages
                const encodedMsgs = swapMsgs.map(this.encodeSwapMessage);
                // Execute the swap on Osmosis
                const fee = {
                    amount: [{ denom: "uosmo", amount: "5000" }],
                    gas: "200000",
                };
                const txResult = yield client.signAndBroadcast(sender, encodedMsgs, fee);
                console.info(`Transaction hash: ${txResult.transactionHash}`);
                return totalOutput;
            }
            catch (error) {
                console.error(`Failed to execute order: ${error}`);
                return new bignumber_js_1.default(0);
            }
            finally {
                yield session.close();
                yield driver.close();
            }
        });
    }
    findOptimalTradingStrategy(session_1, startToken_1, endToken_1, inputAmount_1, pools_1) {
        return __awaiter(this, arguments, void 0, function* (session, startToken, endToken, inputAmount, pools, maxDepth = 4, minLiquidity = 1000, maxPaths = 3) {
            const directPool = pools.find((pool) => pool.assets.some((asset) => asset.symbol === startToken) &&
                pool.assets.some((asset) => asset.symbol === endToken) &&
                pool.liquidity >= minLiquidity);
            if (directPool) {
                const directPath = this.simulateSwap(directPool.assets, startToken, endToken, inputAmount);
                const effectiveExchangeRate = directPath.outputAmount.dividedBy(inputAmount);
                return {
                    paths: [
                        {
                            path: [startToken, endToken],
                            poolIds: [directPool.id],
                            totalSlippage: directPath.slippage,
                            liquidityFactors: [
                                1 - 1 / (1 + directPool.liquidity / minLiquidity),
                            ],
                            expectedOutput: directPath.outputAmount,
                            effectiveExchangeRate: effectiveExchangeRate,
                        },
                    ],
                    amounts: [inputAmount],
                    totalExpectedOutput: directPath.outputAmount,
                };
            }
            const allPaths = yield this.findMultiplePaths(session, startToken, endToken, inputAmount, maxDepth, minLiquidity, maxPaths);
            return this.optimizeTradeSplit(allPaths, inputAmount);
        });
    }
    findMultiplePaths(session, startToken, endToken, inputAmount, maxDepth, minLiquidity, maxPaths) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield session.readTransaction((tx) => tx.run(`
        MATCH path = (start:Token {symbol: $start_symbol})-[:POOL*1..${maxDepth}]->(end:Token {symbol: $end_symbol})
        WHERE ALL(rel IN relationships(path) WHERE rel.liquidity >= $min_liquidity)
        WITH path,
             [rel in relationships(path) | rel.id] AS pool_ids,
             [node in nodes(path) | node.symbol] AS symbols,
             [rel in relationships(path) | {
                amount: rel.amount,
                liquidity: rel.liquidity,
                liquidityFactor: 1 - (1 / (1 + rel.liquidity / $min_liquidity))
             }] AS pool_data
        WITH *, range(0, size(pool_data)-1) AS indexes
        UNWIND indexes AS i
        WITH *, pool_data[i] AS current_pool, CASE WHEN i = 0 THEN $input_amount ELSE null END AS initial_amount
        WITH *, 
             CASE 
               WHEN initial_amount IS NOT NULL 
               THEN round(1000000 * initial_amount * 0.997 * toFloat(current_pool.liquidity) / (toFloat(current_pool.amount) + initial_amount * 0.997)) / 1000000.0
               ELSE null
             END AS output_amount
        WITH path, pool_ids, symbols, 
             reduce(s = 1, x IN collect(CASE WHEN output_amount IS NOT NULL THEN output_amount / initial_amount ELSE 1 END) | s * x) AS total_slippage,
             [pool IN pool_data | pool.liquidityFactor] AS liquidity_factors,
             LAST(collect(output_amount)) AS expected_output
        WITH *, expected_output / $input_amount AS effective_exchange_rate
        RETURN path, pool_ids, symbols, total_slippage, liquidity_factors, expected_output, effective_exchange_rate
        ORDER BY effective_exchange_rate DESC
        LIMIT toInteger($max_paths)
        `, {
                start_symbol: startToken,
                end_symbol: endToken,
                input_amount: inputAmount.toNumber(),
                min_liquidity: minLiquidity,
                max_paths: maxPaths,
            }));
            return result.records.map((record) => ({
                path: record.get("symbols"),
                poolIds: record.get("pool_ids"),
                totalSlippage: new bignumber_js_1.default(record.get("total_slippage")),
                liquidityFactors: record.get("liquidity_factors"),
                expectedOutput: new bignumber_js_1.default(record.get("expected_output")),
                effectiveExchangeRate: new bignumber_js_1.default(record.get("effective_exchange_rate")),
            }));
        });
    }
    optimizeTradeSplit(paths, totalInputAmount) {
        let amounts = paths.map(() => totalInputAmount.dividedBy(paths.length));
        let bestTotalOutput = this.calculateTotalOutput(paths, amounts);
        const iterations = 100;
        const step = totalInputAmount.dividedBy(100);
        for (let i = 0; i < iterations; i++) {
            for (let j = 0; j < paths.length; j++) {
                for (let k = 0; k < paths.length; k++) {
                    if (j !== k) {
                        const newAmounts = [...amounts];
                        newAmounts[j] = newAmounts[j].minus(step);
                        newAmounts[k] = newAmounts[k].plus(step);
                        const newTotalOutput = this.calculateTotalOutput(paths, newAmounts);
                        if (newTotalOutput.isGreaterThan(bestTotalOutput)) {
                            amounts = newAmounts;
                            bestTotalOutput = newTotalOutput;
                        }
                    }
                }
            }
        }
        return {
            paths,
            amounts,
            totalExpectedOutput: bestTotalOutput,
        };
    }
    calculatePoolLiquidity(assets) {
        return assets.reduce((sum, asset) => sum + parseFloat(asset.amount), 0);
    }
    simulateSwap(poolAssets, inputToken, outputToken, inputAmount) {
        const inputAsset = poolAssets.find((asset) => asset.symbol === inputToken);
        const outputAsset = poolAssets.find((asset) => asset.symbol === outputToken);
        if (!inputAsset || !outputAsset) {
            throw new Error(`Input or output token not found in pool`);
        }
        const inputReserve = new bignumber_js_1.default(inputAsset.amount);
        const outputReserve = new bignumber_js_1.default(outputAsset.amount);
        let outputAmount;
        const fee = new bignumber_js_1.default(0.997); // 0.3% fee
        if (this.STABLECOINS.has(inputToken) && this.STABLECOINS.has(outputToken)) {
            // For stable coin pairs, use a simple constant product formula with fee
            outputAmount = inputAmount.multipliedBy(fee);
        }
        else {
            // For other pairs, use the standard constant product formula
            const inputAmountWithFee = inputAmount.multipliedBy(fee);
            outputAmount = outputReserve
                .multipliedBy(inputAmountWithFee)
                .dividedBy(inputReserve.plus(inputAmountWithFee));
        }
        // Calculate slippage
        const spotPrice = inputReserve.dividedBy(outputReserve);
        const executionPrice = inputAmount.dividedBy(outputAmount);
        const slippage = executionPrice.minus(spotPrice).dividedBy(spotPrice).abs();
        // Calculate effective exchange rate
        const effectiveExchangeRate = outputAmount.dividedBy(inputAmount);
        return {
            outputAmount,
            slippage,
            effectiveExchangeRate,
        };
    }
    calculateSlippage(inputAmount, outputAmount, inputReserve, outputReserve) {
        const spotPrice = inputReserve.dividedBy(outputReserve);
        const executionPrice = inputAmount.dividedBy(outputAmount);
        const slippage = executionPrice.minus(spotPrice).dividedBy(spotPrice).abs();
        return bignumber_js_1.default.max(slippage, new bignumber_js_1.default(0));
    }
    calculateTotalOutput(paths, amounts) {
        return paths.reduce((total, path, index) => {
            const inputAmount = amounts[index];
            const outputAmount = path.expectedOutput
                .multipliedBy(inputAmount)
                .dividedBy(path.effectiveExchangeRate);
            return total.plus(outputAmount);
        }, new bignumber_js_1.default(0));
    }
    encodeSwapMessage(msg) {
        return {
            typeUrl: "/osmosis.gamm.v1beta1.MsgSwapExactAmountIn",
            value: {
                sender: msg.sender,
                routes: msg.routes.map((route) => ({
                    poolId: route.poolId.toString(),
                    tokenOutDenom: route.tokenOutDenom,
                })),
                tokenIn: msg.tokenIn,
                tokenOutMinAmount: msg.tokenOutMinAmount,
            },
        };
    }
    run() {
        return __awaiter(this, void 0, void 0, function* () {
            console.info("Starting Multi-Hop Osmosis AMM Integration Script with Multi-Asset Pool Support");
            // Test Neo4j connection
            const driver = neo4j_driver_1.default.driver(this.URI, neo4j_driver_1.default.auth.basic(this.AUTH.username, this.AUTH.password));
            const session = driver.session();
            try {
                yield session.run("RETURN 1 AS result");
                console.info("Successfully connected to Neo4j.");
            }
            catch (error) {
                console.error(`Failed to connect to Neo4j: ${error}`);
                return;
            }
            finally {
                yield session.close();
            }
            console.info("Fetching pool data from Osmosis API...");
            const pools = yield this.fetchPoolData();
            if (pools) {
                console.info(`Fetched data for ${Object.keys(pools).length} pools.`);
                this.validateStablecoinPools(pools);
            }
            else {
                console.error("Failed to fetch pool data. Check the logs for more information.");
                return;
            }
            console.info("\nImporting data to Neo4j...");
            yield this.importDataToNeo4j(driver, pools);
            // Generate a wallet
            const wallet = yield proto_signing_1.DirectSecp256k1HdWallet.generate(12, {
                prefix: "osmo",
            });
            const [firstAccount] = yield wallet.getAccounts();
            console.info(`\nGenerated simulated wallet address: ${firstAccount.address}`);
            console.info("This is a simulated wallet. In a real scenario, you would need to fund this wallet with tokens.");
            // Set up Osmosis client
            const client = yield stargate_1.SigningStargateClient.connectWithSigner(process.env.OSMOSIS_RPC_URL || "https://rpc.osmosis.zone", wallet, { gasPrice: stargate_1.GasPrice.fromString("0.025uosmo") });
            const availableTokens = new Set(Object.values(pools).flatMap((poolAssets) => poolAssets.map((asset) => asset.symbol)));
            const rl = (0, readline_1.createInterface)({
                input: process.stdin,
                output: process.stdout,
            });
            const prompt = (question) => {
                return new Promise((resolve) => {
                    rl.question(question, (answer) => {
                        resolve(answer);
                    });
                });
            };
            while (true) {
                const startToken = yield prompt("\nEnter the starting token symbol (or 'quit' to exit): ");
                if (startToken.toLowerCase() === "quit")
                    break;
                if (!availableTokens.has(startToken)) {
                    console.info(`Invalid token. Available tokens: ${Array.from(availableTokens).join(", ")}`);
                    continue;
                }
                const endToken = yield prompt("Enter the target token symbol: ");
                if (!availableTokens.has(endToken)) {
                    console.info(`Invalid token. Available tokens: ${Array.from(availableTokens).join(", ")}`);
                    continue;
                }
                const inputAmountStr = yield prompt("Enter the amount to swap: ");
                const inputAmount = new bignumber_js_1.default(inputAmountStr);
                if (inputAmount.isNaN() || inputAmount.isLessThanOrEqualTo(0)) {
                    console.info("Invalid amount. Please enter a valid positive number.");
                    continue;
                }
                yield this.executeOrder(client, pools, startToken, endToken, inputAmount, firstAccount.address);
            }
            rl.close();
            yield driver.close();
            console.info("\nThank you for using the Multi-Hop Osmosis AMM Integration Script. Goodbye!");
        });
    }
}
exports.CosmosAggregator = CosmosAggregator;
// Export the CosmosAggregator class as default
exports.default = CosmosAggregator;
// If you want to run the script directly:
if (require.main === module) {
    const cosmosAggregator = new CosmosAggregator();
    cosmosAggregator.run().catch(console.error);
}
