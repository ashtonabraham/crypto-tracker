import { NextResponse } from "next/server";

// All supported coins - fetched in ONE API call
const COIN_IDS = ["bitcoin", "ethereum", "solana"];

// Cache for batch price data
interface PriceCache {
  data: Record<string, CoinPrice>;
  timestamp: number;
}

interface CoinPrice {
  price: number;
  change24h: number;
  change7d: number;
}

let priceCache: PriceCache | null = null;
const FRESH_TTL = 60000; // 60 seconds
const STALE_TTL = 900000; // 15 minutes

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const forceRefresh = searchParams.get("refresh") === "true";

  // Check cache
  if (priceCache && !forceRefresh) {
    const age = Date.now() - priceCache.timestamp;
    
    if (age < FRESH_TTL) {
      // Fresh - return immediately
      return NextResponse.json({ prices: priceCache.data, isStale: false });
    }
    
    if (age < STALE_TTL) {
      // Stale but usable - return with flag
      return NextResponse.json({ prices: priceCache.data, isStale: true });
    }
  }

  try {
    // Fetch ALL coins in ONE API call
    const response = await fetch(
      `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${COIN_IDS.join(",")}&price_change_percentage=24h,7d`,
      { headers: { Accept: "application/json" } }
    );

    if (response.status === 429) {
      // Rate limited - return stale cache if available
      if (priceCache) {
        return NextResponse.json({ prices: priceCache.data, isStale: true });
      }
      return NextResponse.json({ error: "Rate limited" }, { status: 429 });
    }

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();

    // Transform to our format
    const prices: Record<string, CoinPrice> = {};
    for (const coin of data) {
      prices[coin.id] = {
        price: coin.current_price ?? 0,
        change24h: coin.price_change_percentage_24h ?? 0,
        change7d: coin.price_change_percentage_7d_in_currency ?? 0,
      };
    }

    // Update cache
    priceCache = { data: prices, timestamp: Date.now() };

    return NextResponse.json({ prices, isStale: false });
  } catch (error) {
    console.error("Prices API Error:", error);

    // Return stale cache on error
    if (priceCache) {
      return NextResponse.json({ prices: priceCache.data, isStale: true });
    }

    return NextResponse.json({ error: "Failed to fetch prices" }, { status: 500 });
  }
}
