import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
import {
  SigningStargateClient,
  StdFee,
  calculateFee,
  GasPrice,
} from "@cosmjs/stargate";
import { Window as KeplrWindow } from "@keplr-wallet/types";

declare global {
  interface Window extends KeplrWindow {}
}

export class CosmosWallet {
  private wallet: DirectSecp256k1HdWallet | null = null;
  private client: SigningStargateClient | null = null;
  private address: string | null = null;
  private chainId: string;

  constructor(chainId: string) {
    this.chainId = chainId;
  }

  async initialize(rpcUrl: string, mnemonic?: string) {
    if (typeof window !== 'undefined' && window.keplr) {
      await this.initializeWithKeplr(rpcUrl);
    } else if (mnemonic) {
      await this.initializeWithMnemonic(rpcUrl, mnemonic);
    } else {
      throw new Error("Neither Keplr nor mnemonic is available");
    }
  }

  private async initializeWithKeplr(rpcUrl: string) {
    try {
      console.log("Enabling Keplr for chain:", this.chainId);
      await window.keplr!.enable(this.chainId);
      const offlineSigner = window.keplr!.getOfflineSigner(this.chainId);
      console.log("Got offline signer from Keplr");

      console.log("Connecting to RPC with Keplr signer...");
      this.client = await SigningStargateClient.connectWithSigner(rpcUrl, offlineSigner);
      console.log("Connected to RPC successfully");

      console.log("Getting accounts from Keplr...");
      const accounts = await offlineSigner.getAccounts();
      this.address = accounts[0].address;
      console.log("Got address from Keplr:", this.address);
    } catch (error) {
      console.error("Failed to initialize with Keplr:", error);
      throw error;
    }
  }

  private async initializeWithMnemonic(rpcUrl: string, mnemonic: string) {
    try {
      console.log("Creating wallet from mnemonic...");
      this.wallet = await DirectSecp256k1HdWallet.fromMnemonic(mnemonic, {
        prefix: "osmo", // Use "osmo" prefix for Osmosis addresses
      });
      console.log("Wallet created successfully from mnemonic");

      console.log("Connecting to RPC with signer...");
      this.client = await SigningStargateClient.connectWithSigner(rpcUrl, this.wallet);
      console.log("Connected to RPC successfully");

      console.log("Getting accounts...");
      const accounts = await this.wallet.getAccounts();
      this.address = accounts[0].address;
      console.log("Got address:", this.address);
    } catch (error) {
      console.error("Failed to initialize with mnemonic:", error);
      throw error;
    }
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
        GasPrice.fromString("0.025uosmo")  // Use uosmo for Osmosis
      );
    }

    return this.client.signAndBroadcast(this.address, messages, fee);
  }

  async getBalance(denom: string = "uosmo"): Promise<string> {
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