import { NextResponse } from "next/server";

const SUPPORTED_COINS = ["bitcoin", "ethereum", "solana"];

// Cache for OHLC data (per coin + days)
interface OHLCCache {
  data: number[][];
  timestamp: number;
}

const ohlcCache: Map<string, OHLCCache> = new Map();
const FRESH_TTL = 60000; // 60 seconds
const STALE_TTL = 900000; // 15 minutes

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const coinId = searchParams.get("coin") || "bitcoin";
  const days = searchParams.get("days") || "1";
  const forceRefresh = searchParams.get("refresh") === "true";

  if (!SUPPORTED_COINS.includes(coinId)) {
    return NextResponse.json({ error: "Unsupported coin" }, { status: 400 });
  }

  const cacheKey = `${coinId}-${days}`;

  // Check cache
  const cached = ohlcCache.get(cacheKey);
  if (cached && !forceRefresh) {
    const age = Date.now() - cached.timestamp;

    if (age < FRESH_TTL) {
      return NextResponse.json({ ohlc: cached.data, isStale: false });
    }

    if (age < STALE_TTL) {
      return NextResponse.json({ ohlc: cached.data, isStale: true });
    }
  }

  try {
    const response = await fetch(
      `https://api.coingecko.com/api/v3/coins/${coinId}/ohlc?vs_currency=usd&days=${days}`,
      { headers: { Accept: "application/json" } }
    );

    if (response.status === 429) {
      if (cached) {
        return NextResponse.json({ ohlc: cached.data, isStale: true });
      }
      return NextResponse.json({ error: "Rate limited" }, { status: 429 });
    }

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const ohlc = Array.isArray(data) ? data : [];

    // Update cache
    if (ohlc.length > 0) {
      ohlcCache.set(cacheKey, { data: ohlc, timestamp: Date.now() });
    }

    return NextResponse.json({ ohlc, isStale: false });
  } catch (error) {
    console.error("OHLC API Error:", error);

    if (cached) {
      return NextResponse.json({ ohlc: cached.data, isStale: true });
    }

    return NextResponse.json({ error: "Failed to fetch OHLC" }, { status: 500 });
  }
}
