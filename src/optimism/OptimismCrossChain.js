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
exports.OptimismCrossChain = void 0;
const optimism_1 = require("./optimism");
const wallet_1 = require("./wallet");
const AxelarBridge_1 = require("../axelar/AxelarBridge");
const bignumber_js_1 = __importDefault(require("bignumber.js"));
class OptimismCrossChain {
    constructor(rpcUrl, subgraphUrl, axelarEnvironment) {
        this.wallet = new wallet_1.OptimismWallet();
        this.optimismAggregator = new optimism_1.OptimismAggregator(rpcUrl, subgraphUrl, this.wallet);
        this.axelarBridge = new AxelarBridge_1.AxelarBridge(axelarEnvironment);
    }
    initialize(privateKey, rpcUrl) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.wallet.initialize(privateKey, rpcUrl);
            }
            catch (error) {
                console.error('Failed to initialize Optimism wallet:', error);
                throw error;
            }
        });
    }
    swapAndBridge(sourceToken, amount, destinationChain, destinationAddress) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const pools = yield this.optimismAggregator.fetchPoolData();
                if (!pools)
                    throw new Error("Failed to fetch pool data");
                const provider = yield this.wallet.getProvider();
                const usdcAmount = yield this.optimismAggregator.executeOrder(provider, pools, sourceToken, 'USDC', new bignumber_js_1.default(amount), yield this.wallet.getAddress(), 1000, // minLiquidity, adjust as needed
                3 // maxPaths, adjust as needed
                );
                const preparedMessage = yield this.axelarBridge.prepareTransferMessages('optimism', destinationChain, 'USDC', usdcAmount.toString(), destinationAddress, yield this.wallet.getAddress(), destinationAddress);
                return this.axelarBridge.executeTransfer(preparedMessage);
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
                const pools = yield this.optimismAggregator.fetchPoolData();
                if (!pools)
                    throw new Error("Failed to fetch pool data");
                const provider = yield this.wallet.getProvider();
                const swapResult = yield this.optimismAggregator.executeOrder(provider, pools, 'USDC', destinationToken, new bignumber_js_1.default(usdcAmount), yield this.wallet.getAddress(), 1000, // minLiquidity, adjust as needed
                3 // maxPaths, adjust as needed
                );
                return swapResult;
            }
            catch (error) {
                console.error('Error in receiveAndSwap:', error);
                throw error;
            }
        });
    }
}
exports.OptimismCrossChain = OptimismCrossChain;
