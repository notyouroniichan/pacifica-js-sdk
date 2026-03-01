
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
import { SignatureHeader, SignaturePayload } from "./types.js";

export interface PacificaClientConfig {
    privateKey?: string;
    network?: 'mainnet' | 'testnet';
}

export class PacificaClient extends EventEmitter {
    private keypair?: Keypair;
    private restUrl: string;
    private wsUrl: string;
    private ws: WebSocket | null = null;
    private wsConnected: Promise<void> | null = null;
    private pendingRequests: Map<string, { resolve: (value: any) => void, reject: (reason: any) => void }> = new Map();
    private axiosInstance: AxiosInstance;

    constructor(config: PacificaClientConfig) {
        super();
        if (config.privateKey) {
            this.keypair = Keypair.fromSecretKey(bs58.decode(config.privateKey));
        }
        
        if (config.network === 'testnet') {
            this.restUrl = TESTNET_REST_URL;
            this.wsUrl = TESTNET_WS_URL;
        } else {
            this.restUrl = MAINNET_REST_URL;
            this.wsUrl = MAINNET_WS_URL;
        }

        this.axiosInstance = axios.create({
            baseURL: this.restUrl,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }

    // WebSocket Management
    public async connect(): Promise<void> {
        if (this.ws?.readyState === WebSocket.OPEN) return;
        
        this.ws = new WebSocket(this.wsUrl);
        
        this.wsConnected = new Promise((resolve, reject) => {
            const onOpen = () => {
                this.ws?.removeListener('error', onError);
                resolve();
                this.emit('connected');
            };
            
            const onError = (err: Error) => {
                this.ws?.removeListener('open', onOpen);
                reject(err);
            };

            this.ws?.once('open', onOpen);
            this.ws?.once('error', onError);
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
            this.ws = null;
            this.wsConnected = null;
            this.emit('disconnected');
        });

        await this.wsConnected;
    }

    public close() {
        if (this.ws) {
            this.ws.close();
        }
    }

    private handleWsMessage(message: any) {
        if (message.id && this.pendingRequests.has(message.id)) {
            const { resolve, reject } = this.pendingRequests.get(message.id)!;
            if (message.error) {
                reject(new Error(message.error.message || JSON.stringify(message.error)));
            } else {
                resolve(message.result || message);
            }
            this.pendingRequests.delete(message.id);
        } else {
            // Handle subscriptions or unsolicited messages
            this.emit('message', message);
        }
    }

    private async sendWsRequest(method: string, payload: any): Promise<any> {
        await this.connect();
        
        const id = uuidv4();
        const message = {
            id,
            params: {
                [method]: payload
            }
        };

        return new Promise((resolve, reject) => {
            this.pendingRequests.set(id, { resolve, reject });
            this.ws!.send(JSON.stringify(message));
            
            // Timeout after 30 seconds
            setTimeout(() => {
                if (this.pendingRequests.has(id)) {
                    this.pendingRequests.delete(id);
                    reject(new Error('Request timed out'));
                }
            }, 30000);
        });
    }

    private signAndPreparePayload(type: string, payload: SignaturePayload) {
        if (!this.keypair) {
            throw new Error("Private key is required for signing requests");
        }

        const timestamp = Date.now(); // Milliseconds
        const expiry_window = DEFAULT_EXPIRY_WINDOW;

        const header: SignatureHeader = {
            timestamp,
            expiry_window,
            type
        };

        const { signature } = signMessage(header, payload, this.keypair);

        return {
            account: this.keypair.publicKey.toBase58(),
            signature,
            timestamp,
            expiry_window,
            ...payload
        };
    }

    /**
     * Subscribe to a data source
     */
    public async subscribe(source: string, params: any = {}) {
        await this.connect();
        
        const message = {
            method: "subscribe",
            params: {
                source,
                ...params
            }
        };

        this.ws!.send(JSON.stringify(message));
    }

    // WebSocket Trading Operations
    
    /**
     * Create a market order via WebSocket
     */
    public async createMarketOrderWs(params: {
        symbol: string;
        side: 'bid' | 'ask';
        amount: string;
        reduce_only?: boolean;
        slippage_percent?: string;
        client_order_id?: string;
    }) {
        const payload = {
            symbol: params.symbol,
            side: params.side,
            amount: params.amount,
            reduce_only: params.reduce_only ?? false,
            slippage_percent: params.slippage_percent ?? "0.5",
            client_order_id: params.client_order_id ?? uuidv4()
        };

        const signedPayload = this.signAndPreparePayload("create_market_order", payload);
        return this.sendWsRequest("create_market_order", signedPayload);
    }

    /**
     * Create a limit order via WebSocket
     */
    public async createLimitOrderWs(params: {
        symbol: string;
        side: 'bid' | 'ask';
        amount: string;
        price: string;
        reduce_only?: boolean;
        client_order_id?: string;
        tif?: string; // Time in force, e.g. "GTC"
    }) {
        const payload = {
            symbol: params.symbol,
            side: params.side,
            amount: params.amount,
            price: params.price,
            reduce_only: params.reduce_only ?? false,
            client_order_id: params.client_order_id ?? uuidv4(),
            tif: params.tif || "GTC"
        };

        // Note: The method name in WS params is 'create_order', but type is 'create_order'
        const signedPayload = this.signAndPreparePayload("create_order", payload);
        return this.sendWsRequest("create_order", signedPayload);
    }

    /**
     * Cancel an order via WebSocket
     */
    public async cancelOrderWs(params: {
        symbol: string;
        order_id?: string;
        client_order_id?: string;
    }) {
        const payload: any = {
            symbol: params.symbol
        };
        
        if (params.order_id) payload.order_id = params.order_id;
        if (params.client_order_id) payload.client_order_id = params.client_order_id;

        const signedPayload = this.signAndPreparePayload("cancel_order", payload);
        return this.sendWsRequest("cancel_order", signedPayload);
    }

    /**
     * Cancel all orders via WebSocket
     */
    public async cancelAllOrdersWs(params: {
        symbol?: string;
        all_symbols?: boolean;
        exclude_reduce_only?: boolean;
    }) {
        const payload = {
            all_symbols: params.all_symbols ?? true,
            exclude_reduce_only: params.exclude_reduce_only ?? false
        };
        // Note: symbol is not used if all_symbols is true? Python code sends just these two.
        
        const signedPayload = this.signAndPreparePayload("cancel_all_orders", payload);
        return this.sendWsRequest("cancel_all_orders", signedPayload);
    }

    // REST API Methods

    /**
     * Helper to send signed REST requests
     */
    private async sendRestRequest(endpoint: string, type: string, payload: any) {
        const signedPayload = this.signAndPreparePayload(type, payload);
        const response = await this.axiosInstance.post(endpoint, signedPayload);
        return response.data;
    }

    /**
     * Create a market order via REST
     */
    public async createMarketOrderRest(params: {
        symbol: string;
        side: 'bid' | 'ask';
        amount: string;
        reduce_only?: boolean;
        slippage_percent?: string;
        client_order_id?: string;
    }) {
        const payload = {
            symbol: params.symbol,
            side: params.side,
            amount: params.amount,
            reduce_only: params.reduce_only ?? false,
            slippage_percent: params.slippage_percent ?? "0.5",
            client_order_id: params.client_order_id ?? uuidv4()
        };

        return this.sendRestRequest('/orders/create_market', "create_market_order", payload);
    }

    /**
     * Create a limit order via REST
     */
    public async createLimitOrderRest(params: {
        symbol: string;
        side: 'bid' | 'ask';
        amount: string;
        price: string;
        reduce_only?: boolean;
        client_order_id?: string;
        tif?: string;
    }) {
        const payload = {
            symbol: params.symbol,
            side: params.side,
            amount: params.amount,
            price: params.price,
            reduce_only: params.reduce_only ?? false,
            client_order_id: params.client_order_id ?? uuidv4(),
            tif: params.tif || "GTC"
        };

        return this.sendRestRequest('/orders/create', "create_order", payload);
    }

    /**
     * Cancel an order via REST
     */
    public async cancelOrderRest(params: {
        symbol: string;
        order_id?: string;
        client_order_id?: string;
    }) {
        const payload: any = {
            symbol: params.symbol
        };
        
        if (params.order_id) payload.order_id = params.order_id;
        if (params.client_order_id) payload.client_order_id = params.client_order_id;

        return this.sendRestRequest('/orders/cancel', "cancel_order", payload);
    }

    /**
     * Cancel all orders via REST
     */
    public async cancelAllOrdersRest(params: {
        all_symbols?: boolean;
        exclude_reduce_only?: boolean;
    }) {
        const payload = {
            all_symbols: params.all_symbols ?? true,
            exclude_reduce_only: params.exclude_reduce_only ?? false
        };

        return this.sendRestRequest('/orders/cancel_all', "cancel_all_orders", payload);
    }

    /**
     * List subaccounts via REST
     */
    public async listSubaccounts() {
        return this.sendRestRequest('/account/subaccount/list', "list_subaccounts", {});
    }

    // Public REST Methods

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
}
