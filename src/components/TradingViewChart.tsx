"use client";

import { useState } from "react";

const TIMEFRAMES = ["15m", "1H", "4H", "1D", "1W", "1M"];
const DEFAULT_TF = "4H";

// Decorative placeholder candle data — gives the container a realistic feel
const MOCK_CANDLES = [
  { o: 320, h: 295, l: 330, c: 300 },
  { o: 300, h: 278, l: 308, c: 282 },
  { o: 282, h: 260, l: 290, c: 268 },
  { o: 268, h: 250, l: 275, c: 255 },
  { o: 255, h: 238, l: 262, c: 244 },
  { o: 244, h: 225, l: 250, c: 228 },
  { o: 228, h: 210, l: 235, c: 215 },
  { o: 215, h: 200, l: 225, c: 205 },
  { o: 205, h: 195, l: 215, c: 200 },
  { o: 200, h: 185, l: 210, c: 190 },
  { o: 190, h: 175, l: 200, c: 182 },
  { o: 182, h: 165, l: 190, c: 170 },
  { o: 170, h: 158, l: 178, c: 162 },
  { o: 162, h: 152, l: 172, c: 158 },
  { o: 158, h: 148, l: 165, c: 152 },
];

export default function TradingViewChart() {
  const [activeTimeframe, setActiveTimeframe] = useState(DEFAULT_TF);

  return (
    <div className="panel flex flex-col" style={{ minHeight: "clamp(300px, 48vh, 560px)" }}>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#23262F] px-4 py-2.5 sm:px-5">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-xs font-bold text-[#E4E6EB]">XAU</span>
            <span className="text-[#555B6B]">/</span>
            <span className="font-mono text-xs font-bold text-[#8891A0]">USD</span>
          </div>

          {/* Timeframe selector */}
          <div className="flex gap-0.5 rounded-lg border border-[#23262F] bg-[#0E1016] p-0.5">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf}
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
          <span className="rounded-full border border-[#23262F] bg-[#0E1016] px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-wider text-[#555B6B]">
            Phase 2 · TradingView
          </span>
        </div>
      </div>

      {/* Chart body */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden">

        {/* Decorative background chart */}
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 750 380"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {/* Horizontal grid */}
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <line
              key={`h${i}`}
              x1="0" y1={i * 63} x2="750" y2={i * 63}
              stroke="#1E2229" strokeWidth="1"
            />
          ))}
          {/* Vertical grid */}
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
            <line
              key={`v${i}`}
              x1={i * 83} y1="0" x2={i * 83} y2="380"
              stroke="#1E2229" strokeWidth="1"
            />
          ))}

          {/* Area fill */}
          <defs>
            <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#C9A84C" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#C9A84C" stopOpacity="0" />
            </linearGradient>
          </defs>
          <polygon
            points="0,320 50,295 100,310 150,265 200,278 250,230 300,248 350,205 400,220 450,185 500,200 550,165 600,178 650,148 700,160 750,138 750,380 0,380"
            fill="url(#areaGrad)"
          />
          {/* Price line */}
          <polyline
            points="0,320 50,295 100,310 150,265 200,278 250,230 300,248 350,205 400,220 450,185 500,200 550,165 600,178 650,148 700,160 750,138"
            fill="none"
            stroke="#C9A84C"
            strokeWidth="2"
            strokeLinejoin="round"
          />

          {/* Placeholder candles */}
          {MOCK_CANDLES.map((c, i) => {
            const x = 30 + i * 47;
            const isGreen = c.c < c.o;
            const color = isGreen ? "#30B87A" : "#E04D53";
            const bodyTop = Math.min(c.o, c.c);
            const bodyH = Math.abs(c.o - c.c);
            return (
              <g key={i} opacity="0.45">
                <line x1={x + 8} y1={c.h} x2={x + 8} y2={c.l} stroke={color} strokeWidth="1.2" />
                <rect x={x} y={bodyTop} width="16" height={Math.max(bodyH, 2)} fill={color} rx="1" />
              </g>
            );
          })}
        </svg>

        {/* Center overlay */}
        <div className="relative z-10 flex flex-col items-center gap-3 rounded-xl border border-[#23262F] bg-[#09090C]/85 px-6 py-5 text-center backdrop-blur-sm">
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#23262F] bg-[#13151B]">
            <ChartIcon />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#E4E6EB]">TradingView Widget</p>
            <p className="mt-0.5 text-xs text-[#555B6B]">Mounts here in Phase 2</p>
          </div>
        </div>

      </div>

      {/* Bottom status bar */}
      <div className="flex items-center justify-between border-t border-[#23262F] px-4 py-2 sm:px-5">
        <div className="flex items-center gap-4">
          {[
            { label: "O", value: "2,371.80" },
            { label: "H", value: "2,391.10" },
            { label: "L", value: "2,368.40" },
            { label: "C", value: "2,384.52" },
          ].map(({ label, value }) => (
            <span key={label} className="font-mono text-[11px]">
              <span className="text-[#555B6B]">{label} </span>
              <span className="text-[#8891A0]">{value}</span>
            </span>
          ))}
        </div>
        <span className="font-mono text-[11px] text-[#555B6B]">{activeTimeframe} · Placeholder</span>
      </div>

    </div>
  );
}

function ChartIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-5 w-5 text-[#C9A84C]" fill="currentColor">
      <rect x="1" y="6" width="4" height="12" rx="1" opacity="0.5" />
      <rect x="8" y="3" width="4" height="15" rx="1" opacity="0.7" />
      <rect x="15" y="1" width="4" height="17" rx="1" />
    </svg>
  );
}
