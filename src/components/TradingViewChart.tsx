"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const TIMEFRAMES = ["5m", "15m", "1H"] as const;

const INTERVAL_MAP = {
  "5m": "5min",
  "15m": "15min",
  "1H": "1h",
};

const POLL_MS = 60_000;

type Timeframe = (typeof TIMEFRAMES)[number];

type Candle = {
  datetime: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number | null;
};

type ApiResponse = {
  candles?: Candle[];
  data?: Candle[];
  values?: Candle[];
  error?: string;
  message?: string;
};

export default function TradingViewChart() {
  const [timeframe, setTimeframe] = useState<Timeframe>("15m");
  const [candles, setCandles] = useState<Candle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCandles = useCallback(async () => {
    try {
      setError(null);

      const res = await fetch(
        `/api/candles?interval=${INTERVAL_MAP[timeframe]}`,
        { cache: "no-store" }
      );

      const json: ApiResponse = await res.json();

      if (!res.ok || json.error) {
        throw new Error(
          json.error ||
            json.message ||
            `Market data request failed (${res.status})`
        );
      }

      const raw = json.candles || json.data || json.values || [];

      if (!raw.length) {
        throw new Error("No candle data was returned.");
      }

      const normalized = raw
        .map((c: any) => ({
          datetime: String(
            c.datetime ?? c.date ?? c.time ?? c.timestamp ?? ""
          ),
          open: Number(c.open ?? c.o),
          high: Number(c.high ?? c.h),
          low: Number(c.low ?? c.l),
          close: Number(c.close ?? c.c),
          volume:
            c.volume != null ? Number(c.volume) : null,
        }))
        .filter(
          (c) =>
            c.datetime &&
            Number.isFinite(c.open) &&
            Number.isFinite(c.high) &&
            Number.isFinite(c.low) &&
            Number.isFinite(c.close)
        );

      if (!normalized.length) {
        throw new Error("Invalid candle data returned.");
      }

      normalized.sort(
        (a, b) =>
          new Date(a.datetime).getTime() -
          new Date(b.datetime).getTime()
      );

      setCandles(normalized);
    } catch (err) {
      console.error("TradingViewChart:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load market data."
      );
    } finally {
      setLoading(false);
    }
  }, [timeframe]);

  useEffect(() => {
    setLoading(true);
    fetchCandles();
  }, [fetchCandles]);

  useEffect(() => {
    const id = window.setInterval(fetchCandles, POLL_MS);
    return () => window.clearInterval(id);
  }, [fetchCandles]);

  const visible = useMemo(
    () => candles.slice(-60),
    [candles]
  );

  const latest = candles[candles.length - 1];

  const chart = useMemo(() => {
    if (!visible.length) return null;

    const W = 750;
    const H = 380;
    const PX = 24;
    const PY = 24;

    const max = Math.max(...visible.map((c) => c.high));
    const min = Math.min(...visible.map((c) => c.low));
    const range = max - min || 1;

    const step =
      visible.length > 1
        ? (W - PX * 2) / (visible.length - 1)
        : W - PX * 2;

    const y = (price: number) =>
      PY + ((max - price) / range) * (H - PY * 2);

    const x = (i: number) =>
      visible.length === 1
        ? W / 2
        : PX + i * step;

    const points = visible
      .map((c, i) => `${x(i)},${y(c.close)}`)
      .join(" ");

    const area = [
      `${PX},${H - PY}`,
      ...visible.map(
        (c, i) => `${x(i)},${y(c.close)}`
      ),
      `${W - PX},${H - PY}`,
    ].join(" ");

    const candles = visible.map((c, i) => ({
      x: x(i),
      high: y(c.high),
      low: y(c.low),
      top: y(Math.max(c.open, c.close)),
      height: Math.max(
        2,
        y(Math.min(c.open, c.close)) -
          y(Math.max(c.open, c.close))
      ),
      width: Math.max(
        3,
        Math.min(12, step * 0.55)
      ),
      bullish: c.close >= c.open,
    }));

    return { points, area, candles };
  }, [visible]);

  const price = (n?: number) =>
    n == null || !Number.isFinite(n)
      ? "—"
      : n.toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });

  return (
    <div
      className="panel flex flex-col"
      style={{ minHeight: "clamp(300px, 48vh, 560px)" }}
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

          <div className="flex gap-0.5 rounded-lg border border-[#23262F] bg-[#0E1016] p-0.5">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf}
                type="button"
                onClick={() => setTimeframe(tf)}
                className={`rounded-md px-2.5 py-1 font-mono text-[11px] font-semibold ${
                  timeframe === tf
                    ? "bg-[#1E2229] text-[#E5C96A]"
                    : "text-[#555B6B] hover:text-[#8891A0]"
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>

        <span
          className={`rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider ${
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

      {/* Chart */}
      <div className="relative flex flex-1 overflow-hidden">
        {chart ? (
          <svg
            className="absolute inset-0 h-full w-full"
            viewBox="0 0 750 380"
            preserveAspectRatio="none"
            aria-label={`XAU/USD ${timeframe} price chart`}
          >
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <line
                key={`h${i}`}
                x1="0"
                y1={i * 63.3}
                x2="750"
                y2={i * 63.3}
                stroke="#1E2229"
              />
            ))}

            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(
              (i) => (
                <line
                  key={`v${i}`}
                  x1={i * 83.33}
                  y1="0"
                  x2={i * 83.33}
                  y2="380"
                  stroke="#1E2229"
                />
              )
            )}

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

            <polygon
              points={chart.area}
              fill="url(#areaGrad)"
            />

            <polyline
              points={chart.points}
              fill="none"
              stroke="#C9A84C"
              strokeWidth="1.5"
              opacity="0.75"
            />

            {chart.candles.map((c, i) => {
              const color = c.bullish
                ? "#30B87A"
                : "#E04D53";

              return (
                <g key={i}>
                  <line
                    x1={c.x}
                    y1={c.high}
                    x2={c.x}
                    y2={c.low}
                    stroke={color}
                  />

                  <rect
                    x={c.x - c.width / 2}
                    y={c.top}
                    width={c.width}
                    height={c.height}
                    fill={color}
                    rx="1"
                  />
                </g>
              );
            })}
          </svg>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="rounded-xl border border-[#23262F] bg-[#09090C]/90 px-6 py-5 text-center">
              <div className="mb-3 flex justify-center">
                {loading ? <Spinner /> : <ChartIcon />}
              </div>

              <p className="text-sm font-semibold text-[#E4E6EB]">
                {loading
                  ? `Loading XAU/USD ${timeframe}`
                  : "Market data unavailable"}
              </p>

              <p className="mt-1 text-xs text-[#555B6B]">
                {error || "Fetching real market candles."}
              </p>

              {!loading && (
                <button
                  type="button"
                  onClick={() => {
                    setLoading(true);
                    fetchCandles();
                  }}
                  className="mt-3 rounded-md border border-[#40391F] bg-[#17150D] px-3 py-1.5 font-mono text-[10px] text-[#C9A84C]"
                >
                  Retry
                </button>
              )}
            </div>
          </div>
        )}

        {loading && candles.length > 0 && (
          <div className="absolute right-4 top-4 rounded-full border border-[#23262F] bg-[#09090C]/85 px-2.5 py-1.5">
            <span className="font-mono text-[9px] text-[#555B6B]">
              Updating
            </span>
          </div>
        )}
      </div>

      {/* Status */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#23262F] px-4 py-2 sm:px-5">
        <div className="flex gap-4 font-mono text-[11px]">
          <span>
            <span className="text-[#555B6B]">O </span>
            <span className="text-[#8891A0]">
              {price(latest?.open)}
            </span>
          </span>

          <span>
            <span className="text-[#555B6B]">H </span>
            <span className="text-[#8891A0]">
              {price(latest?.high)}
            </span>
          </span>

          <span>
            <span className="text-[#555B6B]">L </span>
            <span className="text-[#8891A0]">
              {price(latest?.low)}
            </span>
          </span>

          <span>
            <span className="text-[#555B6B]">C </span>
            <span className="text-[#8891A0]">
              {price(latest?.close)}
            </span>
          </span>
        </div>

        <span className="font-mono text-[11px] text-[#555B6B]">
          {timeframe}
        </span>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <div className="h-5 w-5 animate-spin rounded-full border border-[#40391F] border-t-[#C9A84C]" />
  );
}

function ChartIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      className="h-5 w-5 text-[#C9A84C]"
      fill="currentColor"
    >
      <rect x="1" y="6" width="4" height="12" rx="1" />
      <rect x="8" y="3" width="4" height="15" rx="1" />
      <rect x="15" y="1" width="4" height="17" rx="1" />
    </svg>
  );
}
