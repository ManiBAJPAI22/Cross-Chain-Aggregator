import { CosmosAggregator } from './cosmos';
import { AxelarBridge } from '../axelar/AxelarBridge';
import { CosmosWallet } from './wallet';
import { Environment } from '@axelar-network/axelarjs-sdk';
import BigNumber from 'bignumber.js';

export class CosmosCrossChain {
  private cosmosAggregator: CosmosAggregator;
  private axelarBridge: AxelarBridge;
  private wallet: CosmosWallet;

  constructor(axelarEnvironment: Environment, chainId: string) {
    this.cosmosAggregator = new CosmosAggregator();
    this.axelarBridge = new AxelarBridge(axelarEnvironment);
    this.wallet = new CosmosWallet(chainId);
  }

  async initialize(rpcUrl: string, mnemonic?: string) {
    try {
      console.log("Initializing Osmosis wallet for cross-chain operations...");
      await this.wallet.initialize(rpcUrl, mnemonic);
      console.log("Osmosis wallet initialized successfully for cross-chain operations");
    } catch (error) {
      console.error('Failed to initialize Osmosis wallet for cross-chain operations:', error);
      throw error;
    }
  }

  async swapAndBridge(sourceToken: string, amount: string, destinationChain: string, destinationAddress: string) {
    try {
      console.log(`Initiating swap and bridge: ${amount} ${sourceToken} to ${destinationChain}`);
      const pools = await this.cosmosAggregator.fetchPoolData();
      if (!pools) throw new Error("Failed to fetch pool data");

      console.log("Executing order...");
      const usdcAmount = await this.cosmosAggregator.executeOrder(
        await this.wallet.getSigningClient(),
        pools,
        sourceToken,
        'USDC',
        new BigNumber(amount),
        await this.wallet.getAddress()
      );
      console.log(`Order executed. USDC amount: ${usdcAmount}`);

      console.log("Preparing transfer messages...");
      const preparedMessage = await this.axelarBridge.prepareTransferMessages(
        'osmosis',
        destinationChain,
        'USDC',
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
      console.error('Error in swapAndBridge:', error);
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
      const pools = await this.cosmosAggregator.fetchPoolData();
      if (!pools) throw new Error("Failed to fetch pool data");

      console.log("Executing order...");
      const swapResult = await this.cosmosAggregator.executeOrder(
        await this.wallet.getSigningClient(),
        pools,
        "USDC",
        destinationToken,
        new BigNumber(usdcAmount),
        await this.wallet.getAddress()
      );
      console.log("Order executed");

      return swapResult;
    } catch (error) {
      console.error("Error in receiveAndSwap:", error);
      throw error;
    }
  }
}
