
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
    signature: string;
    timestamp: number;
    expiry_window: number;
}

export interface SignedRequest extends RequestHeader, SignaturePayload {}
