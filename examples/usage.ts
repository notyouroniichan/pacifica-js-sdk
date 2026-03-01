
import { PacificaClient } from "../src/index.js";
import dotenv from "dotenv";

dotenv.config();

const PRIVATE_KEY = process.env.PRIVATE_KEY;

if (!PRIVATE_KEY) {
    console.error("PRIVATE_KEY not found in environment variables. Please create a .env file.");
    process.exit(1);
}

async function main() {
    const client = new PacificaClient({
        privateKey: PRIVATE_KEY!, // Assert non-null
        network: 'testnet' // Using testnet for safety
    });

    try {
        console.log("Connecting to WebSocket...");
        await client.connect();
        console.log("Connected to WebSocket!");

        // Example: List Subaccounts via REST
        console.log("\n--- Listing Subaccounts (REST) ---");
        try {
            const subaccounts = await client.listSubaccounts();
            console.log("Subaccounts response:", JSON.stringify(subaccounts, null, 2));
        } catch (e) {
            console.error("Failed to list subaccounts:", e);
        }

    } catch (err) {
        console.error("Error:", err);
    } finally {
        // client.close();
        process.exit(0);
    }
}

main();
