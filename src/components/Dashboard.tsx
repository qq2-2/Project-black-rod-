"use client";

import { useState } from "react";
import PriceHeader from "@/components/PriceHeader";
import TradingViewChart from "@/components/TradingViewChart";
import AIAnalysisPanel from "@/components/AIAnalysisPanel";
import NewsFeed from "@/components/NewsFeed";

type Tab = "chart" | "analysis" | "news";

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  {
    id: "chart",
    label: "Chart",
    icon: (
      <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none">
        <path d="M2 14l4-5 4 3 4-7 4 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: "analysis",
    label: "AI Analysis",
    icon: (
      <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none">
        <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.8" />
        <path d="M10 7v4M10 13v.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "news",
    label: "News",
    icon: (
      <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none">
        <rect x="2" y="3" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.8" />
        <path d="M6 7h8M6 10h8M6 13h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
  },
];

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<Tab>("chart");

  return (
    <div className="mx-auto max-w-screen-xl px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8">

      {/* Price header — always visible */}
      <PriceHeader />

      {/* ── MOBILE layout ────────────────────────────────────── */}
      <div className="mt-4 lg:hidden">

        {/* Tab switcher */}
        <nav
          role="tablist"
          aria-label="Dashboard sections"
          className="grid grid-cols-3 gap-1 rounded-xl border border-[#23262F] bg-[#13151B] p-1"
        >
          {TABS.map((tab) => {
            const isActive = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center justify-center gap-2 rounded-lg py-2.5 text-[12px] font-semibold transition-all ${
                  isActive
                    ? "bg-[#1E2229] text-[#E5C96A] shadow-sm ring-1 ring-[#C9A84C]/25"
                    : "text-[#555B6B] hover:text-[#8891A0]"
                }`}
              >
                <span className={isActive ? "text-[#C9A84C]" : ""}>{tab.icon}</span>
                <span className="hidden xs:inline sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Active tab content */}
        <div className="mt-4">
          {activeTab === "chart"    && <TradingViewChart />}
          {activeTab === "analysis" && <AIAnalysisPanel />}
          {activeTab === "news"     && <NewsFeed />}
        </div>
      </div>

      {/* ── DESKTOP layout ───────────────────────────────────── */}
      <div className="mt-6 hidden lg:block">

        {/* Chart + AI panel side by side */}
        <div className="grid grid-cols-[1fr_380px] gap-5 xl:grid-cols-[1fr_400px]">
          <TradingViewChart />
          <AIAnalysisPanel />
        </div>

        {/* News below */}
        <div className="mt-5">
          <NewsFeed />
        </div>

      </div>

    </div>
  );
}
