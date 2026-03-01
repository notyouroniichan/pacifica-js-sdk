
import { sortJsonKeys, prepareMessage, signMessage } from '../src/utils';
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';

describe('Utils', () => {
    describe('sortJsonKeys', () => {
        it('should recursively sort object keys', () => {
            const input = {
                c: 3,
                a: 1,
                b: {
                    y: 2,
                    x: 1
                }
            };
            const expected = {
                a: 1,
                b: {
                    x: 1,
                    y: 2
                },
                c: 3
            };
            
            // Check key order by stringifying
            expect(JSON.stringify(sortJsonKeys(input))).toBe(JSON.stringify(expected));
        });

        it('should handle arrays', () => {
            const input = [{ c: 1, a: 2 }, { z: 3, x: 4 }];
            const expected = [{ a: 2, c: 1 }, { x: 4, z: 3 }];
            expect(JSON.stringify(sortJsonKeys(input))).toBe(JSON.stringify(expected));
        });
    });

    describe('prepareMessage', () => {
        it('should create correct JSON string without spaces', () => {
            const header = { timestamp: 123, expiry_window: 5000, type: 'test' };
            const payload = { b: 2, a: 1 };
            
            const message = prepareMessage(header, payload);
            
            // Expected order: data (with sorted keys), expiry_window, timestamp, type
            // Actually, sortJsonKeys sorts the top level too.
            // "data": {a:1, b:2}, "expiry_window": 5000, "timestamp": 123, "type": "test"
            // Top level keys: data, expiry_window, timestamp, type.
            
            expect(message).toContain('"data":{"a":1,"b":2}');
            expect(message).toContain('"expiry_window":5000');
            // Check if it's compact JSON
            expect(message).not.toContain(' ');
        });
    });

    describe('signMessage', () => {
        it('should produce valid signature', () => {
            const keypair = Keypair.generate();
            const header = { timestamp: 123, expiry_window: 5000, type: 'test' };
            const payload = { test: 'value' };

            const { message, signature } = signMessage(header, payload, keypair);

            expect(message).toBeDefined();
            expect(signature).toBeDefined();

            // Verify signature
            const messageBytes = new TextEncoder().encode(message);
            const signatureBytes = bs58.decode(signature);
            const verified = require('tweetnacl').sign.detached.verify(
                messageBytes,
                signatureBytes,
                keypair.publicKey.toBytes()
            );

            expect(verified).toBe(true);
        });
    });
});
