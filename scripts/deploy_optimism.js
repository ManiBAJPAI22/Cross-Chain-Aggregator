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
const hardhat_1 = require("hardhat");
const dotenv_1 = __importDefault(require("dotenv"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config();
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const axelarGatewayAddress = process.env.AXELAR_GATEWAY_OPTIMISM;
        const axelarGasServiceAddress = process.env.AXELAR_GAS_SERVICE_OPTIMISM;
        if (!axelarGatewayAddress || !axelarGasServiceAddress) {
            throw new Error("Missing required environment variables");
        }
        // Get the ContractFactory and Signer
        const OptimismReceiver = yield hardhat_1.ethers.getContractFactory("OptimismReceiver");
        const [deployer] = yield hardhat_1.ethers.getSigners();
        console.log("Deploying OptimismReceiver...");
        const optimismReceiver = yield OptimismReceiver.deploy(axelarGatewayAddress, axelarGasServiceAddress);
        yield ((_a = optimismReceiver.deploymentTransaction()) === null || _a === void 0 ? void 0 : _a.wait());
        console.log("OptimismReceiver deployed to:", yield optimismReceiver.getAddress());
        // If you want to write the deployment info to a file
        const deploymentInfo = {
            address: yield optimismReceiver.getAddress(),
            abi: JSON.parse(optimismReceiver.interface.formatJson()),
        };
        const deploymentPath = path_1.default.join(__dirname, "../deployments");
        if (!fs_1.default.existsSync(deploymentPath)) {
            fs_1.default.mkdirSync(deploymentPath);
        }
        fs_1.default.writeFileSync(path_1.default.join(deploymentPath, "OptimismReceiver.json"), JSON.stringify(deploymentInfo, null, 2));
    });
}
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
