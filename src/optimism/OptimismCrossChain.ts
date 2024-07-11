import { OptimismAggregator } from "./optimism";
import { OptimismWallet } from "./wallet";
import { AxelarBridge } from "../axelar/AxelarBridge";
import { Environment } from "@axelar-network/axelarjs-sdk";
import BigNumber from "bignumber.js";

export class OptimismCrossChain {
  private optimismAggregator: OptimismAggregator;
  private axelarBridge: AxelarBridge;
  private wallet: OptimismWallet;

  constructor(
    rpcUrl: string,
    subgraphUrl: string,
    axelarEnvironment: Environment
  ) {
    this.wallet = new OptimismWallet();
    this.optimismAggregator = new OptimismAggregator(
      rpcUrl,
      subgraphUrl,
      this.wallet
    );
    this.axelarBridge = new AxelarBridge(axelarEnvironment);
  }

  async initialize(privateKey: string, rpcUrl: string) {
    try {
      console.log("Initializing Optimism wallet for cross-chain operations...");
      await this.wallet.initialize(privateKey, rpcUrl);
      console.log(
        "Optimism wallet initialized successfully for cross-chain operations"
      );
    } catch (error) {
      console.error(
        "Failed to initialize Optimism wallet for cross-chain operations:",
        error
      );
      throw error;
    }
  }

  

  async swapAndBridge(
    sourceToken: string,
    amount: string,
    destinationChain: string,
    destinationAddress: string
  ) {
    try {
      console.log(
        `Initiating swap and bridge: ${amount} ${sourceToken} to ${destinationChain}`
      );
      const pools = await this.optimismAggregator.fetchPoolData();
      if (!pools) throw new Error("Failed to fetch pool data");

      console.log("Executing order...");
      const provider = await this.wallet.getProvider();
      const usdcAmount = await this.optimismAggregator.executeOrder(
        provider,
        pools,
        sourceToken,
        "USDC",
        new BigNumber(amount),
        await this.wallet.getAddress(),
        1000, // minLiquidity, adjust as needed
        3 // maxPaths, adjust as needed
      );
      console.log(`Order executed. USDC amount: ${usdcAmount}`);

      console.log("Preparing transfer messages...");
      const preparedMessage = await this.axelarBridge.prepareTransferMessages(
        "optimism",
        destinationChain,
        "USDC",
        usdcAmount.toString(),
        destinationAddress,
        await this.wallet.getAddress(),
        destinationAddress
      );
      console.log("Transfer messages prepared");

      console.log("Executing transfer...");
      const result = await this.axelarBridge.executeTransfer(preparedMessage);
      console.log("Transfer executed");

      return result;
    } catch (error) {
      console.error("Error in swapAndBridge:", error);
      throw error;
    }
  }

  async receiveAndSwap(
    sourceChain: string,
    usdcAmount: string,
    destinationToken: string
  ) {
    try {
      console.log(
        `Initiating receive and swap: ${usdcAmount} USDC from ${sourceChain} to ${destinationToken}`
      );
      const pools = await this.optimismAggregator.fetchPoolData();
      if (!pools) throw new Error("Failed to fetch pool data");

      console.log("Executing order...");
      const provider = await this.wallet.getProvider();
      const swapResult = await this.optimismAggregator.executeOrder(
        provider,
        pools,
        "USDC",
        destinationToken,
        new BigNumber(usdcAmount),
        await this.wallet.getAddress(),
        1000, // minLiquidity, adjust as needed
        3 // maxPaths, adjust as needed
      );
      console.log("Order executed");

      return swapResult;
    } catch (error) {
      console.error("Error in receiveAndSwap:", error);
      throw error;
    }
  }
}
