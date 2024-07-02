import { ethers } from "hardhat";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config();

async function main() {
  const axelarGatewayAddress = process.env.AXELAR_GATEWAY_OPTIMISM;
  const axelarGasServiceAddress = process.env.AXELAR_GAS_SERVICE_OPTIMISM;

  if (!axelarGatewayAddress || !axelarGasServiceAddress) {
    throw new Error("Missing required environment variables");
  }

  // Get the ContractFactory and Signer
  const OptimismReceiver = await ethers.getContractFactory("OptimismReceiver");
  const [deployer] = await ethers.getSigners();

  console.log("Deploying OptimismReceiver...");
  const optimismReceiver = await OptimismReceiver.deploy(
    axelarGatewayAddress,
    axelarGasServiceAddress
  );

  await optimismReceiver.deploymentTransaction()?.wait();

  console.log(
    "OptimismReceiver deployed to:",
    await optimismReceiver.getAddress()
  );

  // If you want to write the deployment info to a file
  const deploymentInfo = {
    address: await optimismReceiver.getAddress(),
    abi: JSON.parse(optimismReceiver.interface.formatJson()),
  };

  const deploymentPath = path.join(__dirname, "../deployments");
  if (!fs.existsSync(deploymentPath)) {
    fs.mkdirSync(deploymentPath);
  }
  fs.writeFileSync(
    path.join(deploymentPath, "OptimismReceiver.json"),
    JSON.stringify(deploymentInfo, null, 2)
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
