interface NewsItem {
  id: string;
  tag: string;
  headline: string;
  snippet: string;
  source: string;
  time: string;
}

// Placeholder — replaced by News API response in Phase 2
const NEWS_ITEMS: NewsItem[] = [
  {
    id: "1",
    tag: "Fed Policy",
    headline: "Gold steadies near two-week high ahead of Fed minutes release",
    snippet:
      "Bullion held firm in early trading as investors positioned ahead of this week's Federal Reserve minutes, looking for clues on the pace of future rate adjustments.",
    source: "MarketPulse Wire",
    time: "18 min ago",
  },
  {
    id: "2",
    tag: "Currencies",
    headline: "Dollar index slips to three-week low, lending broad support to gold",
    snippet:
      "A broad pullback in the greenback against major peers has removed a key headwind for dollar-denominated metals, with bullion the primary beneficiary.",
    source: "Global FX Desk",
    time: "51 min ago",
  },
  {
    id: "3",
    tag: "Central Banks",
    headline: "Central bank gold buying pace remained elevated last quarter",
    snippet:
      "Official sector purchases continued at an elevated clip according to newly compiled reserve data, extending a multi-year accumulation trend among emerging market central banks.",
    source: "Reserve Watch",
    time: "2 hr ago",
  },
  {
    id: "4",
    tag: "Geopolitics",
    headline: "Safe-haven flows tick higher amid renewed geopolitical uncertainty",
    snippet:
      "Escalating tensions over the weekend nudged investors back toward traditional havens, though flows remain modest compared to prior episodes of acute risk aversion.",
    source: "Geopolitical Brief",
    time: "3 hr ago",
  },
  {
    id: "5",
    tag: "Physical Demand",
    headline: "Asian physical gold demand picks up on recent price dip",
    snippet:
      "Retail and jewellery buyers in key Asian markets stepped in during the recent pullback, according to regional dealer surveys and import data.",
    source: "Bullion Desk Asia",
    time: "5 hr ago",
  },
  {
    id: "6",
    tag: "ETF Flows",
    headline: "Gold-backed ETF holdings post first weekly inflow in five weeks",
    snippet:
      "Total known ETF holdings rose by 4.2 tonnes last week, snapping a run of outflows as renewed institutional interest lifted the market.",
    source: "Metals Intelligence",
    time: "7 hr ago",
  },
];

const TAG_COLORS: Record<string, { bg: string; text: string }> = {
  "Fed Policy":       { bg: "bg-[#1A2340]", text: "text-[#6B9BF0]" },
  "Currencies":       { bg: "bg-[#1A2A22]", text: "text-[#30B87A]" },
  "Central Banks":    { bg: "bg-[#2A1D3A]", text: "text-[#A47DE0]" },
  "Geopolitics":      { bg: "bg-[#2B1A1A]", text: "text-[#E04D53]" },
  "Physical Demand":  { bg: "bg-[#2A2210]", text: "text-[#C9A84C]" },
  "ETF Flows":        { bg: "bg-[#1A2635]", text: "text-[#45B8D8]" },
};

function getTagStyle(tag: string) {
  return TAG_COLORS[tag] ?? { bg: "bg-[#1A1D25]", text: "text-[#8891A0]" };
}

export default function NewsFeed() {
  return (
    <div className="panel">

      {/* Section header */}
      <div className="panel-header">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#555B6B]">
            Market News
          </p>
          <p className="text-[15px] font-bold text-[#E4E6EB]">Gold &amp; Macro Headlines</p>
        </div>
        <span className="rounded-full border border-[#23262F] bg-[#0E1016] px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-[#555B6B]">
          {NEWS_ITEMS.length} stories
        </span>
      </div>

      {/* News grid */}
      <div className="grid grid-cols-1 divide-y divide-[#23262F] sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-3">
        {NEWS_ITEMS.map((item, i) => {
          const tagStyle = getTagStyle(item.tag);
          // Draw inner borders on the grid so every cell is separated
          const showRightBorder = (i + 1) % 2 !== 0 && i < NEWS_ITEMS.length - 1;
          const showLgRightBorder = (i + 1) % 3 !== 0 && i < NEWS_ITEMS.length - 1;

          return (
            <a
              key={item.id}
              href="#"
              className={`group flex flex-col gap-3 p-4 transition-colors hover:bg-[#0E1016] sm:p-5
                ${showRightBorder ? "sm:border-r sm:border-[#23262F]" : ""}
                ${showLgRightBorder ? "lg:border-r lg:border-[#23262F]" : "lg:border-r-0"}
                ${i < NEWS_ITEMS.length - 2 ? "lg:border-b lg:border-[#23262F]" : ""}
              `}
            >
              {/* Tag + Time */}
              <div className="flex items-center justify-between gap-2">
                <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${tagStyle.bg} ${tagStyle.text}`}>
                  {item.tag}
                </span>
                <span className="font-mono text-[11px] text-[#555B6B] shrink-0">{item.time}</span>
              </div>

              {/* Headline */}
              <h3 className="text-[13.5px] font-semibold leading-snug text-[#C8CCD5] transition-colors group-hover:text-[#E4E6EB]">
                {item.headline}
              </h3>

              {/* Snippet */}
              <p className="line-clamp-2 text-[12.5px] leading-relaxed text-[#555B6B]">
                {item.snippet}
              </p>

              {/* Source */}
              <div className="mt-auto flex items-center gap-1.5 pt-1">
                <div className="h-1 w-1 rounded-full bg-[#C9A84C]" />
                <span className="text-[11px] font-medium text-[#555B6B]">{item.source}</span>
              </div>
            </a>
          );
        })}
      </div>

    </div>
  );
}
