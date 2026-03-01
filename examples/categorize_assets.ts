
import { PacificaClient } from "../src/index.js";

// Define categories
const COMMODITIES = new Set([
    'XAU', 'XAG', 'WTI', 'BRENT', 'NATGAS', 'CL', 'GC', 'SI', 'HG', 'COPPER', 'GOLD', 'SILVER', 'OIL'
]);

const FOREX_PAIRS = new Set([
    'USDJPY', 'EURUSD', 'GBPUSD', 'AUDUSD', 'USDCAD', 'USDCHF', 'NZDUSD',
    'EURJPY', 'GBPJPY', 'AUDJPY', 'EURGBP'
]);

const STOCKS_ETFS = new Set([
    'GOOGL', 'NVDA', 'PLTR', 'TSLA', 'URNM', 'LIT', 'BP', '2Z', // 2Z is likely 2-Year Treasury Note Futures
    'SPY', 'QQQ', 'IWM', 'AAPL', 'MSFT', 'AMZN', 'META', 'NFLX', 'COIN', 'MSTR'
]);

function categorizeAsset(symbol: string): string {
    if (COMMODITIES.has(symbol)) {
        return 'Commodities';
    }
    
    if (STOCKS_ETFS.has(symbol)) {
        return 'TradFi (Stocks/ETFs)';
    }

    // Check if it's a forex pair (standard currencies)
    const forexCurrencies = ['USD', 'EUR', 'JPY', 'GBP', 'AUD', 'CAD', 'CHF', 'NZD'];
    if (symbol.length === 6) {
        const base = symbol.substring(0, 3);
        const quote = symbol.substring(3, 6);
        if (forexCurrencies.includes(base) && forexCurrencies.includes(quote)) {
            return 'TradFi (Forex)';
        }
    }
    
    if (FOREX_PAIRS.has(symbol)) {
        return 'TradFi (Forex)';
    }

    return 'Crypto';
}

async function main() {
    // Initialize without private key for public data
    const client = new PacificaClient({
        network: "mainnet" 
    });

    console.log("Fetching all available markets from Pacifica Mainnet...");

    try {
        const response = await client.getMarkets();
        
        if (!response.success) {
            console.error("Failed to fetch markets:", response.error);
            process.exit(1);
        }

        const markets = response.data;
        console.log(`\nSuccessfully fetched ${markets.length} markets.`);

        const categorized: Record<string, string[]> = {
            'Crypto': [],
            'Commodities': [],
            'TradFi (Forex)': [],
            'TradFi (Stocks/ETFs)': []
        };

        markets.forEach((market: any) => {
            const category = categorizeAsset(market.symbol);
            if (!categorized[category]) {
                categorized[category] = [];
            }
            categorized[category].push(market.symbol);
        });

        console.log("\n=== Asset Categorization ===\n");
        
        // Sort categories for consistent output
        const categories = ['Crypto', 'Commodities', 'TradFi (Forex)', 'TradFi (Stocks/ETFs)'];
        
        for (const category of categories) {
            const symbols = categorized[category];
            if (symbols && symbols.length > 0) {
                console.log(`## ${category} (${symbols.length})`);
                console.log(symbols.sort().join(', '));
                console.log("");
            }
        }

    } catch (error) {
        console.error("Error:", error);
    } finally {
        process.exit(0);
    }
}

main().catch(console.error);
