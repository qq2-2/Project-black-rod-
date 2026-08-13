// Placeholder values — will be replaced by live API data in Phase 2
const PRICE_DATA = {
  price: 2384.52,
  change: 12.85,
  changePct: 0.54,
  dayHigh: 2391.10,
  dayLow: 2368.40,
  weekHigh: 2431.00,
  weekLow: 2285.20,
  spread: "0.28",
};

export default function PriceHeader() {
  const { price, change, changePct, dayHigh, dayLow, weekHigh, weekLow, spread } = PRICE_DATA;
  const isUp = change >= 0;
  const changeColor = isUp ? "text-[#30B87A]" : "text-[#E04D53]";
  const sign = isUp ? "+" : "";

  return (
    <div className="panel">
      <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">

        {/* Left — main price block */}
        <div>
          {/* Instrument label */}
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#30B87A] opacity-50 [animation-duration:2s]" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#30B87A]" />
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-widest text-[#555B6B]">
              Gold Spot · XAU/USD · Live
            </span>
          </div>

          {/* Price */}
          <div className="mt-1.5 flex flex-wrap items-baseline gap-3">
            <span className="font-mono text-[2.5rem] font-bold leading-none tabular-nums text-[#E4E6EB] sm:text-[3.25rem]">
              ${price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <div className={`flex items-baseline gap-1.5 font-mono text-sm font-semibold tabular-nums ${changeColor}`}>
              <span>{sign}{change.toFixed(2)}</span>
              <span className="text-xs opacity-80">
                ({sign}{changePct.toFixed(2)}%)
              </span>
            </div>
          </div>
        </div>

        {/* Right — stat grid */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-4 sm:gap-x-8">
          <Stat label="Day High" value={dayHigh} />
          <Stat label="Day Low" value={dayLow} />
          <Stat label="52W High" value={weekHigh} />
          <Stat label="52W Low" value={weekLow} />
        </div>

      </div>

      {/* Bottom bar — spread + unit */}
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
        ${value.toLocaleString("en-US", { minimumFractionDigits: 2 })}
      </p>
    </div>
  );
}
