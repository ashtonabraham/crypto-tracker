"use client";

import { useEffect, useRef, useState } from "react";
import { createChart, IChartApi, ISeriesApi, CandlestickData, Time, ColorType } from "lightweight-charts";

interface ChartProps {
  data: CandlestickData<Time>[];
}

interface TooltipData {
  price: string;
  time: string;
  x: number;
  y: number;
  visible: boolean;
  isUp: boolean;
}

export default function Chart({ data }: ChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const [tooltip, setTooltip] = useState<TooltipData>({
    price: "",
    time: "",
    x: 0,
    y: 0,
    visible: false,
    isUp: true,
  });

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Create chart
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#a0a0a0",
        fontFamily: "'JetBrains Mono', monospace",
      },
      grid: {
        vertLines: { color: "#1a1a1a" },
        horzLines: { color: "#1a1a1a" },
      },
      crosshair: {
        vertLine: {
          color: "#3b82f6",
          width: 1,
          style: 2,
          labelVisible: false,
        },
        horzLine: {
          color: "#3b82f6",
          width: 1,
          style: 2,
          labelVisible: false,
        },
      },
      rightPriceScale: {
        borderColor: "#222222",
      },
      timeScale: {
        borderColor: "#222222",
        visible: true,
        timeVisible: true,
        secondsVisible: false,
      },
      localization: {
        timeFormatter: (time: number) => {
          const date = new Date(time * 1000);
          return date.toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          });
        },
      },
      handleScroll: {
        vertTouchDrag: false,
      },
    });

    const candlestickSeries = chart.addCandlestickSeries({
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderUpColor: "#22c55e",
      borderDownColor: "#ef4444",
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
    });

    chartRef.current = chart;
    seriesRef.current = candlestickSeries;

    // Subscribe to crosshair move for tooltip
    chart.subscribeCrosshairMove((param) => {
      if (!param.point || !param.time || !seriesRef.current) {
        setTooltip((prev) => ({ ...prev, visible: false }));
        return;
      }

      const data = param.seriesData.get(seriesRef.current) as CandlestickData<Time> | undefined;
      if (!data) {
        setTooltip((prev) => ({ ...prev, visible: false }));
        return;
      }

      const price = "$" + data.close.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

      const date = new Date((param.time as number) * 1000);
      const timeStr = date.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

      const isUp = data.close >= data.open;

      setTooltip({
        price,
        time: timeStr,
        x: param.point.x,
        y: param.point.y,
        visible: true,
        isUp,
      });
    });

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
      }
    };

    window.addEventListener("resize", handleResize);
    handleResize();

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
  }, []);

  // Update data when it changes
  useEffect(() => {
    if (seriesRef.current && data.length > 0) {
      seriesRef.current.setData(data);
      chartRef.current?.timeScale().fitContent();
    }
  }, [data]);

  return (
    <div ref={chartContainerRef} className="w-full h-full relative">
      {tooltip.visible && (
        <div
          className={`absolute pointer-events-none rounded-lg px-3 py-2 text-sm z-10 shadow-lg ${
            tooltip.isUp 
              ? "bg-green-500" 
              : "bg-red-500"
          }`}
          style={{
            left: tooltip.x + 15,
            top: tooltip.y - 40,
          }}
        >
          <div className="font-mono font-semibold text-black">{tooltip.price}</div>
          <div className="text-black/70 text-xs">{tooltip.time}</div>
        </div>
      )}
    </div>
  );
}
