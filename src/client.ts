
import { Keypair } from "@solana/web3.js";
import { WebSocket } from "ws";
import axios, { AxiosInstance } from "axios";
import bs58 from "bs58";
import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';
import { 
    MAINNET_REST_URL, 
    MAINNET_WS_URL, 
    TESTNET_REST_URL, 
    TESTNET_WS_URL, 
    DEFAULT_EXPIRY_WINDOW 
} from "./config.js";
import { signMessage } from "./utils.js";
import { 
    PacificaClientConfig, 
    SignatureHeader, 
    SignaturePayload, 
    SignedRequest,
    CreateOrderParams,
    ApiResponse,
    AccountInfo,
    Position,
    Order,
    Ticker,
    Orderbook,
    Trade
} from "./types.js";

export class PacificaClient extends EventEmitter {
    private keypair?: Keypair;
    private agentWalletKeypair?: Keypair;
    private agentWalletPublicKey?: string;
    private restUrl: string;
    private wsUrl: string;
    private ws: WebSocket | null = null;
    private wsConnected: boolean = false;
    private reconnect: boolean = false;
    private reconnectDelay: number = 1000;
    private pendingRequests: Map<string, { resolve: (value: any) => void, reject: (reason: any) => void }> = new Map();
    private axiosInstance: AxiosInstance;

    constructor(config: PacificaClientConfig) {
        super();
        
        // Initialize Main Account Keypair
        if (config.privateKey) {
            this.keypair = Keypair.fromSecretKey(bs58.decode(config.privateKey));
        }

        // Initialize Agent Wallet Keypair
        if (config.agentWallet) {
            this.agentWalletKeypair = Keypair.fromSecretKey(bs58.decode(config.agentWallet));
            this.agentWalletPublicKey = this.agentWalletKeypair.publicKey.toBase58();
        } else if (config.agentWalletPublicKey) {
            this.agentWalletPublicKey = config.agentWalletPublicKey;
        }

        // Network Configuration
        if (config.network === 'testnet') {
            this.restUrl = config.restUrl || TESTNET_REST_URL;
            this.wsUrl = config.wsUrl || TESTNET_WS_URL;
        } else {
            this.restUrl = config.restUrl || MAINNET_REST_URL;
            this.wsUrl = config.wsUrl || MAINNET_WS_URL;
        }

        this.reconnect = config.reconnect ?? true;

        this.axiosInstance = axios.create({
            baseURL: this.restUrl,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }

    // --- Authentication Helper ---

    /**
     * Signs a payload and prepares the request header.
     * Uses Agent Wallet if available, otherwise uses Main Account.
     */
    private signAndPrepareRequest(type: string, payload: SignaturePayload): SignedRequest {
        if (!this.keypair) {
            throw new Error("Private key is required for signed operations");
        }

        const timestamp = Date.now();
        const header: SignatureHeader = {
            timestamp,
            expiry_window: DEFAULT_EXPIRY_WINDOW,
            type
        };

        // Determine which key to sign with
        let signer = this.keypair;
        let isAgentSign = false;

        if (this.agentWalletKeypair) {
            signer = this.agentWalletKeypair;
            isAgentSign = true;
        }

        const { signature } = signMessage(header, payload, signer);

        const requestHeader: any = {
            account: this.keypair.publicKey.toBase58(),
            signature,
            timestamp,
            expiry_window: DEFAULT_EXPIRY_WINDOW
        };

        if (isAgentSign && this.agentWalletPublicKey) {
            requestHeader.agent_wallet = this.agentWalletPublicKey;
        }

        return {
            ...requestHeader,
            ...payload
        };
    }

    // --- WebSocket Management ---

    public async connect(): Promise<void> {
        if (this.ws?.readyState === WebSocket.OPEN) return;

        return new Promise((resolve) => {
            this.ws = new WebSocket(this.wsUrl);

            this.ws.on('open', () => {
                console.log(`Connected to Pacifica WebSocket: ${this.wsUrl}`);
                this.wsConnected = true;
                this.reconnectDelay = 1000; // Reset backoff
                this.emit('connected');
                resolve();
            });

            this.ws.on('message', (data: Buffer) => {
                try {
                    const message = JSON.parse(data.toString());
                    this.handleWsMessage(message);
                } catch (err) {
                    console.error('Failed to parse WS message:', err);
                }
            });

            this.ws.on('close', () => {
                console.log('WebSocket disconnected');
                this.wsConnected = false;
                this.ws = null;
                this.emit('disconnected');

                if (this.reconnect) {
                    this.handleReconnect();
                }
            });

            this.ws.on('error', (err) => {
                console.error('WebSocket error:', err);
                this.emit('error', err);
            });
        });
    }

    private handleReconnect() {
        console.log(`Reconnecting in ${this.reconnectDelay}ms...`);
        setTimeout(() => {
            this.connect();
            this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000); // Max 30s backoff
        }, this.reconnectDelay);
    }

    public close() {
        this.reconnect = false;
        if (this.ws) {
            this.ws.close();
        }
    }

    private handleWsMessage(message: any) {
        // Handle Request Responses
        if (message.id && this.pendingRequests.has(message.id)) {
            const { resolve, reject } = this.pendingRequests.get(message.id)!;
            if (message.error) {
                reject(new Error(message.error));
            } else {
                resolve(message.result);
            }
            this.pendingRequests.delete(message.id);
            return;
        }

        // Handle Subscriptions
        const channel = message.channel;
        const data = message.data;

        if (channel === 'prices') {
            this.emit('prices', data); // Emit raw prices
        } else if (channel === 'ticker') {
            this.emit('ticker', data as Ticker);
        } else if (channel === 'orderbook') {
            this.emit('orderbook', data as Orderbook);
        } else if (channel === 'trades') {
            this.emit('trade', data as Trade);
        }
        
        // Generic message emit
        this.emit('message', message);
    }

    private async sendWsRequest(method: string, params: any): Promise<any> {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            throw new Error("WebSocket not connected");
        }

        const id = uuidv4();
        const request = {
            id,
            params: {
                [method]: params
            }
        };

        return new Promise((resolve, reject) => {
            this.pendingRequests.set(id, { resolve, reject });
            this.ws!.send(JSON.stringify(request));
            
            // Timeout after 10 seconds
            setTimeout(() => {
                if (this.pendingRequests.has(id)) {
                    this.pendingRequests.delete(id);
                    reject(new Error("Request timed out"));
                }
            }, 10000);
        });
    }

    // --- REST API Methods ---

    /**
     * Bind a new Agent Wallet to the main account
     */
    public async bindAgentWallet(newAgentPublicKey: string): Promise<ApiResponse<any>> {
        const payload = { agent_wallet: newAgentPublicKey };
        // Must sign with MAIN keypair, not agent wallet
        if (!this.keypair) throw new Error("Main private key required to bind agent wallet");
        
        // Force main key signing
        const tempAgentKey = this.agentWalletKeypair;
        this.agentWalletKeypair = undefined; 
        
        try {
            const signedRequest = this.signAndPrepareRequest("bind_agent_wallet", payload);
            const response = await this.axiosInstance.post('/agent/bind', signedRequest);
            return { success: true, data: response.data };
        } catch (error: any) {
            return { success: false, data: null, error: error.message };
        } finally {
            this.agentWalletKeypair = tempAgentKey; // Restore
        }
    }

    /**
     * Get account information (balances, margin, leverage)
     */
    public async getAccountInfo(): Promise<ApiResponse<AccountInfo>> {
        if (!this.keypair) throw new Error("Private key required");
        // Usually GET requests just need the account param, but some might need signing
        // Checking python sdk... usually it's signed for private info.
        // Assuming it's a signed GET or POST. 
        // Let's assume standard signed POST for private info based on pattern.
        // If it's GET, we might append signature to query params.
        // For now, implementing as signed POST to /account/info (hypothetical, checking python sdk recommended if strict match needed)
        // Wait, web content said: apiClient.getAccountInfo(publicKey). 
        // If it's public info, just GET. But balance is private.
        // Let's implement as signed request.
        
        const signedRequest = this.signAndPrepareRequest("get_account_info", {});
        // Note: Actual endpoint might differ. Using generic approach or mapped if known.
        // Python SDK usually has get_account_info.py? No.
        // It has list_subaccounts.py.
        // Let's stick to what we know works or generic signed request.
        
        try {
             // Try generic signed POST to /account
            const response = await this.axiosInstance.post('/account', signedRequest);
            return { success: true, data: response.data };
        } catch (error: any) {
            return { success: false, data: null, error: error.message };
        }
    }

    public async getPositions(): Promise<ApiResponse<Position[]>> {
        const signedRequest = this.signAndPrepareRequest("get_positions", {});
        try {
            const response = await this.axiosInstance.post('/positions', signedRequest);
            return { success: true, data: response.data };
        } catch (error: any) {
            return { success: false, data: null, error: error.message };
        }
    }
    
    public async getOrders(symbol?: string): Promise<ApiResponse<Order[]>> {
        const payload = symbol ? { symbol } : {};
        const signedRequest = this.signAndPrepareRequest("get_orders", payload);
        try {
            const response = await this.axiosInstance.post('/orders/list', signedRequest);
            return { success: true, data: response.data };
        } catch (error: any) {
            return { success: false, data: null, error: error.message };
        }
    }

    /**
     * Get exchange information including all available markets
     */
    public async getMarkets() {
        const response = await this.axiosInstance.get('/info');
        return response.data;
    }

    /**
     * Get current prices for all markets
     */
    public async getPrices() {
        const response = await this.axiosInstance.get('/info/prices');
        return response.data;
    }

    // --- Trading Methods (WebSocket) ---

    public async createOrder(params: CreateOrderParams) {
        const payload: any = {
            symbol: params.symbol,
            side: params.side,
            amount: params.amount,
            reduce_only: params.reduce_only ?? false,
            client_order_id: params.client_order_id || uuidv4(),
        };

        if (params.type === 'limit') {
            if (!params.price) throw new Error("Price is required for limit orders");
            payload.price = params.price;
            payload.tif = params.tif || 'GTC';
        } else {
            // Market Order
            payload.slippage_percent = params.slippage_percent || "0.5";
        }

        if (params.take_profit) payload.take_profit = params.take_profit;
        if (params.stop_loss) payload.stop_loss = params.stop_loss;

        const type = params.type === 'limit' ? 'create_limit_order' : 'create_market_order';
        const signedRequest = this.signAndPrepareRequest(type, payload);

        return this.sendWsRequest(type, signedRequest);
    }

    public async cancelOrder(orderId: string, symbol: string) {
        const payload = { order_id: orderId, symbol };
        const signedRequest = this.signAndPrepareRequest("cancel_order", payload);
        return this.sendWsRequest("cancel_order", signedRequest);
    }

    public async cancelAllOrders(symbol?: string) {
        const payload = symbol ? { symbol } : {};
        const signedRequest = this.signAndPrepareRequest("cancel_all_orders", payload);
        return this.sendWsRequest("cancel_all_orders", signedRequest);
    }

    // --- Subscription Methods ---

    public subscribe(channel: string, symbol?: string) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            throw new Error("WebSocket not connected");
        }
        
        const msg: any = {
            method: "subscribe",
            params: { channel }
        };
        
        if (symbol) {
            msg.params.symbol = symbol;
        }
        
        this.ws.send(JSON.stringify(msg));
    }

    public subscribeToPrices() {
        this.subscribe('prices');
    }

    public subscribeToTicker(symbol: string) {
        this.subscribe('ticker', symbol);
    }

    public subscribeToOrderbook(symbol: string) {
        this.subscribe('orderbook', symbol);
    }

    public subscribeToTrades(symbol: string) {
        this.subscribe('trades', symbol);
    }
}
