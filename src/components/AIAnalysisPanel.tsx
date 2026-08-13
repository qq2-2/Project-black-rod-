"use client";

import { useState } from "react";

type Verdict = "bullish" | "bearish" | "neutral";

interface KeyLevel {
  label: string;
  price: number;
  type: "support" | "resistance";
}

interface Analysis {
  verdict: Verdict;
  confidence: number;
  headline: string;
  reasoning: string;
  keyLevels: KeyLevel[];
  generatedAt: string;
}

// Placeholder — replaced by Gemini API response in Phase 2
const PLACEHOLDER: Analysis = {
  verdict: "bullish",
  confidence: 72,
  headline: "Gold holds above key support as dollar softens",
  reasoning:
    "XAU/USD is trading above the 2,370 support zone with buyers stepping in on each retest over the last two sessions. Momentum indicators are turning upward from neutral territory, and the pullback in the dollar index is removing a headwind that had been capping gains. Price is approaching the upper boundary of its recent range — a decisive close above 2,391 would likely open room toward the next resistance band around 2,408. A rejection at current levels, however, would suggest the range remains intact and another test of 2,370 support is more likely before any sustained breakout attempt.",
  keyLevels: [
    { label: "Resistance 2", price: 2408.00, type: "resistance" },
    { label: "Resistance 1", price: 2391.10, type: "resistance" },
    { label: "Support 1",    price: 2370.20, type: "support" },
    { label: "Support 2",    price: 2352.75, type: "support" },
  ],
  generatedAt: "2 minutes ago",
};

const VERDICT_STYLES: Record<Verdict, { label: string; bg: string; text: string; border: string; bar: string }> = {
  bullish: {
    label: "Bullish",
    bg: "bg-[#172B21]",
    text: "text-[#30B87A]",
    border: "border-[#30B87A]/25",
    bar: "#30B87A",
  },
  bearish: {
    label: "Bearish",
    bg: "bg-[#2B1719]",
    text: "text-[#E04D53]",
    border: "border-[#E04D53]/25",
    bar: "#E04D53",
  },
  neutral: {
    label: "Neutral",
    bg: "bg-[#1A1D25]",
    text: "text-[#8891A0]",
    border: "border-[#23262F]",
    bar: "#8891A0",
  },
};

export default function AIAnalysisPanel() {
  const [expanded, setExpanded] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const { verdict, confidence, headline, reasoning, keyLevels, generatedAt } = PLACEHOLDER;
  const style = VERDICT_STYLES[verdict];

  function handleRegenerate() {
    setRegenerating(true);
    setTimeout(() => setRegenerating(false), 2000); // Simulated delay
  }

  return (
    <div className="panel flex flex-col">
      {/* Gold accent top stripe */}
      <div className="h-[2px] w-full gold-bar" />

      {/* Panel header */}
      <div className="panel-header">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#555B6B]">
            AI Market Analysis
          </p>
          <p className="text-[15px] font-bold text-[#E4E6EB]">XAU / USD</p>
        </div>
        <div className="flex items-center gap-1.5 rounded-full border border-[#23262F] bg-[#0E1016] px-2.5 py-1">
          <span className="h-1.5 w-1.5 rounded-full bg-[#C9A84C] animate-[live-ping_2s_ease-in-out_infinite]" />
          <span className="font-mono text-[11px] text-[#555B6B]">{generatedAt}</span>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-5 p-4 sm:p-5">

        {/* Verdict + Confidence */}
        <div className="flex items-center justify-between gap-3">
          <span className={`inline-flex items-center rounded-full border px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-widest ${style.bg} ${style.text} ${style.border}`}>
            ● {style.label}
          </span>
          <div className="text-right">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#555B6B]">Confidence</p>
            <p className="font-mono text-2xl font-bold tabular-nums text-[#E4E6EB]">
              {confidence}
              <span className="text-base text-[#555B6B]">%</span>
            </p>
          </div>
        </div>

        {/* Confidence bar */}
        <div className="-mt-3 h-1 w-full overflow-hidden rounded-full bg-[#1A1D25]">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${confidence}%`,
              background: `linear-gradient(90deg, ${style.bar}60, ${style.bar})`,
            }}
          />
        </div>

        {/* Headline */}
        <h3 className="text-[15px] font-semibold leading-snug text-[#E4E6EB]">
          {headline}
        </h3>

        <div className="h-px bg-[#23262F]" />

        {/* Reasoning */}
        <div>
          <p className={`text-[13px] leading-[1.7] text-[#8891A0] transition-all ${expanded ? "" : "line-clamp-3"}`}>
            {reasoning}
          </p>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="mt-2 inline-flex items-center gap-1 text-[12px] font-semibold text-[#C9A84C] transition-colors hover:text-[#E5C96A]"
          >
            {expanded ? (
              <>Show less <ChevronUp /></>
            ) : (
              <>Read full analysis <ChevronDown /></>
            )}
          </button>
        </div>

        <div className="h-px bg-[#23262F]" />

        {/* Key Levels */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#555B6B]">
            Key Levels
          </p>
          <ul className="mt-2.5 space-y-0">
            {keyLevels.map((level) => (
              <li
                key={level.label}
                className="flex items-center justify-between border-b border-[#1A1D25] py-2.5 last:border-0"
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      level.type === "resistance" ? "bg-[#E04D53]" : "bg-[#30B87A]"
                    }`}
                  />
                  <span className="text-[13px] text-[#8891A0]">{level.label}</span>
                  <span className={`rounded text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 ${
                    level.type === "resistance"
                      ? "bg-[#2B1719] text-[#E04D53]"
                      : "bg-[#172B21] text-[#30B87A]"
                  }`}>
                    {level.type === "resistance" ? "R" : "S"}
                  </span>
                </div>
                <span className="font-mono text-[13px] font-bold tabular-nums text-[#E4E6EB]">
                  ${level.price.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Regenerate */}
        <div className="mt-auto space-y-3 pt-2">
          <button
            onClick={handleRegenerate}
            disabled={regenerating}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#23262F] bg-[#1A1D25] px-4 py-3 text-[13px] font-semibold text-[#8891A0] transition-all hover:border-[#C9A84C]/35 hover:bg-[#1E2229] hover:text-[#C9A84C] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshIcon spinning={regenerating} />
            {regenerating ? "Regenerating…" : "Regenerate Analysis"}
          </button>

          <p className="text-center text-[11px] leading-relaxed text-[#555B6B]">
            AI-generated for informational purposes only · Not financial advice
          </p>
        </div>

      </div>
    </div>
  );
}

// ── Icons ──────────────────────────────────────────────────────────────────

function ChevronDown() {
  return (
    <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none">
      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronUp() {
  return (
    <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none">
      <path d="M4 10l4-4 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function RefreshIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`h-4 w-4 ${spinning ? "animate-spin" : ""}`}
      fill="none"
    >
      <path
        d="M4 4v5h5M20 20v-5h-5M4.5 15A8 8 0 0 0 19.4 17.5M19.5 9A8 8 0 0 0 4.6 6.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
