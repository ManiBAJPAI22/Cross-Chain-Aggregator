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
exports.AxelarBridge = void 0;
const axelarjs_sdk_1 = require("@axelar-network/axelarjs-sdk");
const config_1 = __importDefault(require("./config"));
class AxelarBridge {
    constructor() {
        this.axelarQuery = new axelarjs_sdk_1.AxelarQueryAPI({
            environment: config_1.default.environment
        });
    }
    prepareTransferMessages(sourceChain, destChain, asset, amount, recipient, sourceContractAddress, destinationContractAddress) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const sourceEvmChain = this.getEvmChain(sourceChain);
                const destEvmChain = this.getEvmChain(destChain);
                const gasFee = yield this.axelarQuery.estimateGasFee(sourceEvmChain, destEvmChain, asset, config_1.default.axelarSettings.gasLimit, config_1.default.axelarSettings.gasMultiplier);
                console.log(`Estimated transfer fee:`, gasFee);
                const sourceTokenAddress = this.getTokenAddress(sourceChain, asset);
                const destTokenAddress = this.getTokenAddress(destChain, asset);
                const sourceGateway = config_1.default.gatewayAddresses[sourceChain] || '';
                const destGateway = config_1.default.gatewayAddresses[destChain] || '';
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
            }
            catch (error) {
                console.error('Error preparing transfer messages:', error);
                throw error;
            }
        });
    }
    getTokenAddress(chain, asset) {
        const chainTokens = config_1.default.tokenAddresses[chain];
        if (chainTokens && typeof chainTokens === 'object' && asset in chainTokens) {
            return chainTokens[asset];
        }
        throw new Error(`Token ${asset} not found for chain ${chain}`);
    }
    executeTransfer(preparedMessage) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log("Executing cross-chain transfer:", preparedMessage);
            const gasReceiverAddress = config_1.default.gasReceiver[preparedMessage.sourceChain] || '';
            console.log("Gas receiver address:", gasReceiverAddress);
            // Placeholder implementation
            return true;
        });
    }
    getEvmChain(chainName) {
        const chain = config_1.default.supportedChains[chainName.toLowerCase()];
        if (!chain) {
            throw new Error(`Unsupported chain: ${chainName}`);
        }
        return chain;
    }
}
exports.AxelarBridge = AxelarBridge;
