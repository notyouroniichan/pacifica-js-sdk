# Pacifica JS SDK (Community)

[![npm version](https://img.shields.io/npm/v/pacifica-js-sdk.svg)](https://www.npmjs.com/package/pacifica-js-sdk)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)
[![Production Grade](https://img.shields.io/badge/Status-Production%20Grade-green.svg)](https://pacifica.fi)

Community-maintained production-ready JavaScript/TypeScript SDK for [Pacifica](https://pacifica.fi).
Engineered for high-frequency trading bots, institutional integrations, and DeFi agents.

> **Note:** This is an unofficial, community-maintained SDK. It is not affiliated with or endorsed by the Pacifica team.

## Features

- 🔐 **Secure Authentication**: Ed25519 signing with runtime validation for keys.
- 🤖 **Agent Wallets**: Native support for binding and using agent wallets for automated trading.
- 📡 **Real-time Data**: Robust WebSocket client with auto-reconnection and exponential backoff.
- ⚡ **Full Trading Suite**: Market, Limit, Stop-Loss, and Take-Profit orders.
- 🛡️ **Error Handling**: Typed error classes (`PacificaError`, `NetworkError`) for predictable failure management.
- 📘 **TypeScript First**: Strict type definitions for all API interactions.
- ✅ **Tested**: Unit tested utilities and critical paths.

## Installation

```bash
npm install pacifica-js-sdk
```

## Quick Start

### Basic Configuration

Create a `.env` file (optional):
```
PRIVATE_KEY=your_base58_private_key
```

 Initialize the client with error handling:

```typescript
import { PacificaClient, PacificaError } from 'pacifica-js-sdk';
import dotenv from 'dotenv';

dotenv.config();

try {
    const client = new PacificaClient({
        privateKey: process.env.PRIVATE_KEY,
        network: "mainnet" // or "testnet"
    });

    await client.connect();
    console.log("Connected securely.");
} catch (error) {
    if (error instanceof PacificaError) {
        console.error("Pacifica SDK Error:", error.message);
    } else {
        console.error("Unknown Error:", error);
    }
}
```

### Trading with Stop-Loss & Take-Profit

```typescript
await client.connect();

const response = await client.createOrder({
    symbol: "BTC",
    side: "bid",
    type: "limit",
    price: "65000",
    amount: "0.1",
    take_profit: {
        stop_price: "70000",
        limit_price: "70100"
    },
    stop_loss: {
        stop_price: "60000"
    }
});

console.log("Order placed:", response);
```

### Using Agent Wallets

Agent wallets allow you to sign transactions with a secondary keypair, keeping your main private key safe.

1. **Bind an Agent Wallet** (One-time setup using main key):
```typescript
import { Keypair } from "@solana/web3.js";

// Generate a new agent keypair
const agentKeypair = Keypair.generate();
const agentPublicKey = agentKeypair.publicKey.toBase58();

// Bind it to your account
await client.bindAgentWallet(agentPublicKey);
console.log("Agent bound:", agentPublicKey);
console.log("Agent Private Key:", bs58.encode(agentKeypair.secretKey)); // Save this!
```

2. **Trade with Agent Wallet**:
```typescript
const agentClient = new PacificaClient({
    privateKey: process.env.MAIN_PRIVATE_KEY, // Still needed for account identification
    agentWallet: "AGENT_PRIVATE_KEY_BASE58", // Signs requests
    network: "mainnet"
});

await agentClient.connect();
await agentClient.createOrder({ ... });
```

### WebSocket Subscriptions

```typescript
await client.connect();

// Typed event listeners
client.on('ticker', (ticker) => {
    console.log(`Update for ${ticker.symbol}: $${ticker.price}`);
});

client.on('orderbook', (book) => {
    console.log(`Orderbook ${book.symbol}: ${book.bids[0]} / ${book.asks[0]}`);
});

// Subscribe
client.subscribeToTicker("BTC");
client.subscribeToOrderbook("ETH");
```

### REST API Methods

```typescript
// Get Account Info (Balances, Margin)
const account = await client.getAccountInfo();

// Get Open Positions
const positions = await client.getPositions();

// Get Open Orders
const orders = await client.getOrders();

// Get All Markets
const markets = await client.getMarkets();
```

## License

ISC
