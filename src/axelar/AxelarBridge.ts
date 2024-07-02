import { AxelarQueryAPI, Environment, EvmChain, GasToken } from '@axelar-network/axelarjs-sdk';
import axelarConfig from './config';

export class AxelarBridge {
  private axelarQuery: AxelarQueryAPI;

  constructor() {
    this.axelarQuery = new AxelarQueryAPI({ 
      environment: axelarConfig.environment
    });
  }

  async prepareTransferMessages(
    sourceChain: string,
    destChain: string,
    asset: string,
    amount: string,
    recipient: string,
    sourceContractAddress: string,
    destinationContractAddress: string
  ) {
    try {
      const sourceEvmChain = this.getEvmChain(sourceChain);
      const destEvmChain = this.getEvmChain(destChain);
  
      const gasFee = await this.axelarQuery.estimateGasFee(
        sourceEvmChain,
        destEvmChain,
        asset as GasToken,
        axelarConfig.axelarSettings.gasLimit,
        axelarConfig.axelarSettings.gasMultiplier
      );
  
      console.log(`Estimated transfer fee:`, gasFee);
  
      const sourceTokenAddress = this.getTokenAddress(sourceChain, asset);
      const destTokenAddress = this.getTokenAddress(destChain, asset);
  
      const sourceGateway = axelarConfig.gatewayAddresses[sourceChain as keyof typeof axelarConfig.gatewayAddresses] || '';
      const destGateway = axelarConfig.gatewayAddresses[destChain as keyof typeof axelarConfig.gatewayAddresses] || '';
  
      return {
        sourceChain,
        destinationChain: destChain,
        asset,
        amount,
        recipient,
        gasFee,
        sourceContractAddress,
        destinationContractAddress,
        sourceTokenAddress,
        destTokenAddress,
        sourceGateway,
        destGateway
      };
    } catch (error) {
      console.error('Error preparing transfer messages:', error);
      throw error;
    }
  }
  
  private getTokenAddress(chain: string, asset: string): string {
    const chainTokens = axelarConfig.tokenAddresses[chain as keyof typeof axelarConfig.tokenAddresses];
    if (chainTokens && typeof chainTokens === 'object' && asset in chainTokens) {
      return chainTokens[asset as keyof typeof chainTokens];
    }
    throw new Error(`Token ${asset} not found for chain ${chain}`);
  }

  async executeTransfer(preparedMessage: any) {
    console.log("Executing cross-chain transfer:", preparedMessage);
    
    const gasReceiverAddress = axelarConfig.gasReceiver[preparedMessage.sourceChain as keyof typeof axelarConfig.gasReceiver] || '';
    console.log("Gas receiver address:", gasReceiverAddress);

    // Placeholder implementation
    return true;
  }

  private getEvmChain(chainName: string): EvmChain {
    const chain = axelarConfig.supportedChains[chainName.toLowerCase() as keyof typeof axelarConfig.supportedChains];
    if (!chain) {
      throw new Error(`Unsupported chain: ${chainName}`);
    }
    return chain;
  }
}