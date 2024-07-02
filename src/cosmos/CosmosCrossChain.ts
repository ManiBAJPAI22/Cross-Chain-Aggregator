import { CosmosAggregator } from './cosmos';
import { AxelarBridge } from '../axelar/AxelarBridge';
import { CosmosWallet } from './wallet';
import { Environment } from '@axelar-network/axelarjs-sdk';
import BigNumber from 'bignumber.js';

export class CosmosCrossChain {
  private cosmosAggregator: CosmosAggregator;
  private axelarBridge: AxelarBridge;
  private wallet: CosmosWallet;

  constructor(axelarEnvironment: Environment) {
    this.cosmosAggregator = new CosmosAggregator();
    this.axelarBridge = new AxelarBridge();
    this.wallet = new CosmosWallet();
  }

  async initialize(mnemonic: string, rpcUrl: string) {
    try {
      await this.wallet.initialize(mnemonic, rpcUrl);
    } catch (error) {
      console.error('Failed to initialize Cosmos wallet:', error);
      throw error;
    }
  }

  async swapAndBridge(sourceToken: string, amount: string, destinationChain: string, destinationAddress: string) {
    try {
      const pools = await this.cosmosAggregator.fetchPoolData();
      if (!pools) throw new Error("Failed to fetch pool data");

      const usdcAmount = await this.cosmosAggregator.executeOrder(
        await this.wallet.getSigningClient(),
        pools,
        sourceToken,
        'USDC',
        new BigNumber(amount),
        await this.wallet.getAddress()
      );

      const preparedMessage = await this.axelarBridge.prepareTransferMessages(
        'cosmos',
        destinationChain,
        'USDC',
        usdcAmount.toString(),
        destinationAddress,
        await this.wallet.getAddress(),
        destinationAddress
      );

      return this.axelarBridge.executeTransfer(preparedMessage);
    } catch (error) {
      console.error('Error in swapAndBridge:', error);
      throw error;
    }
  }

  async receiveAndSwap(sourceChain: string, usdcAmount: string, destinationToken: string) {
    try {
      const pools = await this.cosmosAggregator.fetchPoolData();
      if (!pools) throw new Error("Failed to fetch pool data");

      // Assume USDC has been received via Axelar
      const swapResult = await this.cosmosAggregator.executeOrder(
        await this.wallet.getSigningClient(),
        pools,
        'USDC',
        destinationToken,
        new BigNumber(usdcAmount),
        await this.wallet.getAddress()
      );

      return swapResult;
    } catch (error) {
      console.error('Error in receiveAndSwap:', error);
      throw error;
    }
  }
}