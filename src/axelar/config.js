"use strict";
// src/axelar/config.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axelarjs_sdk_1 = require("@axelar-network/axelarjs-sdk");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const axelarConfig = {
    // Set the environment (TESTNET or MAINNET)
    environment: process.env.AXELAR_ENVIRONMENT === 'MAINNET' ? axelarjs_sdk_1.Environment.MAINNET : axelarjs_sdk_1.Environment.TESTNET,
    // Axelar API key
    axelarApiKey: process.env.AXELAR_API_KEY || '',
    // Supported chains and their corresponding EvmChain values
    supportedChains: {
        ethereum: axelarjs_sdk_1.EvmChain.ETHEREUM,
        avalanche: axelarjs_sdk_1.EvmChain.AVALANCHE,
        fantom: axelarjs_sdk_1.EvmChain.FANTOM,
        polygon: axelarjs_sdk_1.EvmChain.POLYGON,
        moonbeam: axelarjs_sdk_1.EvmChain.MOONBEAM,
        arbitrum: axelarjs_sdk_1.EvmChain.ARBITRUM,
        optimism: axelarjs_sdk_1.EvmChain.OPTIMISM,
        binance: axelarjs_sdk_1.EvmChain.BINANCE,
        // Add other supported chains here
    },
    // Gas receiver addresses for each chain
    gasReceiver: {
        ethereum: process.env.AXELAR_GAS_RECEIVER_ETHEREUM || '',
        avalanche: process.env.AXELAR_GAS_RECEIVER_AVALANCHE || '',
        fantom: process.env.AXELAR_GAS_RECEIVER_FANTOM || '',
        polygon: process.env.AXELAR_GAS_RECEIVER_POLYGON || '',
        moonbeam: process.env.AXELAR_GAS_RECEIVER_MOONBEAM || '',
        arbitrum: process.env.AXELAR_GAS_RECEIVER_ARBITRUM || '',
        optimism: process.env.AXELAR_GAS_RECEIVER_OPTIMISM || '',
        binance: process.env.AXELAR_GAS_RECEIVER_BINANCE || '',
        // Add other chains as needed
    },
    // Token addresses on different chains
    tokenAddresses: {
        ethereum: {
            'USDC': process.env.AXELAR_TOKEN_USDC_ETHEREUM || '',
            'USDT': process.env.AXELAR_TOKEN_USDT_ETHEREUM || '',
            'WETH': process.env.AXELAR_TOKEN_WETH_ETHEREUM || '',
        },
        avalanche: {
            'USDC': process.env.AXELAR_TOKEN_USDC_AVALANCHE || '',
            'USDT': process.env.AXELAR_TOKEN_USDT_AVALANCHE || '',
            'WAVAX': process.env.AXELAR_TOKEN_WAVAX_AVALANCHE || '',
        },
        // Add other chains here
    },
    // Gateway contract addresses for each chain
    gatewayAddresses: {
        ethereum: process.env.AXELAR_GATEWAY_ETHEREUM || '',
        avalanche: process.env.AXELAR_GATEWAY_AVALANCHE || '',
        fantom: process.env.AXELAR_GATEWAY_FANTOM || '',
        polygon: process.env.AXELAR_GATEWAY_POLYGON || '',
        moonbeam: process.env.AXELAR_GATEWAY_MOONBEAM || '',
        arbitrum: process.env.AXELAR_GATEWAY_ARBITRUM || '',
        optimism: process.env.AXELAR_GATEWAY_OPTIMISM || '',
        binance: process.env.AXELAR_GATEWAY_BINANCE || '',
        // Add other supported chains
    },
    // RPC URLs for each chain
    rpcUrls: {
        ethereum: process.env.RPC_URL_ETHEREUM || '',
        avalanche: process.env.RPC_URL_AVALANCHE || '',
        fantom: process.env.RPC_URL_FANTOM || '',
        polygon: process.env.RPC_URL_POLYGON || '',
        moonbeam: process.env.RPC_URL_MOONBEAM || '',
        arbitrum: process.env.RPC_URL_ARBITRUM || '',
        optimism: process.env.RPC_URL_OPTIMISM || '',
        binance: process.env.RPC_URL_BINANCE || '',
        // Add other supported chains
    },
    // Axelar-specific settings
    axelarSettings: {
        gasLimit: 1000000, // Default gas limit for estimations
        gasMultiplier: '1.1', // Default gas multiplier for estimations
    },
};
exports.default = axelarConfig;
