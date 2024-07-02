import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
import {
  SigningStargateClient,
  StdFee,
  calculateFee,
  GasPrice,
} from "@cosmjs/stargate";

export class CosmosWallet {
  private wallet: DirectSecp256k1HdWallet | null = null;
  private client: SigningStargateClient | null = null;
  private address: string | null = null;

  async initialize(mnemonic: string, rpcUrl: string) {
    this.wallet = await DirectSecp256k1HdWallet.fromMnemonic(mnemonic);
    this.client = await SigningStargateClient.connectWithSigner(
      rpcUrl,
      this.wallet
    );
    const accounts = await this.wallet.getAccounts();
    this.address = accounts[0].address;
  }

  async getAddress(): Promise<string> {
    if (!this.address) throw new Error("Wallet not initialized");
    return this.address;
  }

  async getSigningClient(): Promise<SigningStargateClient> {
    if (!this.client) throw new Error("Client not initialized");
    return this.client;
  }

  async signAndBroadcast(
    messages: any[],
    fee: StdFee | "auto" | number
  ): Promise<any> {
    if (!this.client || !this.address)
      throw new Error("Wallet not initialized");

    if (fee === "auto" || typeof fee === "number") {
      const gasEstimation = await this.client.simulate(
        this.address,
        messages,
        ""
      );
      const multiplier = typeof fee === "number" ? fee : 1.3;
      fee = calculateFee(
        Math.round(gasEstimation * multiplier),
        GasPrice.fromString("0.025uatom")
      );
    }

    return this.client.signAndBroadcast(this.address, messages, fee);
  }

  async getBalance(denom: string = "uatom"): Promise<string> {
    if (!this.client || !this.address)
      throw new Error("Wallet not initialized");
    const balance = await this.client.getBalance(this.address, denom);
    return balance.amount;
  }

  async getWallet(): Promise<DirectSecp256k1HdWallet> {
    if (!this.wallet) {
      throw new Error("Wallet not initialized");
    }
    return this.wallet;
  }
}
