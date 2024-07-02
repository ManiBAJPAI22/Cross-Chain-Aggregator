import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import dotenv from "dotenv";

dotenv.config();

const config: HardhatUserConfig = {
  solidity: "0.8.24",
  networks: {
    "op-sepolia": {
      url: "https://sepolia.optimism.io",
      accounts: [process.env.DEPLOYER_PRIVATE_KEY!],
      chainId: 11155420
    },
  },
  etherscan: {
    apiKey: {
      "op-sepolia": process.env.OPTIMISM_ETHERSCAN_API_KEY!
    },
  },
};

export default config;