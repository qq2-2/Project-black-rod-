"use client";

import { useEffect, useState } from "react";

interface KeyLevel {
  label: string;
  price: number;
  type: "support" | "resistance";
}

interface Analysis {
  verdict: "bullish" | "bearish" | "neutral";
  confidence: number;
  headline: string;
  reasoning: string;
  keyLevels: KeyLevel[];
  generatedAt: string;
}

export default function AIAnalysisPanel() {
  const [analysis, setAnalysis] = useState<Analysis | null>(null);

  useEffect(() => {
    async function fetchAnalysis() {
      try {
        const res = await fetch("/api/analyze");
        const json = await res.json();
        setAnalysis(json);
      } catch (error) {
        console.error("Failed to load analysis", error);
      }
    }

    fetchAnalysis();
  }, []);

  if (!analysis) {
    return (
      <div className="panel p-6 text-[#8891A0]">
        Generating AI analysis...
      </div>
    );
  }

  const verdictColor =
    analysis.verdict === "bullish"
      ? "text-green-400"
      : analysis.verdict === "bearish"
      ? "text-red-400"
      : "text-yellow-400";

  return (
    <div className="panel p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[#E5E7EB]">
          AI market analysis
        </h2>
        <span className="text-xs text-[#8891A0]">
          Gemini
        </span>
      </div>

      <div className="space-y-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-[#8891A0]">
            Bias
          </p>
          <p className={`text-xl font-bold ${verdictColor}`}>
            {analysis.verdict.toUpperCase()}
          </p>
        </div>

        <div>
          <p className="text-xs uppercase tracking-wide text-[#8891A0]">
            Confidence
          </p>
          <p className="text-[#E5E7EB]">
            {analysis.confidence}%
          </p>
        </div>

        <div>
          <p className="text-xs uppercase tracking-wide text-[#8891A0]">
            Headline
          </p>
          <p className="font-semibold text-[#E5E7EB]">
            {analysis.headline}
          </p>
        </div>

        <div>
          <p className="text-xs uppercase tracking-wide text-[#8891A0]">
            Reasoning
          </p>
          <p className="text-sm leading-6 text-[#C7CDD6]">
            {analysis.reasoning}
          </p>
        </div>

        <div>
          <p className="mb-2 text-xs uppercase tracking-wide text-[#8891A0]">
            Key levels
          </p>
          <div className="space-y-2">
            {analysis.keyLevels.map((level) => (
              <div
                key={level.label}
                className="flex items-center justify-between rounded-lg border border-[#23262F] p-3"
              >
                <span className="text-[#E5E7EB]">
                  {level.label}
                </span>
                <span
                  className={
                    level.type === "support"
                      ? "text-green-400"
                      : "text-red-400"
                  }
                >
                  {level.price}
                </span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-[#6B7280]">
          Updated: {analysis.generatedAt}
        </p>
      </div>
    </div>
  );
                  }
