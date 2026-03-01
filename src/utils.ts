
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import nacl from "tweetnacl";
import { SignatureHeader, SignaturePayload } from "./types.js";

/**
 * Sorts object keys recursively to match Python's behavior
 */
export function sortJsonKeys(value: any): any {
    if (value === null || value === undefined) {
        return value;
    }
    
    if (Array.isArray(value)) {
        return value.map(sortJsonKeys);
    }
    
    if (typeof value === 'object') {
        const sorted: any = {};
        Object.keys(value)
            .sort()
            .forEach(key => {
                sorted[key] = sortJsonKeys(value[key]);
            });
        return sorted;
    }
    
    return value;
}

/**
 * Prepares the message string for signing
 */
export function prepareMessage(header: SignatureHeader, payload: SignaturePayload): string {
    const data = {
        ...header,
        data: payload
    };

    const sortedData = sortJsonKeys(data);
    
    // JSON.stringify without arguments produces compact JSON (no spaces)
    // which matches Python's separators=(",", ":")
    return JSON.stringify(sortedData);
}

/**
 * Signs the message using the provided keypair
 */
export function signMessage(
    header: SignatureHeader, 
    payload: SignaturePayload, 
    keypair: Keypair
): { message: string; signature: string } {
    const message = prepareMessage(header, payload);
    const messageBytes = new TextEncoder().encode(message);
    const signatureBytes = nacl.sign.detached(messageBytes, keypair.secretKey);
    
    return {
        message,
        signature: bs58.encode(signatureBytes)
    };
}
