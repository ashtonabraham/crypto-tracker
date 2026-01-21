// Client-side localStorage cache with fresh/stale TTLs

const PRICE_CACHE_KEY = "crypto-tracker-prices";
const OHLC_CACHE_PREFIX = "crypto-tracker-ohlc-";
const FRESH_TTL = 60000; // 60 seconds
const STALE_TTL = 900000; // 15 minutes

// Price data for all coins (batch cached)
export interface CoinPrice {
  price: number;
  change24h: number;
  change7d: number;
}

export interface PricesCache {
  data: Record<string, CoinPrice>;
  timestamp: number;
}

// OHLC data (per coin + timerange)
export interface OHLCCache {
  data: number[][];
  timestamp: number;
}

export interface CacheResult<T> {
  data: T | null;
  isFresh: boolean;
  isStale: boolean;
  timestamp: number | null;
}

// ===== PRICES CACHE (all coins at once) =====

export function getPricesFromCache(): CacheResult<Record<string, CoinPrice>> {
  if (typeof window === "undefined") {
    return { data: null, isFresh: false, isStale: false, timestamp: null };
  }

  try {
    const stored = localStorage.getItem(PRICE_CACHE_KEY);
    if (!stored) {
      return { data: null, isFresh: false, isStale: false, timestamp: null };
    }

    const cache: PricesCache = JSON.parse(stored);
    const age = Date.now() - cache.timestamp;

    if (age < FRESH_TTL) {
      return { data: cache.data, isFresh: true, isStale: false, timestamp: cache.timestamp };
    } else if (age < STALE_TTL) {
      return { data: cache.data, isFresh: false, isStale: true, timestamp: cache.timestamp };
    }

    return { data: null, isFresh: false, isStale: false, timestamp: null };
  } catch {
    return { data: null, isFresh: false, isStale: false, timestamp: null };
  }
}

export function savePricesToCache(prices: Record<string, CoinPrice>): void {
  if (typeof window === "undefined") return;

  try {
    const cache: PricesCache = { data: prices, timestamp: Date.now() };
    localStorage.setItem(PRICE_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Fail silently
  }
}

// ===== OHLC CACHE (per coin + days) =====

export function getOHLCFromCache(coinId: string, days: number): CacheResult<number[][]> {
  if (typeof window === "undefined") {
    return { data: null, isFresh: false, isStale: false, timestamp: null };
  }

  try {
    const key = `${OHLC_CACHE_PREFIX}${coinId}-${days}`;
    const stored = localStorage.getItem(key);
    if (!stored) {
      return { data: null, isFresh: false, isStale: false, timestamp: null };
    }

    const cache: OHLCCache = JSON.parse(stored);
    const age = Date.now() - cache.timestamp;

    if (age < FRESH_TTL) {
      return { data: cache.data, isFresh: true, isStale: false, timestamp: cache.timestamp };
    } else if (age < STALE_TTL) {
      return { data: cache.data, isFresh: false, isStale: true, timestamp: cache.timestamp };
    }

    return { data: null, isFresh: false, isStale: false, timestamp: null };
  } catch {
    return { data: null, isFresh: false, isStale: false, timestamp: null };
  }
}

export function saveOHLCToCache(coinId: string, days: number, ohlc: number[][]): void {
  if (typeof window === "undefined") return;

  try {
    const key = `${OHLC_CACHE_PREFIX}${coinId}-${days}`;
    const cache: OHLCCache = { data: ohlc, timestamp: Date.now() };
    localStorage.setItem(key, JSON.stringify(cache));
  } catch {
    // Fail silently
  }
}

// ===== UTILITIES =====

export function clearAllCache(): void {
  if (typeof window === "undefined") return;

  try {
    const keys = Object.keys(localStorage);
    keys.forEach((key) => {
      if (key.startsWith("crypto-tracker-")) {
        localStorage.removeItem(key);
      }
    });
  } catch {
    // Fail silently
  }
}
