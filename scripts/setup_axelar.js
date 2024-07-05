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
const AxelarBridge_1 = require("../src/axelar/AxelarBridge");
const config_1 = __importDefault(require("../src/axelar/config"));
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        const axelarBridge = new AxelarBridge_1.AxelarBridge(config_1.default.environment);
        // Setup Axelar for your specific chains
        // This is a placeholder and will depend on your specific requirements
        console.log("Axelar environment:", config_1.default.environment);
        // You might want to test some basic functionality here
        try {
            const testMessage = yield axelarBridge.prepareTransferMessages("ethereum", "optimism", "USDC", "100000000", // 100 USDC
            "0x1234567890123456789012345678901234567890", // example recipient address
            "0x0987654321098765432109876543210987654321", // example source address
            "0x1111111111111111111111111111111111111111" // example destination address
            );
            console.log("Test transfer message prepared:", testMessage);
        }
        catch (error) {
            console.error("Error preparing test message:", error);
        }
        console.log("Axelar setup complete");
    });
}
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
