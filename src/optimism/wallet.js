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
exports.OptimismWallet = void 0;
const ethers_1 = require("ethers");
class OptimismWallet {
    constructor() {
        this.wallet = null;
        this.provider = null;
        // Add other necessary wallet methods here
    }
    initialize(privateKey, rpcUrl) {
        return __awaiter(this, void 0, void 0, function* () {
            this.provider = new ethers_1.ethers.JsonRpcProvider(rpcUrl);
            this.wallet = new ethers_1.ethers.Wallet(privateKey, this.provider);
        });
    }
    getAddress() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.wallet)
                throw new Error("Wallet not initialized");
            return this.wallet.address;
        });
    }
    getProvider() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.provider)
                throw new Error("Provider not initialized");
            return this.provider;
        });
    }
    signAndSendTransaction(transaction) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.wallet)
                throw new Error("Wallet not initialized");
            return this.wallet.sendTransaction(transaction);
        });
    }
}
exports.OptimismWallet = OptimismWallet;
