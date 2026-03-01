
# Pacifica JS SDK

Official JavaScript/TypeScript SDK for [Pacifica](https://pacifica.fi).
Converted from the official [Python SDK](https://github.com/pacifica-fi/python-sdk).

## Installation

```bash
npm install pacifica-js-sdk
```

## Usage

Create a `.env` file with your private key (optional for public data):
```
PRIVATE_KEY=your_base58_private_key
```

Run the example:
```bash
npx tsx examples/usage.ts
```

## Code Example

```typescript
import { PacificaClient } from './src';

const client = new PacificaClient({
    privateKey: "YOUR_BASE58_PRIVATE_KEY",
    network: "testnet"
});

// REST API
const subaccounts = await client.listSubaccounts();

// WebSocket API
await client.connect();
await client.createMarketOrderWs({
    symbol: "BTC",
    side: "bid",
    amount: "0.1"
});
```

## Features

- Full WebSocket trading support (Market, Limit, Cancel, Cancel All)
- REST API support
- Automatic request signing matching Python SDK logic
- TypeScript support
