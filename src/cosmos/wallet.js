"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CosmosWallet = void 0;
const proto_signing_1 = require("@cosmjs/proto-signing");
const stargate_1 = require("@cosmjs/stargate");
class CosmosWallet {
    constructor() {
        this.wallet = null;
        this.client = null;
        this.address = null;
    }
    initialize(mnemonic, rpcUrl) {
        return __awaiter(this, void 0, void 0, function* () {
            this.wallet = yield proto_signing_1.DirectSecp256k1HdWallet.fromMnemonic(mnemonic);
            this.client = yield stargate_1.SigningStargateClient.connectWithSigner(rpcUrl, this.wallet);
            const accounts = yield this.wallet.getAccounts();
            this.address = accounts[0].address;
        });
    }
    getAddress() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.address)
                throw new Error("Wallet not initialized");
            return this.address;
        });
    }
    getSigningClient() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.client)
                throw new Error("Client not initialized");
            return this.client;
        });
    }
    signAndBroadcast(messages, fee) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.client || !this.address)
                throw new Error("Wallet not initialized");
            if (fee === "auto" || typeof fee === "number") {
                const gasEstimation = yield this.client.simulate(this.address, messages, "");
                const multiplier = typeof fee === "number" ? fee : 1.3;
                fee = (0, stargate_1.calculateFee)(Math.round(gasEstimation * multiplier), stargate_1.GasPrice.fromString("0.025uatom"));
            }
            return this.client.signAndBroadcast(this.address, messages, fee);
        });
    }
    getBalance() {
        return __awaiter(this, arguments, void 0, function* (denom = "uatom") {
            if (!this.client || !this.address)
                throw new Error("Wallet not initialized");
            const balance = yield this.client.getBalance(this.address, denom);
            return balance.amount;
        });
    }
    getWallet() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.wallet) {
                throw new Error("Wallet not initialized");
            }
            return this.wallet;
        });
    }
}
exports.CosmosWallet = CosmosWallet;