import { expect } from "chai";
import { ethers } from "hardhat";
import { parseEther } from "ethers/lib/utils";
import { OptimismAggregator } from "../src/optimism/optimism";
import { OptimismWallet } from "../src/optimism/wallet";

describe("Optimism Functionality", function () {
  let optimismAggregator: OptimismAggregator;
  let wallet: OptimismWallet;

  before(async function () {
    // Setup: Create OptimismAggregator instance and mock wallet
    const [signer] = await ethers.getSigners();
    
    // Mock private key for testing; in real scenarios, you would use a secure method to handle private keys
    const mockPrivateKey = "0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    
    wallet = new OptimismWallet();
    await wallet.initialize(mockPrivateKey, "http://localhost:8545"); // Use a local Hardhat network for testing
    optimismAggregator = new OptimismAggregator(
      "http://localhost:8545",
      "SUBGRAPH_URL",
      wallet
    );
  });

  it("should fetch pool data", async function () {
    const pools = await optimismAggregator.fetchPoolData();
    expect(pools).to.not.be.null;
    expect(Object.keys(pools!).length).to.be.greaterThan(0);
  });

  it("should execute order", async function () {
    // Mock pool data and other necessary inputs
    const pools = {
      /* mock pool data */
    };
    const result = await optimismAggregator.executeOrder(
      await wallet.getProvider(),
      pools,
      "ETH",
      "USDC",
      parseEther("1"), // Use parseEther to get a BigNumber
      await wallet.getAddress()
    );
    expect(result).to.not.be.undefined;
    // Add more specific assertions based on the expected behavior
  });

  // Add more tests for other Optimism-specific functionality
});
