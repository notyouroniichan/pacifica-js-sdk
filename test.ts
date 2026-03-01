
import { PacificaClient } from './src';

async function main() {
    // Initialize without private key for public data
    const client = new PacificaClient({
        network: "mainnet" 
    });

    console.log("Connecting to WebSocket...");
    await client.connect();
    console.log("Connected!");

    // Listen for messages
    client.on('message', (data) => {
        console.log("Received data:", JSON.stringify(data, null, 2));
        
        // Check for prices channel
        if (data.channel === 'prices' && Array.isArray(data.data)) {
            console.log("Successfully fetched prices!");
            console.log(`Received ${data.data.length} price updates.`);
            console.log("Sample data:", data.data[0]);
            process.exit(0);
        }
    });

    // Subscribe to prices
    console.log("Subscribing to prices...");
    await client.subscribe("prices");

    // Keep process alive
    setTimeout(() => {
        console.log("Timeout waiting for data");
        process.exit(1);
    }, 10000);
}

main().catch(console.error);
