import { OptimismAggregator } from './optimism';
import { OptimismWallet } from './wallet';
import { AxelarBridge } from '../axelar/AxelarBridge';
import { Environment } from '@axelar-network/axelarjs-sdk';
import BigNumber from 'bignumber.js';

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
    this.optimismAggregator = new OptimismAggregator(rpcUrl, subgraphUrl, this.wallet);
    this.axelarBridge = new AxelarBridge();
  }

  async initialize(privateKey: string, rpcUrl: string) {
    try {
      await this.wallet.initialize(privateKey, rpcUrl);
    } catch (error) {
      console.error('Failed to initialize Optimism wallet:', error);
      throw error;
    }
  }

  async swapAndBridge(sourceToken: string, amount: string, destinationChain: string, destinationAddress: string) {
    try {
      const pools = await this.optimismAggregator.fetchPoolData();
      if (!pools) throw new Error("Failed to fetch pool data");

      const provider = await this.wallet.getProvider();
      const usdcAmount = await this.optimismAggregator.executeOrder(
        provider,
        pools,
        sourceToken,
        'USDC',
        new BigNumber(amount),
        await this.wallet.getAddress(),
        1000, // minLiquidity, adjust as needed
        3    // maxPaths, adjust as needed
      );

      const preparedMessage = await this.axelarBridge.prepareTransferMessages(
        'optimism',
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
      const pools = await this.optimismAggregator.fetchPoolData();
      if (!pools) throw new Error("Failed to fetch pool data");

      const provider = await this.wallet.getProvider();
      const swapResult = await this.optimismAggregator.executeOrder(
        provider,
        pools,
        'USDC',
        destinationToken,
        new BigNumber(usdcAmount),
        await this.wallet.getAddress(),
        1000, // minLiquidity, adjust as needed
        3    // maxPaths, adjust as needed
      );

      return swapResult;
    } catch (error) {
      console.error('Error in receiveAndSwap:', error);
      throw error;
    }
  }
}