// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IAxelarGateway {
    function validateContractCall(
        bytes32 commandId,
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes32 payloadHash
    ) external view returns (bool);

    function transferToken(
        string calldata symbol,
        address recipient,
        uint256 amount
    ) external;
}

interface IAxelarGasService {
    // Include required functions from IAxelarGasService
}

library StringAddressUtils {
    function toAddress(string memory str) internal pure returns (address) {
        bytes memory tmp = bytes(str);
        uint160 iaddr = 0;
        uint160 b1;
        uint160 b2;
        for (uint256 i = 2; i < 2 + 2 * 20; i += 2) {
            iaddr *= 256;
            b1 = uint160(uint8(tmp[i]));
            b2 = uint160(uint8(tmp[i + 1]));
            if ((b1 >= 97) && (b1 <= 102)) {
                b1 -= 87;
            } else if ((b1 >= 48) && (b1 <= 57)) {
                b1 -= 48;
            }
            if ((b2 >= 97) && (b2 <= 102)) {
                b2 -= 87;
            } else if ((b2 >= 48) && (b2 <= 57)) {
                b2 -= 48;
            }
            iaddr += (b1 * 16 + b2);
        }
        return address(iaddr);
    }

    function toUint256(string memory str) internal pure returns (uint256 result) {
        bytes memory b = bytes(str);
        uint256 i;
        result = 0;
        for (i = 0; i < b.length; i++) {
            uint8 c = uint8(b[i]);
            if (c >= 48 && c <= 57) {
                result = result * 10 + (c - 48);
            }
        }
    }
}

contract OptimismReceiver {
    using StringAddressUtils for string;

    IAxelarGateway public immutable gateway;
    IAxelarGasService public immutable gasService;

    event TokensReceived(address recipient, uint256 amount);

    constructor(address _gateway, address _gasService) {
        gateway = IAxelarGateway(_gateway);
        gasService = IAxelarGasService(_gasService);
    }

    function receiveTokens(
        bytes32 commandId,
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload
    ) external {
        bytes32 payloadHash = keccak256(payload);
        require(gateway.validateContractCall(commandId, sourceChain, sourceAddress, payloadHash), "Invalid cross-chain call");

        (string memory recipient, string memory amount) = abi.decode(payload, (string, string));
        address recipientAddress = recipient.toAddress();
        uint256 amountUint = StringAddressUtils.toUint256(amount);

        // Here, you would typically interact with your Optimism aggregator to perform the swap
        // For simplicity, we're just transferring the received tokens to the recipient
        gateway.transferToken("axlUSDC", recipientAddress, amountUint);

        emit TokensReceived(recipientAddress, amountUint);
       
    }
}
