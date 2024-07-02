import { ethers } from "ethers";

export class OptimismWallet {
  private wallet: ethers.Wallet | null = null;
  private provider: ethers.JsonRpcProvider | null = null;

  async initialize(privateKey: string, rpcUrl: string) {
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.wallet = new ethers.Wallet(privateKey, this.provider);
  }

  async getAddress(): Promise<string> {
    if (!this.wallet) throw new Error("Wallet not initialized");
    return this.wallet.address;
  }

  async getProvider(): Promise<ethers.JsonRpcProvider> {
    if (!this.provider) throw new Error("Provider not initialized");
    return this.provider;
  }

  async signAndSendTransaction(transaction: ethers.TransactionRequest): Promise<ethers.TransactionResponse> {
    if (!this.wallet) throw new Error("Wallet not initialized");
    return this.wallet.sendTransaction(transaction);
  }

  // Add other necessary wallet methods here
}