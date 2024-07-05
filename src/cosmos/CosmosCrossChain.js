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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CosmosCrossChain = void 0;
const cosmos_1 = require("./cosmos");
const AxelarBridge_1 = require("../axelar/AxelarBridge");
const wallet_1 = require("./wallet");
const bignumber_js_1 = __importDefault(require("bignumber.js"));
class CosmosCrossChain {
    constructor(axelarEnvironment, chainId) {
        this.cosmosAggregator = new cosmos_1.CosmosAggregator();
        this.axelarBridge = new AxelarBridge_1.AxelarBridge(axelarEnvironment);
        this.wallet = new wallet_1.CosmosWallet(chainId);
    }
    initialize(rpcUrl, mnemonic) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                console.log("Initializing Osmosis wallet for cross-chain operations...");
                yield this.wallet.initialize(rpcUrl, mnemonic);
                console.log("Osmosis wallet initialized successfully for cross-chain operations");
            }
            catch (error) {
                console.error('Failed to initialize Osmosis wallet for cross-chain operations:', error);
                throw error;
            }
        });
    }
    swapAndBridge(sourceToken, amount, destinationChain, destinationAddress) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                console.log(`Initiating swap and bridge: ${amount} ${sourceToken} to ${destinationChain}`);
                const pools = yield this.cosmosAggregator.fetchPoolData();
                if (!pools)
                    throw new Error("Failed to fetch pool data");
                console.log("Executing order...");
                const usdcAmount = yield this.cosmosAggregator.executeOrder(yield this.wallet.getSigningClient(), pools, sourceToken, 'USDC', new bignumber_js_1.default(amount), yield this.wallet.getAddress());
                console.log(`Order executed. USDC amount: ${usdcAmount}`);
                console.log("Preparing transfer messages...");
                const preparedMessage = yield this.axelarBridge.prepareTransferMessages('osmosis', destinationChain, 'USDC', usdcAmount.toString(), destinationAddress, yield this.wallet.getAddress(), destinationAddress);
                console.log("Transfer messages prepared");
                console.log("Executing transfer...");
                const result = yield this.axelarBridge.executeTransfer(preparedMessage);
                console.log("Transfer executed");
                return result;
            }
            catch (error) {
                console.error('Error in swapAndBridge:', error);
                throw error;
            }
        });
    }
    receiveAndSwap(sourceChain, usdcAmount, destinationToken) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                console.log(`Initiating receive and swap: ${usdcAmount} USDC from ${sourceChain} to ${destinationToken}`);
                const pools = yield this.cosmosAggregator.fetchPoolData();
                if (!pools)
                    throw new Error("Failed to fetch pool data");
                console.log("Executing order...");
                const swapResult = yield this.cosmosAggregator.executeOrder(yield this.wallet.getSigningClient(), pools, "USDC", destinationToken, new bignumber_js_1.default(usdcAmount), yield this.wallet.getAddress());
                console.log("Order executed");
                return swapResult;
            }
            catch (error) {
                console.error("Error in receiveAndSwap:", error);
                throw error;
            }
        });
    }
}
exports.CosmosCrossChain = CosmosCrossChain;
