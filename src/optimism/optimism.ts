import { ethers } from "ethers";
import axios from "axios";
import BigNumber from "bignumber.js";
import neo4j, { Driver, Session, Transaction } from "neo4j-driver";
import dotenv from 'dotenv';
import { OptimismWallet } from './wallet';

dotenv.config();

// Set BigNumber configuration
BigNumber.config({ DECIMAL_PLACES: 18, ROUNDING_MODE: BigNumber.ROUND_DOWN });

// Interfaces
interface PoolAsset {
  symbol: string;
  address: string;
  amount: string;
  feeTier: string;
}

interface PoolData {
  [key: string]: PoolAsset[];
}

interface PoolInfo {
  id: string;
  assets: PoolAsset[];
  liquidity: number;
  feeTier: string;
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

export class OptimismAggregator {
  private provider: ethers.JsonRpcProvider;
  private SUBGRAPH_URL: string;
  private wallet: OptimismWallet;

  constructor(rpcUrl: string, subgraphUrl: string, wallet: OptimismWallet) {
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.SUBGRAPH_URL = subgraphUrl;
    this.wallet = wallet;
  }

  

  async fetchPoolData(): Promise<PoolData | null> {
    const query = `
      query {
        pools(first: 1000, orderBy: totalValueLockedUSD, orderDirection: desc) {
          id
          token0 {
            id
            symbol
            name
          }
          token1 {
            id
            symbol
            name
          }
          feeTier
          liquidity
          token0Price
          token1Price
        }
      }
    `;

    try {
      const response = await axios.post(this.SUBGRAPH_URL, { query });
      const pools = response.data.data.pools;

      const formattedPools: PoolData = {};
      pools.forEach((pool: any) => {
        formattedPools[pool.id] = [
          {
            symbol: pool.token0.symbol,
            address: pool.token0.id,
            amount: new BigNumber(pool.liquidity)
              .multipliedBy(pool.token0Price)
              .toString(),
            feeTier: pool.feeTier,
          },
          {
            symbol: pool.token1.symbol,
            address: pool.token1.id,
            amount: pool.liquidity,
            feeTier: pool.feeTier,
          },
        ];
      });
      return formattedPools;
    } catch (error) {
      console.error(`Failed to fetch pool data: ${error}`);
      return null;
    }
  }

  async executeOrder(
    provider: ethers.JsonRpcProvider,
    pools: PoolData,
    startToken: string,
    endToken: string,
    inputAmount: BigNumber,
    sender: string,
    minLiquidity: number = 1000,
    maxPaths: number = 3
  ): Promise<BigNumber> {
    const driver = neo4j.driver(
      process.env.NEO4J_URI || "bolt://localhost:7687",
      neo4j.auth.basic(
        process.env.NEO4J_USERNAME || "neo4j",
        process.env.NEO4J_PASSWORD || "password"
      )
    );
    const session = driver.session();

    try {
      const poolInfos: PoolInfo[] = Object.entries(pools).map(([id, assets]) => ({
        id,
        assets,
        liquidity: this.calculatePoolLiquidity(assets),
        feeTier: assets[0].feeTier,
      }));

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
        console.warn(`No conversion path found from ${startToken} to ${endToken}`);
        return new BigNumber(0);
      }

      console.info(`Executing order: ${inputAmount.toString()} ${startToken} to ${endToken}`);
      console.info(`Number of paths: ${optimalStrategy.paths.length}`);
      console.info(`Estimated total output: ${optimalStrategy.totalExpectedOutput.toFixed(6)} ${endToken}`);

      // Here you would implement the actual swap execution logic
      // This is a placeholder that assumes the swap was successful
      return optimalStrategy.totalExpectedOutput;
    } finally {
      await session.close();
      await driver.close();
    }
  }

  async prepareSwapTransaction(sourceToken: string, destToken: string, amount: string): Promise<ethers.ContractTransaction> {
    // This is a placeholder implementation
    // In a real scenario, you would encode the actual swap function call for your DEX contract
    const dexContract = new ethers.Contract("DEX_CONTRACT_ADDRESS", ["function swap(address,address,uint256)"], this.provider);
    return await dexContract.swap.populateTransaction(sourceToken, destToken, ethers.parseUnits(amount, 18));
  }

  private calculatePoolLiquidity(assets: PoolAsset[]): number {
    return assets.reduce((sum, asset) => sum + parseFloat(asset.amount), 0);
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
    // First, check for a direct pool
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
      const effectiveExchangeRate = directPath.outputAmount.dividedBy(inputAmount);
      return {
        paths: [
          {
            path: [startToken, endToken],
            poolIds: [directPool.id],
            totalSlippage: directPath.slippage,
            liquidityFactors: [1 - 1 / (1 + directPool.liquidity / minLiquidity)],
            expectedOutput: directPath.outputAmount,
            effectiveExchangeRate: effectiveExchangeRate,
          },
        ],
        amounts: [inputAmount],
        totalExpectedOutput: directPath.outputAmount,
      };
    }

    // If no direct pool, find multiple paths
    const allPaths = await this.findMultiplePaths(
      session,
      startToken,
      endToken,
      inputAmount,
      maxDepth,
      minLiquidity,
      maxPaths
    );

    // Optimize trade splitting
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
      effectiveExchangeRate: new BigNumber(record.get("effective_exchange_rate") as number),
    }));
  }

  private optimizeTradeSplit(paths: PathResult[], totalInputAmount: BigNumber): SplitTrade {
    // Start with equal split
    let amounts = paths.map(() => totalInputAmount.dividedBy(paths.length));
    let bestTotalOutput = this.calculateTotalOutput(paths, amounts);

    // Use a simple hill-climbing algorithm to optimize
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
    const outputAsset = poolAssets.find((asset) => asset.symbol === outputToken);

    if (!inputAsset || !outputAsset) {
      throw new Error(`Input or output token not found in pool`);
    }

    const inputReserve = new BigNumber(inputAsset.amount);
    const outputReserve = new BigNumber(outputAsset.amount);

    const feeTier = new BigNumber(inputAsset.feeTier).dividedBy(1000000); // Convert from bps to decimal
    const fee = new BigNumber(1).minus(feeTier);

    const inputAmountWithFee = inputAmount.multipliedBy(fee);
    const outputAmount = outputReserve
      .multipliedBy(inputAmountWithFee)
      .dividedBy(inputReserve.plus(inputAmountWithFee));

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

  private calculateTotalOutput(paths: PathResult[], amounts: BigNumber[]): BigNumber {
    return paths.reduce((total, path, index) => {
      const inputAmount = amounts[index];
      const outputAmount = path.expectedOutput
        .multipliedBy(inputAmount)
        .dividedBy(path.effectiveExchangeRate);
      return total.plus(outputAmount);
    }, new BigNumber(0));
  }
}