"use client";

import { useState, useEffect, useCallback } from "react";

interface FearGreedData {
  current: { value: number; classification: string; timestamp: number };
  yesterday: { value: number; classification: string };
  lastWeek: { value: number; classification: string };
}

// Get color based on value
function getColor(value: number): string {
  if (value <= 24) return "#ef4444"; // Extreme Fear - red
  if (value <= 44) return "#f97316"; // Fear - orange
  if (value <= 55) return "#eab308"; // Neutral - yellow
  if (value <= 74) return "#84cc16"; // Greed - lime
  return "#22c55e"; // Extreme Greed - green
}

// Get emoji based on value
function getEmoji(value: number): string {
  if (value <= 24) return "😱";
  if (value <= 44) return "😰";
  if (value <= 55) return "😐";
  if (value <= 74) return "😏";
  return "🤑";
}

// Get short label
function getShortLabel(classification: string): string {
  return classification.replace("Extreme ", "Ext. ");
}

export default function FearGreedIndex() {
  const [data, setData] = useState<FearGreedData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showTooltip, setShowTooltip] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const response = await fetch("/api/fear-greed");
      if (!response.ok) throw new Error("Failed to fetch");
      const json = await response.json();
      if (!json.error) {
        setData(json);
      }
    } catch (error) {
      console.error("Fear & Greed fetch error:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    // Refresh every 5 minutes
    const interval = setInterval(fetchData, 300000);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (isLoading || !data) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-bg-tertiary border border-border rounded-lg">
        <div className="w-4 h-4 rounded-full bg-gray-600 animate-pulse" />
        <span className="text-sm text-gray-500">--</span>
      </div>
    );
  }

  const { current, yesterday, lastWeek } = data;
  const color = getColor(current.value);
  const emoji = getEmoji(current.value);
  const changeFromYesterday = current.value - yesterday.value;
  const changeFromLastWeek = current.value - lastWeek.value;

  return (
    <div className="relative">
      {/* Main Button */}
      <button
        onClick={() => setShowTooltip(!showTooltip)}
        className="flex items-center gap-2 px-3 py-2 bg-bg-tertiary border border-border rounded-lg transition-all hover:border-gray-600"
      >
        {/* Mini Gauge */}
        <div className="relative w-8 h-5">
          <svg viewBox="0 0 32 20" className="w-full h-full overflow-visible">
            <defs>
              <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#ef4444" />
                <stop offset="25%" stopColor="#f97316" />
                <stop offset="50%" stopColor="#eab308" />
                <stop offset="75%" stopColor="#84cc16" />
                <stop offset="100%" stopColor="#22c55e" />
              </linearGradient>
            </defs>
            {/* Background arc */}
            <path
              d="M 4 18 A 12 12 0 0 1 28 18"
              fill="none"
              stroke="#333"
              strokeWidth="3"
              strokeLinecap="round"
            />
            {/* Colored arc */}
            <path
              d="M 4 18 A 12 12 0 0 1 28 18"
              fill="none"
              stroke="url(#gaugeGradient)"
              strokeWidth="3"
              strokeLinecap="round"
              opacity="0.8"
            />
            {/* Needle */}
            <line
              x1="16"
              y1="18"
              x2={16 + 9 * Math.cos(Math.PI - (current.value / 100) * Math.PI)}
              y2={18 - 9 * Math.sin((current.value / 100) * Math.PI)}
              stroke={color}
              strokeWidth="2"
              strokeLinecap="round"
            />
            {/* Center dot */}
            <circle cx="16" cy="18" r="2" fill={color} />
          </svg>
        </div>
        
        {/* Value */}
        <span className="text-sm font-mono font-medium" style={{ color }}>
          {current.value}
        </span>
        
        {/* Label (hidden on mobile) */}
        <span className="text-xs text-gray-500 hidden sm:inline">
          {getShortLabel(current.classification)}
        </span>
      </button>

      {/* Tooltip */}
      {showTooltip && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowTooltip(false)}
          />
          
          {/* Tooltip Content */}
          <div className="absolute top-full right-0 mt-2 w-72 bg-bg-secondary border border-border rounded-xl shadow-2xl z-50 overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 border-b border-border">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">Fear & Greed Index</h3>
                <span className="text-2xl">{emoji}</span>
              </div>
            </div>

            {/* Current Value */}
            <div className="px-4 py-4">
              {/* Large Gauge */}
              <div className="relative h-28 mb-4">
                <svg viewBox="0 0 100 70" className="w-full h-full">
                  <defs>
                    <linearGradient id="gaugeGradientLarge" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#ef4444" />
                      <stop offset="25%" stopColor="#f97316" />
                      <stop offset="50%" stopColor="#eab308" />
                      <stop offset="75%" stopColor="#84cc16" />
                      <stop offset="100%" stopColor="#22c55e" />
                    </linearGradient>
                  </defs>
                  {/* Background arc */}
                  <path
                    d="M 10 50 A 40 40 0 0 1 90 50"
                    fill="none"
                    stroke="#222"
                    strokeWidth="8"
                    strokeLinecap="round"
                  />
                  {/* Colored arc */}
                  <path
                    d="M 10 50 A 40 40 0 0 1 90 50"
                    fill="none"
                    stroke="url(#gaugeGradientLarge)"
                    strokeWidth="8"
                    strokeLinecap="round"
                  />
                  {/* Needle */}
                  <line
                    x1="50"
                    y1="50"
                    x2={50 + 30 * Math.cos(Math.PI - (current.value / 100) * Math.PI)}
                    y2={50 - 30 * Math.sin((current.value / 100) * Math.PI)}
                    stroke={color}
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                  {/* Center dot */}
                  <circle cx="50" cy="50" r="4" fill={color} />
                  {/* Labels */}
                  <text x="10" y="64" fontSize="7" fill="white" textAnchor="middle">0</text>
                  <text x="50" y="23" fontSize="7" fill="white" textAnchor="middle">50</text>
                  <text x="90" y="64" fontSize="7" fill="white" textAnchor="middle">100</text>
                </svg>
              </div>

              {/* Current reading */}
              <div className="text-center mb-4">
                <span className="text-4xl font-mono font-bold" style={{ color }}>
                  {current.value}
                </span>
                <p className="text-sm mt-1" style={{ color }}>
                  {current.classification}
                </p>
              </div>

              {/* Historical comparison */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-bg-tertiary rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">Yesterday</p>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-medium" style={{ color: getColor(yesterday.value) }}>
                      {yesterday.value}
                    </span>
                    <span className={`text-xs font-mono ${changeFromYesterday >= 0 ? "text-green-500" : "text-red-500"}`}>
                      {changeFromYesterday >= 0 ? "+" : ""}{changeFromYesterday}
                    </span>
                  </div>
                </div>
                <div className="bg-bg-tertiary rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">Last Week</p>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-medium" style={{ color: getColor(lastWeek.value) }}>
                      {lastWeek.value}
                    </span>
                    <span className={`text-xs font-mono ${changeFromLastWeek >= 0 ? "text-green-500" : "text-red-500"}`}>
                      {changeFromLastWeek >= 0 ? "+" : ""}{changeFromLastWeek}
                    </span>
                  </div>
                </div>
              </div>

              {/* Scale explanation */}
              <div className="border-t border-border pt-3">
                <p className="text-xs text-gray-500 mb-2">Scale</p>
                <div className="space-y-1 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#ef4444]" />
                    <span className="text-gray-400">0-24: Extreme Fear</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#f97316]" />
                    <span className="text-gray-400">25-44: Fear</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#eab308]" />
                    <span className="text-gray-400">45-55: Neutral</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#84cc16]" />
                    <span className="text-gray-400">56-74: Greed</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#22c55e]" />
                    <span className="text-gray-400">75-100: Extreme Greed</span>
                  </div>
                </div>
              </div>

              {/* Info */}
              <p className="text-xs text-gray-600 mt-3">
                The index analyzes emotions and sentiments from different sources including volatility, market momentum, social media, and surveys.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
