"use client";

import { useEffect, useState } from "react";

interface PriceData {
  price: number;
  change: number;
  changePct: number;
  dayHigh: number;
  dayLow: number;
  weekHigh: number;
  weekLow: number;
  spread: string;
}

export default function PriceHeader() {
  const [data, setData] = useState<PriceData | null>(null);

  useEffect(() => {
    async function fetchPrice() {
      try {
        const res = await fetch("/api/price");
        const json = await res.json();

        setData({
          price: Number(json.close || 0),
          change: Number(json.change || 0),
          changePct: Number(json.percent_change || 0),
          dayHigh: Number(json.high || 0),
          dayLow: Number(json.low || 0),
          weekHigh: Number(json.high || 0),
          weekLow: Number(json.low || 0),
          spread: "0.00",
        });
      } catch (error) {
        console.error("Failed to load price", error);
      }
    }

    fetchPrice();
  }, []);

  if (!data) {
    return <div className="panel p-6 text-[#8891A0]">Loading price...</div>;
  }

  const { price, change, changePct, dayHigh, dayLow, weekHigh, weekLow, spread } = data;
  const isUp = change >= 0;
  const changeColor = isUp ? "text-[#30B87A]" : "text-[#E04D53]";
  const sign = isUp ? "+" : "";

  return (
    <div className="panel">
      <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">

        <div>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#30B87A] opacity-50" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#30B87A]" />
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-widest text-[#555B6B]">
              Gold Spot · XAU/USD · Live
            </span>
          </div>

          <div className="mt-1.5 flex flex-wrap items-baseline gap-3">
            <span className="font-mono text-[2.5rem] font-bold leading-none tabular-nums text-[#E4E6EB] sm:text-[3.25rem]">
              ${price.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>

            <div className={\`flex items-baseline gap-1.5 font-mono text-sm font-semibold tabular-nums ${changeColor}\`}>
              <span>
                {sign}
                {change.toFixed(2)}
              </span>
              <span className="text-xs opacity-80">
                ({sign}
                {changePct.toFixed(2)}%)
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-4 sm:gap-x-8">
          <Stat label="Day High" value={dayHigh} />
          <Stat label="Day Low" value={dayLow} />
          <Stat label="52W High" value={weekHigh} />
          <Stat label="52W Low" value={weekLow} />
        </div>

      </div>

      <div className="flex items-center justify-between border-t border-[#23262F] px-4 py-2 sm:px-6">
        <span className="font-mono text-[11px] text-[#555B6B]">
          Spread: <span className="text-[#8891A0]">{spread}</span>
        </span>
        <span className="font-mono text-[11px] text-[#555B6B]">
          Unit: <span className="text-[#8891A0]">Troy oz · USD</span>
        </span>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-[#555B6B]">
        {label}
      </p>
      <p className="font-mono text-[13px] font-semibold tabular-nums text-[#8891A0]">
        ${value.toLocaleString("en-US", {
          minimumFractionDigits: 2,
        })}
      </p>
    </div>
  );
         }      
