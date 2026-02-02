import { NextResponse } from "next/server";

interface FearGreedCache {
  data: {
    current: { value: number; classification: string; timestamp: number };
    yesterday: { value: number; classification: string };
    lastWeek: { value: number; classification: string };
  };
  timestamp: number;
}

let fearGreedCache: FearGreedCache | null = null;
const CACHE_TTL = 300000; // 5 minutes (this data updates once daily)

export async function GET() {
  // Check cache
  if (fearGreedCache && Date.now() - fearGreedCache.timestamp < CACHE_TTL) {
    return NextResponse.json(fearGreedCache.data);
  }

  try {
    // Fetch current + historical data (limit=8 gives us enough for weekly comparison)
    const response = await fetch(
      "https://api.alternative.me/fng/?limit=8",
      { headers: { Accept: "application/json" } }
    );

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const json = await response.json();
    const data = json.data;

    if (!data || data.length === 0) {
      throw new Error("No data returned");
    }

    // Current (index 0), Yesterday (index 1), Last week (index 7)
    const current = data[0];
    const yesterday = data[1] || current;
    const lastWeek = data[7] || data[data.length - 1] || current;

    const result = {
      current: {
        value: parseInt(current.value),
        classification: current.value_classification,
        timestamp: parseInt(current.timestamp) * 1000,
      },
      yesterday: {
        value: parseInt(yesterday.value),
        classification: yesterday.value_classification,
      },
      lastWeek: {
        value: parseInt(lastWeek.value),
        classification: lastWeek.value_classification,
      },
    };

    // Update cache
    fearGreedCache = { data: result, timestamp: Date.now() };

    return NextResponse.json(result);
  } catch (error) {
    console.error("Fear & Greed API Error:", error);

    // Return cached data if available
    if (fearGreedCache) {
      return NextResponse.json(fearGreedCache.data);
    }

    return NextResponse.json(
      { error: "Failed to fetch Fear & Greed Index" },
      { status: 500 }
    );
  }
}
