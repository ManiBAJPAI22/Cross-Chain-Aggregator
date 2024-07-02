import axios from "axios";
import BigNumber from "bignumber.js";
import neo4j, { Driver, Session, Transaction } from "neo4j-driver";
import { SigningStargateClient, GasPrice } from "@cosmjs/stargate";
import { DirectSecp256k1HdWallet, EncodeObject } from "@cosmjs/proto-signing";
import { createInterface } from "readline";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Set BigNumber configuration
BigNumber.config({ DECIMAL_PLACES: 18, ROUNDING_MODE: BigNumber.ROUND_DOWN });

export class CosmosAggregator {
  private URI: string;
  private AUTH: { username: string; password: string };
  private API_URL: string;
  private STABLECOINS: Set<string>;

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

  async fetchPoolData(): Promise<PoolData | null> {
    try {
      const response = await axios.get<PoolData>(this.API_URL);
      return response.data;
    } catch (error) {
      console.error(`Failed to fetch pool data: ${error}`);
      return null;
    }
  }

  validateStablecoinPools(pools: PoolData): void {
    for (const [poolId, poolAssets] of Object.entries(pools)) {
      const stablecoinAssets = poolAssets.filter((asset) =>
        this.STABLECOINS.has(asset.symbol)
      );

      if (stablecoinAssets.length >= 2) {
        const stablecoinAmounts = stablecoinAssets.map(
          (asset) => new BigNumber(asset.amount)
        );
        const avgAmount = stablecoinAmounts
          .reduce((a, b) => a.plus(b))
          .dividedBy(stablecoinAmounts.length);

        let adjusted = false;
        stablecoinAssets.forEach((asset) => {
          const ratio = new BigNumber(asset.amount).dividedBy(avgAmount);
          if (ratio.isLessThan("0.95") || ratio.isGreaterThan("1.05")) {
            console.warn(
              `Suspicious stablecoin in pool ${poolId}: ${
                asset.symbol
              } ratio: ${ratio.toString()}`
            );
            const poolIndex = poolAssets.findIndex(
              (a) => a.symbol === asset.symbol
            );
            pools[poolId][poolIndex].amount = avgAmount.toString();
            adjusted = true;
          }
        });

        if (adjusted) {
          console.info(
            `Adjusted stablecoins in pool ${poolId} to balanced ratios`
          );
        }
      }
    }
  }

  async importDataToNeo4j(driver: Driver, pools: PoolData): Promise<void> {
    if (!pools) {
      console.error("No data to import");
      return;
    }
    const session = driver.session();
    try {
      await session.writeTransaction((tx) => this.clearDatabase(tx));
      for (const [poolId, poolAssets] of Object.entries(pools)) {
        await session.writeTransaction((tx) =>
          this.createPoolRelationships(tx, poolId, poolAssets)
        );
      }
      console.info("Data import completed successfully.");
    } catch (error) {
      console.error(`Failed to import data to Neo4j: ${error}`);
    } finally {
      await session.close();
    }
  }

  private clearDatabase(tx: Transaction): void {
    tx.run("MATCH (n) DETACH DELETE n");
  }

  private createPoolRelationships(
    tx: Transaction,
    poolId: string,
    poolAssets: PoolAsset[]
  ): void {
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
      .reduce(
        (sum, asset) => sum.plus(new BigNumber(asset.amount)),
        new BigNumber(0)
      )
      .toString();

    tx.run(query, {
      assets: poolAssets,
      pool_id: poolId,
      totalLiquidity: totalLiquidity,
    });
  }

  async executeOrder(
    client: SigningStargateClient,
    pools: PoolData,
    startToken: string,
    endToken: string,
    inputAmount: BigNumber,
    sender: string,
    minLiquidity: number = 1000,
    maxPaths: number = 3
  ): Promise<BigNumber> {
    const driver = neo4j.driver(
      this.URI,
      neo4j.auth.basic(this.AUTH.username, this.AUTH.password)
    );
    const session = driver.session();
    try {
      const poolInfos: PoolInfo[] = Object.entries(pools).map(
        ([id, assets]) => ({
          id,
          assets,
          liquidity: this.calculatePoolLiquidity(assets),
        })
      );

      const optimalStrategy = await this.findOptimalTradingStrategy(
        session,
        startToken,
        endToken,
        inputAmount,
        poolInfos,
        7, // maxDepth
        minLiquidity,
        maxPaths
      );

      if (optimalStrategy.paths.length === 0) {
        console.warn(
          `No conversion path found from ${startToken} to ${endToken}`
        );
        return new BigNumber(0);
      }

      console.info(
        `Executing order: ${inputAmount.toString()} ${startToken} to ${endToken}`
      );
      console.info(`Number of paths: ${optimalStrategy.paths.length}`);
      console.info(
        `Estimated total output: ${optimalStrategy.totalExpectedOutput.toFixed(
          6
        )} ${endToken}`
      );

      const swapMsgs: SwapMessage[] = [];

      let totalOutput = new BigNumber(0);

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

          const { outputAmount, slippage } = this.simulateSwap(
            poolAssets,
            currentToken,
            nextToken,
            currentAmount
          );

          console.info(
            `Swap in pool ${
              poolIds[j]
            }: ${currentAmount.toString()} ${currentToken} -> ${outputAmount.toFixed(
              6
            )} ${nextToken}`
          );
          console.info(
            `Slippage for this hop: ${slippage.multipliedBy(100).toFixed(2)}%`
          );

          swapMsgs.push({
            sender,
            routes: [
              {
                poolId: BigInt(poolIds[j]),
                tokenOutDenom: poolAssets.find(
                  (asset) => asset.symbol === nextToken
                )!.denom,
              },
            ],
            tokenIn: {
              denom: poolAssets.find((asset) => asset.symbol === currentToken)!
                .denom,
              amount: currentAmount.toString(),
            },
            tokenOutMinAmount: outputAmount.multipliedBy(0.99).toFixed(0), // 1% slippage tolerance
          });

          currentAmount = outputAmount;
          currentToken = nextToken;
        }

        console.info(
          `Path ${i + 1} output: ${currentAmount.toFixed(6)} ${endToken}`
        );
        totalOutput = totalOutput.plus(currentAmount);
      }

      // Encode swap messages
      const encodedMsgs: EncodeObject[] = swapMsgs.map(this.encodeSwapMessage);

      // Execute the swap on Osmosis
      const fee = {
        amount: [{ denom: "uosmo", amount: "5000" }],
        gas: "200000",
      };

      const txResult = await client.signAndBroadcast(sender, encodedMsgs, fee);
      console.info(`Transaction hash: ${txResult.transactionHash}`);

      return totalOutput;
    } catch (error) {
      console.error(`Failed to execute order: ${error}`);
      return new BigNumber(0);
    } finally {
      await session.close();
      await driver.close();
    }
  }

  private async findOptimalTradingStrategy(
    session: Session,
    startToken: string,
    endToken: string,
    inputAmount: BigNumber,
    pools: PoolInfo[],
    maxDepth: number = 4,
    minLiquidity: number = 1000,
    maxPaths: number = 3
  ): Promise<SplitTrade> {
    const directPool = pools.find(
      (pool) =>
        pool.assets.some((asset) => asset.symbol === startToken) &&
        pool.assets.some((asset) => asset.symbol === endToken) &&
        pool.liquidity >= minLiquidity
    );

    if (directPool) {
      const directPath = this.simulateSwap(
        directPool.assets,
        startToken,
        endToken,
        inputAmount
      );
      const effectiveExchangeRate =
        directPath.outputAmount.dividedBy(inputAmount);
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

    const allPaths = await this.findMultiplePaths(
      session,
      startToken,
      endToken,
      inputAmount,
      maxDepth,
      minLiquidity,
      maxPaths
    );

    return this.optimizeTradeSplit(allPaths, inputAmount);
  }

  private async findMultiplePaths(
    session: Session,
    startToken: string,
    endToken: string,
    inputAmount: BigNumber,
    maxDepth: number,
    minLiquidity: number,
    maxPaths: number
  ): Promise<PathResult[]> {
    const result = await session.readTransaction((tx) =>
      tx.run(
        `
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
        `,
        {
          start_symbol: startToken,
          end_symbol: endToken,
          input_amount: inputAmount.toNumber(),
          min_liquidity: minLiquidity,
          max_paths: maxPaths,
        }
      )
    );

    return result.records.map((record) => ({
      path: record.get("symbols") as string[],
      poolIds: record.get("pool_ids") as string[],
      totalSlippage: new BigNumber(record.get("total_slippage") as number),
      liquidityFactors: record.get("liquidity_factors") as number[],
      expectedOutput: new BigNumber(record.get("expected_output") as number),
      effectiveExchangeRate: new BigNumber(
        record.get("effective_exchange_rate") as number
      ),
    }));
  }

  private optimizeTradeSplit(
    paths: PathResult[],
    totalInputAmount: BigNumber
  ): SplitTrade {
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

  private calculatePoolLiquidity(assets: PoolAsset[]): number {
    return assets.reduce((sum, asset) => sum + parseFloat(asset.amount), 0);
  }

  private simulateSwap(
    poolAssets: PoolAsset[],
    inputToken: string,
    outputToken: string,
    inputAmount: BigNumber
  ): {
    outputAmount: BigNumber;
    slippage: BigNumber;
    effectiveExchangeRate: BigNumber;
  } {
    const inputAsset = poolAssets.find((asset) => asset.symbol === inputToken);
    const outputAsset = poolAssets.find(
      (asset) => asset.symbol === outputToken
    );

    if (!inputAsset || !outputAsset) {
      throw new Error(`Input or output token not found in pool`);
    }

    const inputReserve = new BigNumber(inputAsset.amount);
    const outputReserve = new BigNumber(outputAsset.amount);

    let outputAmount: BigNumber;
    const fee = new BigNumber(0.997); // 0.3% fee

    if (this.STABLECOINS.has(inputToken) && this.STABLECOINS.has(outputToken)) {
      // For stable coin pairs, use a simple constant product formula with fee
      outputAmount = inputAmount.multipliedBy(fee);
    } else {
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

  private calculateSlippage(
    inputAmount: BigNumber,
    outputAmount: BigNumber,
    inputReserve: BigNumber,
    outputReserve: BigNumber
  ): BigNumber {
    const spotPrice = inputReserve.dividedBy(outputReserve);
    const executionPrice = inputAmount.dividedBy(outputAmount);
    const slippage = executionPrice.minus(spotPrice).dividedBy(spotPrice).abs();
    return BigNumber.max(slippage, new BigNumber(0));
  }

  private calculateTotalOutput(
    paths: PathResult[],
    amounts: BigNumber[]
  ): BigNumber {
    return paths.reduce((total, path, index) => {
      const inputAmount = amounts[index];
      const outputAmount = path.expectedOutput
        .multipliedBy(inputAmount)
        .dividedBy(path.effectiveExchangeRate);
      return total.plus(outputAmount);
    }, new BigNumber(0));
  }

  private encodeSwapMessage(msg: SwapMessage): EncodeObject {
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

  async run() {
    console.info(
      "Starting Multi-Hop Osmosis AMM Integration Script with Multi-Asset Pool Support"
    );

    // Test Neo4j connection
    const driver = neo4j.driver(
      this.URI,
      neo4j.auth.basic(this.AUTH.username, this.AUTH.password)
    );
    const session = driver.session();
    try {
      await session.run("RETURN 1 AS result");
      console.info("Successfully connected to Neo4j.");
    } catch (error) {
      console.error(`Failed to connect to Neo4j: ${error}`);
      return;
    } finally {
      await session.close();
    }

    console.info("Fetching pool data from Osmosis API...");
    const pools = await this.fetchPoolData();
    if (pools) {
      console.info(`Fetched data for ${Object.keys(pools).length} pools.`);
      this.validateStablecoinPools(pools);
    } else {
      console.error(
        "Failed to fetch pool data. Check the logs for more information."
      );
      return;
    }

    console.info("\nImporting data to Neo4j...");
    await this.importDataToNeo4j(driver, pools);

    // Generate a wallet
    const wallet = await DirectSecp256k1HdWallet.generate(12, {
      prefix: "osmo",
    });
    const [firstAccount] = await wallet.getAccounts();
    console.info(
      `\nGenerated simulated wallet address: ${firstAccount.address}`
    );
    console.info(
      "This is a simulated wallet. In a real scenario, you would need to fund this wallet with tokens."
    );

    // Set up Osmosis client
    const client = await SigningStargateClient.connectWithSigner(
      process.env.OSMOSIS_RPC_URL || "https://rpc.osmosis.zone",
      wallet,
      { gasPrice: GasPrice.fromString("0.025uosmo") }
    );

    const availableTokens = new Set(
      Object.values(pools).flatMap((poolAssets) =>
        poolAssets.map((asset) => asset.symbol)
      )
    );

    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const prompt = (question: string): Promise<string> => {
      return new Promise((resolve) => {
        rl.question(question, (answer) => {
          resolve(answer);
        });
      });
    };

    while (true) {
      const startToken = await prompt(
        "\nEnter the starting token symbol (or 'quit' to exit): "
      );
      if (startToken.toLowerCase() === "quit") break;
      if (!availableTokens.has(startToken)) {
        console.info(
          `Invalid token. Available tokens: ${Array.from(availableTokens).join(
            ", "
          )}`
        );
        continue;
      }

      const endToken = await prompt("Enter the target token symbol: ");
      if (!availableTokens.has(endToken)) {
        console.info(
          `Invalid token. Available tokens: ${Array.from(availableTokens).join(
            ", "
          )}`
        );
        continue;
      }

      const inputAmountStr = await prompt("Enter the amount to swap: ");
      const inputAmount = new BigNumber(inputAmountStr);
      if (inputAmount.isNaN() || inputAmount.isLessThanOrEqualTo(0)) {
        console.info("Invalid amount. Please enter a valid positive number.");
        continue;
      }

      await this.executeOrder(
        client,
        pools,
        startToken,
        endToken,
        inputAmount,
        firstAccount.address
      );
    }

    rl.close();
    await driver.close();
    console.info(
      "\nThank you for using the Multi-Hop Osmosis AMM Integration Script. Goodbye!"
    );
  }
}

// Interfaces
interface PoolAsset {
  symbol: string;
  denom: string;
  amount: string;
}

interface PoolData {
  [key: string]: PoolAsset[];
}

interface SwapMessage {
  sender: string;
  routes: {
    poolId: bigint;
    tokenOutDenom: string;
  }[];
  tokenIn: {
    denom: string;
    amount: string;
  };
  tokenOutMinAmount: string;
}

interface PoolInfo {
  id: string;
  assets: PoolAsset[];
  liquidity: number;
}

interface PathResult {
  path: string[];
  poolIds: string[];
  totalSlippage: BigNumber;
  liquidityFactors: number[];
  expectedOutput: BigNumber;
  effectiveExchangeRate: BigNumber;
}

interface SplitTrade {
  paths: PathResult[];
  amounts: BigNumber[];
  totalExpectedOutput: BigNumber;
}

// Export the CosmosAggregator class as default
export default CosmosAggregator;

// If you want to run the script directly:
if (require.main === module) {
  const cosmosAggregator = new CosmosAggregator();
  cosmosAggregator.run().catch(console.error);
}
