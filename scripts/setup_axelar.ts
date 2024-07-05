import { AxelarBridge } from "../src/axelar/AxelarBridge";
import axelarConfig from "../src/axelar/config";

async function main() {
  const axelarBridge = new AxelarBridge(axelarConfig.environment);

  // Setup Axelar for your specific chains
  // This is a placeholder and will depend on your specific requirements
  console.log("Axelar environment:", axelarConfig.environment);

  // You might want to test some basic functionality here
  try {
    const testMessage = await axelarBridge.prepareTransferMessages(
      "ethereum",
      "optimism",
      "USDC",
      "100000000", // 100 USDC
      "0x1234567890123456789012345678901234567890", // example recipient address
      "0x0987654321098765432109876543210987654321", // example source address
      "0x1111111111111111111111111111111111111111" // example destination address
    );
    console.log("Test transfer message prepared:", testMessage);
  } catch (error) {
    console.error("Error preparing test message:", error);
  }

  console.log("Axelar setup complete");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});