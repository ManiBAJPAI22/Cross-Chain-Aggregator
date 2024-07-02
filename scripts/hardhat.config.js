"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("@nomicfoundation/hardhat-toolbox");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const config = {
    solidity: "0.8.24",
    networks: {
        "op-sepolia": {
            url: "https://sepolia.optimism.io",
            accounts: [process.env.DEPLOYER_PRIVATE_KEY],
            chainId: 11155420
        },
    },
    etherscan: {
        apiKey: {
            "op-sepolia": process.env.OPTIMISM_ETHERSCAN_API_KEY
        },
    },
};
exports.default = config;
