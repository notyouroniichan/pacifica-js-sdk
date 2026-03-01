# Pacifica JS SDK

Official JavaScript/TypeScript SDK for [Pacifica](https://pacifica.fi).
Converted from the official [Python SDK](https://github.com/pacifica-fi/python-sdk).

## Features

- 🔐 **Secure Authentication**: Ed25519 signing for all private operations.
- 🤖 **Agent Wallets**: Native support for binding and using agent wallets for automated trading.
- 📡 **Real-time Data**: WebSocket client for Prices, Tickers, Orderbooks, and Trades.
- ⚡ **Full Trading Suite**: Market, Limit, Stop-Loss, and Take-Profit orders.
- 🛡️ **Robustness**: Automatic WebSocket reconnection and typed responses.
- 📘 **TypeScript First**: Full type definitions for all API interactions.

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

 Initialize the client:

```typescript
import { PacificaClient } from 'pacifica-js-sdk';
import dotenv from 'dotenv';

dotenv.config();

const client = new PacificaClient({
    privateKey: process.env.PRIVATE_KEY,
    network: "mainnet" // or "testnet"
});
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
