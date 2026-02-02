"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { CandlestickData, Time } from "lightweight-charts";
import Chart from "@/components/Chart";
import RefreshIcon from "@/components/RefreshIcon";
import {
  getPricesFromCache,
  savePricesToCache,
  getOHLCFromCache,
  saveOHLCToCache,
  CoinPrice,
} from "@/lib/cache";

interface Coin {
  id: string;
  name: string;
  symbol: string;
  icon: string;
  gradient: string;
}

const COINS: Coin[] = [
  {
    id: "bitcoin",
    name: "Bitcoin",
    symbol: "BTC",
    icon: "₿",
    gradient: "from-[#f7931a] to-[#ffab40]",
  },
  {
    id: "ethereum",
    name: "Ethereum",
    symbol: "ETH",
    icon: "Ξ",
    gradient: "from-[#627eea] to-[#a8b5f7]",
  },
  {
    id: "solana",
    name: "Solana",
    symbol: "SOL",
    icon: "◎",
    gradient: "from-[#9945ff] to-[#14f195]",
  },
];

const STORAGE_KEY = "crypto-tracker-last-coin";
const DEBOUNCE_MS = 300;
const AUTO_REFRESH_MS = 60000;

// Transform OHLC data for chart
function transformOHLC(ohlc: number[][]): CandlestickData<Time>[] {
  return ohlc.map((candle) => ({
    time: Math.floor(candle[0] / 1000) as Time,
    open: candle[1],
    high: candle[2],
    low: candle[3],
    close: candle[4],
  }));
}

// Format timestamp to time string
function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function Home() {
  const [selectedCoin, setSelectedCoin] = useState<Coin>(COINS[0]);
  const [allPrices, setAllPrices] = useState<Record<string, CoinPrice>>({});
  const [chartData, setChartData] = useState<CandlestickData<Time>[]>([]);
  const [timeRange, setTimeRange] = useState<1 | 7>(1);
  const [lastUpdated, setLastUpdated] = useState<string>("--");
  const [isLoading, setIsLoading] = useState(false);
  const [isStale, setIsStale] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [refreshCountdown, setRefreshCountdown] = useState(AUTO_REFRESH_MS / 1000);

  // Refs
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const selectedCoinRef = useRef(selectedCoin);
  const timeRangeRef = useRef(timeRange);

  // Keep refs in sync
  useEffect(() => {
    selectedCoinRef.current = selectedCoin;
  }, [selectedCoin]);

  useEffect(() => {
    timeRangeRef.current = timeRange;
  }, [timeRange]);

  // Load last viewed coin from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    let initialCoin = COINS[0];
    if (saved) {
      const coin = COINS.find((c) => c.id === saved);
      if (coin) initialCoin = coin;
    }
    setSelectedCoin(initialCoin);
    setIsInitialized(true);
  }, []);

  // Page Visibility API
  useEffect(() => {
    const handleVisibilityChange = () => {
      const visible = document.visibilityState === "visible";
      setIsVisible(visible);
      if (visible) {
        loadAllData(selectedCoin, timeRange);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [selectedCoin, timeRange]);

  // Auto-refresh interval with countdown
  useEffect(() => {
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
    }

    if (isVisible) {
      // Reset countdown
      setRefreshCountdown(AUTO_REFRESH_MS / 1000);

      // Countdown timer (every second)
      const countdownInterval = setInterval(() => {
        setRefreshCountdown((prev) => (prev > 0 ? prev - 1 : AUTO_REFRESH_MS / 1000));
      }, 1000);

      // Refresh timer
      refreshIntervalRef.current = setInterval(() => {
        loadAllData(selectedCoin, timeRange);
        setRefreshCountdown(AUTO_REFRESH_MS / 1000); // Reset countdown after refresh
      }, AUTO_REFRESH_MS);

      return () => {
        clearInterval(countdownInterval);
        if (refreshIntervalRef.current) {
          clearInterval(refreshIntervalRef.current);
        }
      };
    }

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [isVisible, selectedCoin, timeRange]);

  // Fetch ALL prices in one API call
  const fetchPrices = useCallback(async (forceRefresh = false): Promise<Record<string, CoinPrice> | null> => {
    try {
      const url = `/api/prices${forceRefresh ? "?refresh=true" : ""}`;
      const response = await fetch(url);

      if (!response.ok) throw new Error("Failed to fetch prices");

      const data = await response.json();
      if (data.error) throw new Error(data.error);

      // Save to localStorage
      savePricesToCache(data.prices);

      return data.prices;
    } catch (err) {
      console.error("Prices fetch error:", err);
      return null;
    }
  }, []);

  // Fetch OHLC for a specific coin
  const fetchOHLC = useCallback(async (coinId: string, days: number, forceRefresh = false): Promise<number[][] | null> => {
    try {
      const url = `/api/ohlc?coin=${coinId}&days=${days}${forceRefresh ? "&refresh=true" : ""}`;
      const response = await fetch(url);

      if (!response.ok) throw new Error("Failed to fetch OHLC");

      const data = await response.json();
      if (data.error) throw new Error(data.error);

      // Save to localStorage
      if (data.ohlc && data.ohlc.length > 0) {
        saveOHLCToCache(coinId, days, data.ohlc);
      }

      return data.ohlc || [];
    } catch (err) {
      console.error("OHLC fetch error:", err);
      return null;
    }
  }, []);

  // Main load function - cache-first strategy
  const loadAllData = useCallback(
    async (coin: Coin, range: number, showLoading = false) => {
      let needsPriceFetch = true;
      let needsOHLCFetch = true;
      let pricesStale = false;
      let ohlcStale = false;

      // Check prices cache (all coins)
      const pricesCache = getPricesFromCache();
      if (pricesCache.data) {
        setAllPrices(pricesCache.data);
        if (pricesCache.isFresh) {
          needsPriceFetch = false;
        } else {
          pricesStale = true;
        }
      }

      // Check OHLC cache (specific coin + range)
      const ohlcCache = getOHLCFromCache(coin.id, range);
      if (ohlcCache.data && ohlcCache.data.length > 0) {
        if (coin.id === selectedCoinRef.current.id && range === timeRangeRef.current) {
          setChartData(transformOHLC(ohlcCache.data));
        }
        if (ohlcCache.isFresh) {
          needsOHLCFetch = false;
        } else {
          ohlcStale = true;
        }
      }

      // Update stale indicator
      setIsStale(pricesStale || ohlcStale);

      // If everything is fresh from cache, we're done
      if (!needsPriceFetch && !needsOHLCFetch) {
        // Show the cache timestamp with "(cached)" indicator
        const cacheTime = pricesCache.timestamp || ohlcCache.timestamp;
        if (cacheTime) {
          setLastUpdated(`${formatTime(cacheTime)} (cached)`);
        }
        setError(null);
        return;
      }

      // Show loading only if we have no cached data
      if (showLoading && !pricesCache.data && !ohlcCache.data) {
        setIsLoading(true);
      }

      // Fetch what we need (in parallel if both needed)
      const promises: Promise<unknown>[] = [];

      if (needsPriceFetch) {
        promises.push(
          fetchPrices(pricesStale).then((prices) => {
            if (prices) {
              setAllPrices(prices);
            }
          })
        );
      }

      if (needsOHLCFetch) {
        promises.push(
          fetchOHLC(coin.id, range, ohlcStale).then((ohlc) => {
            if (ohlc && ohlc.length > 0 && coin.id === selectedCoinRef.current.id && range === timeRangeRef.current) {
              setChartData(transformOHLC(ohlc));
            }
          })
        );
      }

      await Promise.all(promises);

      setIsStale(false);
      setError(null);
      setLastUpdated(
        new Date().toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );

      if (showLoading) setIsLoading(false);
    },
    [fetchPrices, fetchOHLC]
  );

  // Debounced load for coin/time changes
  const debouncedLoad = useCallback(
    (coin: Coin, range: number) => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // Show cached data immediately
      const pricesCache = getPricesFromCache();
      if (pricesCache.data) {
        setAllPrices(pricesCache.data);
      }

      const ohlcCache = getOHLCFromCache(coin.id, range);
      if (ohlcCache.data && ohlcCache.data.length > 0) {
        setChartData(transformOHLC(ohlcCache.data));
        if (ohlcCache.isFresh && pricesCache.isFresh) {
          const cacheTime = pricesCache.timestamp || ohlcCache.timestamp;
          if (cacheTime) {
            setLastUpdated(`${formatTime(cacheTime)} (cached)`);
          }
          return; // No need to fetch
        }
      }

      debounceTimerRef.current = setTimeout(() => {
        loadAllData(coin, range, !pricesCache.data);
      }, DEBOUNCE_MS);
    },
    [loadAllData]
  );

  // Initial load
  useEffect(() => {
    if (!isInitialized) return;
    loadAllData(selectedCoin, timeRange, true);
  }, [isInitialized]);

  // Handle coin change
  const handleCoinChange = async (coin: Coin) => {
    if (coin.id === selectedCoin.id) {
      setIsDropdownOpen(false);
      return;
    }

    setSelectedCoin(coin);
    localStorage.setItem(STORAGE_KEY, coin.id);
    setIsDropdownOpen(false);

    // Check if we have cached OHLC data for this coin
    const ohlcCache = getOHLCFromCache(coin.id, timeRange);
    if (ohlcCache.data && ohlcCache.data.length > 0) {
      // Show cached data immediately
      setChartData(transformOHLC(ohlcCache.data));
      if (!ohlcCache.isFresh) {
        // Revalidate in background
        fetchOHLC(coin.id, timeRange, true).then((ohlc) => {
          if (ohlc && ohlc.length > 0 && coin.id === selectedCoinRef.current.id) {
            setChartData(transformOHLC(ohlc));
          }
        });
      }
    } else {
      // No cache - show loading and fetch
      setIsLoading(true);
      setChartData([]);
      const ohlc = await fetchOHLC(coin.id, timeRange, false);
      if (ohlc && ohlc.length > 0 && coin.id === selectedCoinRef.current.id) {
        setChartData(transformOHLC(ohlc));
      }
      setIsLoading(false);
    }
  };

  // Handle time range change
  const handleTimeRangeChange = async (range: 1 | 7) => {
    if (range === timeRange) return;
    setTimeRange(range);

    // Check if we have cached data for this range
    const ohlcCache = getOHLCFromCache(selectedCoin.id, range);
    if (ohlcCache.data && ohlcCache.data.length > 0) {
      // Show cached data immediately
      setChartData(transformOHLC(ohlcCache.data));
      if (!ohlcCache.isFresh) {
        // Revalidate in background
        fetchOHLC(selectedCoin.id, range, true).then((ohlc) => {
          if (ohlc && ohlc.length > 0) {
            setChartData(transformOHLC(ohlc));
          }
        });
      }
    } else {
      // No cache - show loading and fetch
      setIsLoading(true);
      setChartData([]);
      const ohlc = await fetchOHLC(selectedCoin.id, range, false);
      if (ohlc && ohlc.length > 0) {
        setChartData(transformOHLC(ohlc));
      }
      setIsLoading(false);
    }
  };

  // Manual refresh - always fetch fresh
  const handleManualRefresh = async () => {
    setIsLoading(true);
    await Promise.all([
      fetchPrices(true).then((prices) => prices && setAllPrices(prices)),
      fetchOHLC(selectedCoin.id, timeRange, true).then(
        (ohlc) => ohlc && ohlc.length > 0 && setChartData(transformOHLC(ohlc))
      ),
    ]);
    setIsStale(false);
    setLastUpdated(
      new Date().toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    );
    setIsLoading(false);
  };

  // Close dropdown
  useEffect(() => {
    const handleClickOutside = () => setIsDropdownOpen(false);
    if (isDropdownOpen) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [isDropdownOpen]);

  // Get current coin's price data
  const currentPrice = allPrices[selectedCoin.id];

  // Format helpers
  const formatPrice = (price: number) =>
    "$" + price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const formatChange = (change: number | null | undefined) => {
    if (change == null) return "--";
    const prefix = change >= 0 ? "+" : "";
    return prefix + change.toFixed(2) + "%";
  };

  return (
    <main className="min-h-screen bg-bg-primary">
      <div className="max-w-[900px] mx-auto px-6 py-10">
        {/* Header */}
        <header className="flex items-center justify-between mb-12">
          <div className="flex items-center gap-3">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 1v2M15 1v2M9 21v2M15 21v2" />
              <path d="M18 8c-1-2-3-3.5-6-3.5-4 0-7 3.5-7 7.5s3 7.5 7 7.5c3 0 5-1.5 6-3.5" />
            </svg>
            <span className="text-xl font-medium tracking-tight">
              Crypto Tracker
            </span>
          </div>
          <button
            onClick={handleManualRefresh}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2.5 bg-bg-tertiary border border-border rounded-lg text-sm font-medium transition-all hover:bg-accent-blue hover:border-accent-blue disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshIcon className={`w-4 h-4 ${isLoading ? "animate-spin-fast" : ""}`} />
            Refresh
          </button>
        </header>

        {/* Error Message */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400 text-sm mb-5">
            {error}
          </div>
        )}

        {/* Price Section */}
        <section className="mb-10">
          <div className="flex items-center gap-2 mb-2">
            <p className="text-sm text-gray-500 uppercase tracking-wider">
              {selectedCoin.name} Price
            </p>
            {isStale && (
              <span className="px-2 py-0.5 text-xs bg-yellow-500/10 text-yellow-500 rounded-full">
                updating...
              </span>
            )}
          </div>
          <div className="flex items-baseline gap-3 mb-5">
            <span className={`text-4xl md:text-5xl bg-gradient-to-br ${selectedCoin.gradient} bg-clip-text text-transparent`}>
              {selectedCoin.icon}
            </span>
            <span className="font-mono text-5xl md:text-6xl font-semibold tracking-tight">
              {currentPrice ? formatPrice(currentPrice.price) : "--"}
            </span>
            <span className="text-2xl text-gray-500">USD</span>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-4 max-w-[400px] mb-5">
            <div className="bg-bg-secondary border border-border rounded-xl p-4">
              <p className="text-sm text-gray-500 mb-1.5">24h Change</p>
              <p
                className={`font-mono text-lg font-medium ${
                  currentPrice
                    ? currentPrice.change24h >= 0
                      ? "text-green-500"
                      : "text-red-500"
                    : "text-gray-400"
                }`}
              >
                {currentPrice ? formatChange(currentPrice.change24h) : "--"}
              </p>
            </div>
            <div className="bg-bg-secondary border border-border rounded-xl p-4">
              <p className="text-sm text-gray-500 mb-1.5">7d Change</p>
              <p
                className={`font-mono text-lg font-medium ${
                  currentPrice
                    ? currentPrice.change7d >= 0
                      ? "text-green-500"
                      : "text-red-500"
                    : "text-gray-400"
                }`}
              >
                {currentPrice ? formatChange(currentPrice.change7d) : "--"}
              </p>
            </div>
          </div>

          {/* Coin Selector Dropdown */}
          <div className="relative max-w-[400px]">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsDropdownOpen(!isDropdownOpen);
              }}
              className="w-full flex items-center justify-between px-4 py-3 bg-bg-secondary border border-border rounded-xl text-left transition-all hover:border-gray-600"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-7 h-7 bg-gradient-to-br ${selectedCoin.gradient} rounded-full flex items-center justify-center font-bold text-sm text-black`}
                >
                  {selectedCoin.icon}
                </div>
                <span className="font-medium">{selectedCoin.name}</span>
                <span className="text-gray-500 text-sm">{selectedCoin.symbol}</span>
              </div>
              <svg
                className={`w-5 h-5 text-gray-500 transition-transform ${isDropdownOpen ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {isDropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-bg-secondary border border-border rounded-xl overflow-hidden z-10 shadow-xl">
                {COINS.map((coin) => (
                  <button
                    key={coin.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCoinChange(coin);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all hover:bg-bg-tertiary ${
                      coin.id === selectedCoin.id ? "bg-bg-tertiary" : ""
                    }`}
                  >
                    <div
                      className={`w-7 h-7 bg-gradient-to-br ${coin.gradient} rounded-full flex items-center justify-center font-bold text-sm text-black`}
                    >
                      {coin.icon}
                    </div>
                    <span className="font-medium">{coin.name}</span>
                    <span className="text-gray-500 text-sm">{coin.symbol}</span>
                    {coin.id === selectedCoin.id && (
                      <svg className="w-5 h-5 text-accent-blue ml-auto" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Chart Section */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-medium text-gray-400">Price Chart</h2>
            <div className="flex bg-bg-secondary border border-border rounded-lg p-1">
              <button
                onClick={() => handleTimeRangeChange(1)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  timeRange === 1 ? "bg-accent-blue text-white" : "text-gray-500 hover:text-white"
                }`}
              >
                24H
              </button>
              <button
                onClick={() => handleTimeRangeChange(7)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  timeRange === 7 ? "bg-accent-blue text-white" : "text-gray-500 hover:text-white"
                }`}
              >
                7D
              </button>
            </div>
          </div>
          <div className="bg-bg-secondary border border-border rounded-xl p-5 h-[400px]">
            {chartData.length > 0 ? (
              <Chart data={chartData} />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-gray-500">
                <svg className="w-12 h-12 mb-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
                <p className="text-sm">{isLoading ? "Loading chart data..." : "Chart data unavailable - try refreshing"}</p>
              </div>
            )}
          </div>
        </section>

        {/* Footer */}
        <footer className="flex items-center justify-between pt-5 border-t border-border">
          <p className="text-sm text-gray-500">
            Last updated: <span className="text-gray-400">{lastUpdated}</span>
          </p>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <div className={`w-2 h-2 rounded-full ${isVisible ? "bg-accent-blue animate-pulse-slow" : "bg-gray-600"}`} />
            <span>{isVisible ? `Auto-refresh (${refreshCountdown}s)` : "Paused"}</span>
          </div>
        </footer>
      </div>
    </main>
  );
}
