"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const TIMEFRAMES = ["5m", "15m", "1H", "4H", "1D"];
const DEFAULT_TF = "15m";

const INTERVAL_MAP: Record<string, string> = {
  "5m": "5min",
  "15m": "15min",
  "1H": "1h",
  "4H": "4h",
  "1D": "1day",
};

type Candle = {
  datetime: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};

type ApiResponse = {
  candles?: Candle[];
  data?: Candle[];
  values?: Candle[];
  symbol?: string;
  interval?: string;
  error?: string;
  message?: string;
};

export default function TradingViewChart() {
  const [activeTimeframe, setActiveTimeframe] = useState(DEFAULT_TF);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCandles = useCallback(async () => {
    try {
      setError(null);

      const interval = INTERVAL_MAP[activeTimeframe];

      const response = await fetch(
        `/api/candles?interval=${encodeURIComponent(interval)}`,
        {
          method: "GET",
          cache: "no-store",
        }
      );

      const json: ApiResponse = await response.json();

      if (!response.ok) {
        throw new Error(
          json?.error ||
            json?.message ||
            `Market data request failed (${response.status})`
        );
      }

      if (json?.error) {
        throw new Error(json.error);
      }

      /*
       * Support the common response shapes:
       *
       * { candles: [...] }
       * { data: [...] }
       * { values: [...] }
       */
      const rawCandles = json.candles || json.data || json.values || [];

      if (!Array.isArray(rawCandles) || rawCandles.length === 0) {
        throw new Error("No candle data was returned.");
      }

      const normalized = rawCandles
        .map((c: any) => ({
          datetime: String(
            c?.datetime ??
              c?.date ??
              c?.time ??
              c?.timestamp ??
              ""
          ),
          open: Number(c?.open ?? c?.o),
          high: Number(c?.high ?? c?.h),
          low: Number(c?.low ?? c?.l),
          close: Number(c?.close ?? c?.c),
          volume:
            c?.volume !== undefined ? Number(c.volume) : undefined,
        }))
        .filter(
          (c) =>
            c.datetime &&
            Number.isFinite(c.open) &&
            Number.isFinite(c.high) &&
            Number.isFinite(c.low) &&
            Number.isFinite(c.close)
        );

      if (normalized.length === 0) {
        throw new Error("The API returned invalid candle data.");
      }

      /*
       * API data is normally newest-first.
       * We want oldest → newest for chart rendering.
       */
      normalized.sort((a, b) => {
        const timeA = new Date(a.datetime).getTime();
        const timeB = new Date(b.datetime).getTime();

        return timeA - timeB;
      });

      setCandles(normalized);
    } catch (err) {
      console.error("TradingViewChart market data error:", err);

      setCandles([]);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load market data."
      );
    } finally {
      setLoading(false);
    }
  }, [activeTimeframe]);

  /*
   * Fetch immediately when timeframe changes.
   */
  useEffect(() => {
    setLoading(true);
    fetchCandles();
  }, [fetchCandles]);

  /*
   * Poll for fresh market data.
   *
   * This follows the MVP architecture's client-side polling
   * approach rather than introducing WebSockets at this stage.
   */
  useEffect(() => {
    const interval = window.setInterval(() => {
      fetchCandles();
    }, 15_000);

    return () => {
      window.clearInterval(interval);
    };
  }, [fetchCandles]);

  const visibleCandles = useMemo(() => {
    /*
     * Keep the SVG readable on smaller screens.
     * We render the most recent 60 candles.
     */
    return candles.slice(-60);
  }, [candles]);

  const latestCandle = candles[candles.length - 1];

  const chartData = useMemo(() => {
    if (visibleCandles.length === 0) {
      return null;
    }

    const width = 750;
    const height = 380;

    const paddingX = 24;
    const paddingY = 24;

    const highs = visibleCandles.map((c) => c.high);
    const lows = visibleCandles.map((c) => c.low);

    const maxPrice = Math.max(...highs);
    const minPrice = Math.min(...lows);

    const range = maxPrice - minPrice || 1;

    const chartWidth = width - paddingX * 2;
    const chartHeight = height - paddingY * 2;

    const xStep =
      visibleCandles.length > 1
        ? chartWidth / (visibleCandles.length - 1)
        : chartWidth;

    const y = (price: number) =>
      paddingY +
      ((maxPrice - price) / range) * chartHeight;

    const points = visibleCandles
      .map((c, i) => {
        const x =
          visibleCandles.length === 1
            ? width / 2
            : paddingX + i * xStep;

        return `${x},${y(c.close)}`;
      })
      .join(" ");

    const candlesSvg = visibleCandles.map((c, i) => {
      const x =
        visibleCandles.length === 1
          ? width / 2
          : paddingX + i * xStep;

      const candleWidth = Math.max(
        3,
        Math.min(12, xStep * 0.55)
      );

      const bodyTop = y(Math.max(c.open, c.close));
      const bodyBottom = y(Math.min(c.open, c.close));

      const bodyHeight = Math.max(
        2,
        bodyBottom - bodyTop
      );

      const isBullish = c.close >= c.open;

      return {
        x,
        candleWidth,
        highY: y(c.high),
        lowY: y(c.low),
        bodyTop,
        bodyHeight,
        isBullish,
      };
    });

    const areaPoints = [
      `${paddingX},${height - paddingY}`,
      ...visibleCandles.map((c, i) => {
        const x =
          visibleCandles.length === 1
            ? width / 2
            : paddingX + i * xStep;

        return `${x},${y(c.close)}`;
      }),
      `${width - paddingX},${height - paddingY}`,
    ].join(" ");

    return {
      width,
      height,
      points,
      areaPoints,
      candlesSvg,
    };
  }, [visibleCandles]);

  const formatPrice = (value?: number) => {
    if (!Number.isFinite(value)) {
      return "—";
    }

    return value!.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const formatDate = (datetime?: string) => {
    if (!datetime) {
      return "—";
    }

    const date = new Date(datetime);

    if (Number.isNaN(date.getTime())) {
      return datetime;
    }

    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div
      className="panel flex flex-col"
      style={{
        minHeight: "clamp(300px, 48vh, 560px)",
      }}
    >
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#23262F] px-4 py-2.5 sm:px-5">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-xs font-bold text-[#E4E6EB]">
              XAU
            </span>

            <span className="text-[#555B6B]">/</span>

            <span className="font-mono text-xs font-bold text-[#8891A0]">
              USD
            </span>
          </div>

          {/* Timeframe selector */}
          <div className="flex gap-0.5 rounded-lg border border-[#23262F] bg-[#0E1016] p-0.5">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf}
                type="button"
                onClick={() => setActiveTimeframe(tf)}
                className={`rounded-md px-2.5 py-1 font-mono text-[11px] font-semibold transition-all ${
                  activeTimeframe === tf
                    ? "bg-[#1E2229] text-[#E5C96A] shadow-sm"
                    : "text-[#555B6B] hover:text-[#8891A0]"
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`rounded-full border px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-wider ${
              error
                ? "border-[#5A292D] bg-[#1A0F11] text-[#E04D53]"
                : loading
                  ? "border-[#40391F] bg-[#17150D] text-[#C9A84C]"
                  : "border-[#234436] bg-[#0E1713] text-[#30B87A]"
            }`}
          >
            {error
              ? "Market data error"
              : loading
                ? "Loading market data"
                : "Live · Twelve Data"}
          </span>
        </div>
      </div>

      {/* Chart body */}
      <div className="relative flex flex-1 overflow-hidden">
        {chartData ? (
          <svg
            className="absolute inset-0 h-full w-full"
            viewBox="0 0 750 380"
            preserveAspectRatio="none"
            aria-label={`XAU/USD ${activeTimeframe} price chart`}
          >
            {/* Horizontal grid */}
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <line
                key={`h${i}`}
                x1="0"
                y1={i * 63.3}
                x2="750"
                y2={i * 63.3}
                stroke="#1E2229"
                strokeWidth="1"
              />
            ))}

            {/* Vertical grid */}
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
              <line
                key={`v${i}`}
                x1={i * 83.33}
                y1="0"
                x2={i * 83.33}
                y2="380"
                stroke="#1E2229"
                strokeWidth="1"
              />
            ))}

            <defs>
              <linearGradient
                id="areaGrad"
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="0%"
                  stopColor="#C9A84C"
                  stopOpacity="0.18"
                />

                <stop
                  offset="100%"
                  stopColor="#C9A84C"
                  stopOpacity="0"
                />
              </linearGradient>
            </defs>

            {/* Area */}
            <polygon
              points={chartData.areaPoints}
              fill="url(#areaGrad)"
            />

            {/* Price line */}
            <polyline
              points={chartData.points}
              fill="none"
              stroke="#C9A84C"
              strokeWidth="1.5"
              strokeLinejoin="round"
              strokeLinecap="round"
              opacity="0.75"
            />

            {/* Real candles */}
            {chartData.candlesSvg.map((candle, i) => {
              const color = candle.isBullish
                ? "#30B87A"
                : "#E04D53";

              return (
                <g key={i}>
                  {/* Wick */}
                  <line
                    x1={candle.x}
                    y1={candle.highY}
                    x2={candle.x}
                    y2={candle.lowY}
                    stroke={color}
                    strokeWidth="1"
                  />

                  {/* Body */}
                  <rect
                    x={
                      candle.x -
                      candle.candleWidth / 2
                    }
                    y={candle.bodyTop}
                    width={candle.candleWidth}
                    height={candle.bodyHeight}
                    fill={color}
                    rx="1"
                  />
                </g>
              );
            })}
          </svg>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative z-10 flex max-w-sm flex-col items-center gap-3 rounded-xl border border-[#23262F] bg-[#09090C]/90 px-6 py-5 text-center backdrop-blur-sm">
              <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#23262F] bg-[#13151B]">
                {loading ? <Spinner /> : <ChartIcon />}
              </div>

              <div>
                <p className="text-sm font-semibold text-[#E4E6EB]">
                  {loading
                    ? "Loading XAU/USD"
                    : "Market data unavailable"}
                </p>

                <p className="mt-1 text-xs leading-5 text-[#555B6B]">
                  {loading
                    ? `Fetching real ${activeTimeframe} candles from the market-data API.`
                    : error ||
                      "No candle data was returned by the API."}
                </p>
              </div>

              {!loading && (
                <button
                  type="button"
                  onClick={fetchCandles}
                  className="rounded-md border border-[#40391F] bg-[#17150D] px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-[#C9A84C] transition hover:bg-[#211D10]"
                >
                  Retry
                </button>
              )}
            </div>
          </div>
        )}

        {/* Small loading indicator while refreshing existing data */}
        {loading && candles.length > 0 && (
          <div className="absolute right-4 top-4 z-10 flex items-center gap-2 rounded-full border border-[#23262F] bg-[#09090C]/85 px-2.5 py-1.5 backdrop-blur-sm">
            <Spinner small />

            <span className="font-mono text-[9px] uppercase tracking-wider text-[#555B6B]">
              Updating
            </span>
          </div>
        )}
      </div>

      {/* Bottom status bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#23262F] px-4 py-2 sm:px-5">
        <div className="flex flex-wrap items-center gap-4">
          {[
            {
              label: "O",
              value: latestCandle
                ? formatPrice(latestCandle.open)
                : "—",
            },
            {
              label: "H",
              value: latestCandle
                ? formatPrice(latestCandle.high)
                : "—",
            },
            {
              label: "L",
              value: latestCandle
                ? formatPrice(latestCandle.low)
                : "—",
            },
            {
              label: "C",
              value: latestCandle
                ? formatPrice(latestCandle.close)
                : "—",
            },
          ].map(({ label, value }) => (
            <span
              key={label}
              className="font-mono text-[11px]"
            >
              <span className="text-[#555B6B]">
                {label}{" "}
              </span>

              <span className="text-[#8891A0]">
                {value}
              </span>
            </span>
          ))}
        </div>

        <div className="flex items-center gap-3">
          {latestCandle && (
            <span className="font-mono text-[10px] text-[#555B6B]">
              {formatDate(latestCandle.datetime)}
            </span>
          )}

          <span className="font-mono text-[11px] text-[#555B6B]">
            {activeTimeframe}
          </span>
        </div>
      </div>
    </div>
  );
}

function ChartIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      className="h-5 w-5 text-[#C9A84C]"
      fill="currentColor"
    >
      <rect
        x="1"
        y="6"
        width="4"
        height="12"
        rx="1"
        opacity="0.5"
      />

      <rect
        x="8"
        y="3"
        width="4"
        height="15"
        rx="1"
        opacity="0.7"
      />

      <rect
        x="15"
        y="1"
        width="4"
        height="17"
        rx="1"
      />
    </svg>
  );
}

function Spinner({
  small = false,
}: {
  small?: boolean;
}) {
  return (
    <div
      className={`animate-spin rounded-full border border-[#40391F] border-t-[#C9A84C] ${
        small ? "h-3 w-3" : "h-5 w-5"
      }`}
    />
  );
    }
