
import { Keypair } from '@solana/web3.js';

export interface SignatureHeader {
    timestamp: number;
    expiry_window: number;
    type: string;
}

export interface SignaturePayload {
    [key: string]: any;
}

export interface RequestHeader {
    account: string;
    agent_wallet?: string;
    signature: string;
    timestamp: number;
    expiry_window: number;
}

export interface SignedRequest extends RequestHeader, SignaturePayload {}

// --- API Response Types ---

export interface ApiResponse<T> {
    success: boolean;
    data: T | null;
    error?: string;
}

export interface AccountInfo {
    balance: string;
    collateral: string;
    free_collateral: string;
    margin_usage: string;
    leverage: string;
    // Add other fields as discovered/needed
}

export interface Position {
    symbol: string;
    side: 'long' | 'short';
    amount: string;
    entry_price: string;
    mark_price: string;
    unrealized_pnl: string;
    liquidation_price: string;
    leverage: string;
}

export interface Order {
    order_id: string;
    client_order_id?: string;
    symbol: string;
    side: 'bid' | 'ask';
    type: 'limit' | 'market';
    price?: string;
    amount: string;
    filled_amount: string;
    status: 'open' | 'filled' | 'canceled' | 'rejected';
    timestamp: number;
}

// --- WebSocket Types ---

export interface Ticker {
    symbol: string;
    price: string;
    change_24h: string;
    volume_24h: string;
    high_24h: string;
    low_24h: string;
}

export interface Orderbook {
    symbol: string;
    bids: [string, string][]; // [price, size]
    asks: [string, string][];
    timestamp: number;
}

export interface Trade {
    symbol: string;
    price: string;
    size: string;
    side: 'buy' | 'sell';
    timestamp: number;
    trade_id: string;
}

// --- Request Parameters ---

export interface CreateOrderParams {
    symbol: string;
    side: 'bid' | 'ask';
    amount: string;
    price?: string; // Optional for market orders
    type?: 'limit' | 'market';
    reduce_only?: boolean;
    client_order_id?: string;
    tif?: 'GTC' | 'IOC' | 'FOK';
    slippage_percent?: string; // For market orders
    take_profit?: {
        stop_price: string;
        limit_price?: string;
    };
    stop_loss?: {
        stop_price: string;
        limit_price?: string;
    };
}

export interface PacificaClientConfig {
    network?: 'mainnet' | 'testnet';
    privateKey?: string; // Base58 string
    agentWallet?: string; // Base58 private key for agent wallet
    agentWalletPublicKey?: string; // Public key of agent wallet if already bound
    wsUrl?: string;
    restUrl?: string;
    reconnect?: boolean; // Auto-reconnect WebSocket
}
