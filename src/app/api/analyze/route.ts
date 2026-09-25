
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const GEMINI_MODEL = "gemini-3.8-flash";
const MIN_RISK_REWARD = 3.5;

const FALLBACK_ANALYSIS = {
  verdict: "neutral",
  confidence: 0,
  headline: "AI analysis unavailable",
  reasoning:
    "The Gemini analysis service is currently unavailable. Please try again shortly.",
  keyLevels: [],
  tradePlan: {
    currentPrice: null,
    dailyContext: "Unavailable",
    fourHourContext: "Unavailable",
    oneHourBias: "NEUTRAL",
    fifteenMinuteStructure: "Unavailable",
    fiveMinuteStatus: "Unavailable",
    marketCondition: "Unclear",
    liquidityTarget: null,
    bestAction: "NO TRADE",
    entry: null,
    stopLoss: null,
    tp1: null,
    tp2: null,
    tp3: null,
    riskReward: null,
    confirmationRequired: "Wait for fresh market data and confirmation.",
    invalidation: "No valid setup.",
  },
  generatedAt: new Date().toISOString(),
};

const TIMEFRAMES = [
  { label: "1D", interval: "1day", outputsize: 500 },
  { label: "4H", interval: "4h", outputsize: 800 },
  { label: "1H", interval: "1h", outputsize: 950 },
  { label: "15M", interval: "15min", outputsize: 1200 },
  { label: "5M", interval: "5min", outputsize: 1550 },
] as const;

type Candle = {
  datetime: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
};

type MarketDataSet = {
  timeframe: string;
  interval: string;
  count: number;
  candles: Candle[];
};

type KeyLevel = {
  label: string;
  price: number;
  type: "support" | "resistance";
};

type TradePlan = {
  currentPrice: number | null;
  dailyContext: string;
  fourHourContext: string;
  oneHourBias: string;
  fifteenMinuteStructure: string;
  fiveMinuteStatus: string;
  marketCondition: string;
  liquidityTarget: number | null;
  bestAction: string;
  entry: number | null;
  stopLoss: number | null;
  tp1: number | null;
  tp2: number | null;
  tp3: number | null;
  riskReward: number | null;
  confirmationRequired: string;
  invalidation: string;
};

function roundPrice(value: number | null, decimals = 2): number | null {
  if (value === null || !Number.isFinite(value)) {
    return null;
  }

  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function average(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function getRecentCandles(
  candles: Candle[],
  count: number
): Candle[] {
  return candles.slice(Math.max(0, candles.length - count));
}

function findRecentSwingHigh(
  candles: Candle[],
  lookback = 2
): number | null {
  if (candles.length < lookback * 2 + 1) {
    return null;
  }

  for (
    let i = candles.length - lookback - 1;
    i >= lookback;
    i--
  ) {
    const candidate = candles[i].high;

    let isSwing = true;

    for (let j = 1; j <= lookback; j++) {
      if (
        candidate <= candles[i - j].high ||
        candidate <= candles[i + j].high
      ) {
        isSwing = false;
        break;
      }
    }

    if (isSwing) {
      return candidate;
    }
  }

  return null;
}

function findRecentSwingLow(
  candles: Candle[],
  lookback = 2
): number | null {
  if (candles.length < lookback * 2 + 1) {
    return null;
  }

  for (
    let i = candles.length - lookback - 1;
    i >= lookback;
    i--
  ) {
    const candidate = candles[i].low;

    let isSwing = true;

    for (let j = 1; j <= lookback; j++) {
      if (
        candidate >= candles[i - j].low ||
        candidate >= candles[i + j].low
      ) {
        isSwing = false;
        break;
      }
    }

    if (isSwing) {
      return candidate;
    }
  }

  return null;
}

function findFvgCandidates(
  candles: Candle[],
  maxResults = 12
) {
  const results: Array<{
    direction: "bullish" | "bearish";
    lower: number;
    upper: number;
    midpoint: number;
    formedAt: string;
    mitigated: boolean;
  }> = [];

  for (let i = 2; i < candles.length; i++) {
    const left = candles[i - 2];
    const middle = candles[i - 1];
    const right = candles[i];

    // Standard 3-candle imbalance candidates.
    if (right.low > left.high) {
      const lower = left.high;
      const upper = right.low;

      const laterCandles = candles.slice(i + 1);
      const mitigated = laterCandles.some(
        (candle) => candle.low <= lower
      );

      results.push({
        direction: "bullish",
        lower: roundPrice(lower) as number,
        upper: roundPrice(upper) as number,
        midpoint: roundPrice((lower + upper) / 2) as number,
        formedAt: middle.datetime,
        mitigated,
      });
    }

    if (right.high < left.low) {
      const lower = right.high;
      const upper = left.low;

      const laterCandles = candles.slice(i + 1);
      const mitigated = laterCandles.some(
        (candle) => candle.high >= upper
      );

      results.push({
        direction: "bearish",
        lower: roundPrice(lower) as number,
        upper: roundPrice(upper) as number,
        midpoint: roundPrice((lower + upper) / 2) as number,
        formedAt: middle.datetime,
        mitigated,
      });
    }
  }

  return results
    .slice(-maxResults)
    .reverse();
}

function findEqualLevels(
  candles: Candle[],
  tolerancePercent = 0.0006,
  maxResults = 8
) {
  const highs: number[] = [];
  const lows: number[] = [];

  for (let i = 2; i < candles.length - 2; i++) {
    const isHigh =
      candles[i].high >= candles[i - 1].high &&
      candles[i].high >= candles[i + 1].high &&
      candles[i].high >= candles[i - 2].high &&
      candles[i].high >= candles[i + 2].high;

    const isLow =
      candles[i].low <= candles[i - 1].low &&
      candles[i].low <= candles[i + 1].low &&
      candles[i].low <= candles[i - 2].low &&
      candles[i].low <= candles[i + 2].low;

    if (isHigh) {
      highs.push(candles[i].high);
    }

    if (isLow) {
      lows.push(candles[i].low);
    }
  }

  const cluster = (values: number[]) => {
    const groups: number[][] = [];

    for (const value of values.slice(-80)) {
      const existing = groups.find((group) => {
        const center =
          group.reduce((sum, item) => sum + item, 0) /
          group.length;

        return (
          Math.abs(value - center) /
            Math.max(Math.abs(center), 1) <=
          tolerancePercent
        );
      });

      if (existing) {
        existing.push(value);
      } else {
        groups.push([value]);
      }
    }

    return groups
      .filter((group) => group.length >= 2)
      .map((group) =>
        roundPrice(
          group.reduce((sum, value) => sum + value, 0) /
            group.length
        )
      )
      .filter((value): value is number => value !== null)
      .slice(-maxResults);
  };

  return {
    equalHighs: cluster(highs),
    equalLows: cluster(lows),
  };
}

function buildDerivedContext(
  marketData: MarketDataSet[]
) {
  const context = marketData.map((dataset) => {
    const candles = dataset.candles;
    const recent = getRecentCandles(candles, 100);
    const latest = candles[candles.length - 1] ?? null;

    const recentHighs = recent.map((candle) => candle.high);
    const recentLows = recent.map((candle) => candle.low);

    const recentHigh =
      recentHighs.length > 0
        ? Math.max(...recentHighs)
        : null;

    const recentLow =
      recentLows.length > 0
        ? Math.min(...recentLows)
        : null;

    const swingHigh = findRecentSwingHigh(recent);
    const swingLow = findRecentSwingLow(recent);
    const equalLevels = findEqualLevels(recent);
    const fvgCandidates = findFvgCandidates(
      candles,
      10
    );

    const ranges = recent.map(
      (candle) => candle.high - candle.low
    );

    const averageRange = average(ranges);

    return {
      timeframe: dataset.timeframe,
      count: dataset.count,
      latestCandle: latest
        ? {
            datetime: latest.datetime,
            open: roundPrice(latest.open),
            high: roundPrice(latest.high),
            low: roundPrice(latest.low),
            close: roundPrice(latest.close),
          }
        : null,
      recent100Range: {
        high: roundPrice(recentHigh),
        low: roundPrice(recentLow),
      },
      recentSwingCandidate: {
        high: roundPrice(swingHigh),
        low: roundPrice(swingLow),
      },
      equalHighCandidates: equalLevels.equalHighs,
      equalLowCandidates: equalLevels.equalLows,
      recentFvgCandidates: fvgCandidates,
      averageRecentCandleRange: roundPrice(
        averageRange
      ),
    };
  });

  const oneDay = marketData.find(
    (dataset) => dataset.timeframe === "1D"
  );
  const latestOneDay =
    oneDay?.candles[oneDay.candles.length - 1] ?? null;

  return {
    currentPrice:
      marketData.find(
        (dataset) => dataset.timeframe === "5M"
      )?.candles[
        marketData.find(
          (dataset) => dataset.timeframe === "5M"
        )!.candles.length - 1
      ]?.close ?? null,
    previousDay: latestOneDay
      ? {
          high: roundPrice(latestOneDay.high),
          low: roundPrice(latestOneDay.low),
          close: roundPrice(latestOneDay.close),
        }
      : null,
    timeframeContext: context,
  };
}

function buildMarketDataText(
  marketData: MarketDataSet[],
  derivedContext: ReturnType<typeof buildDerivedContext>
) {
  // Compact JSON keeps the full 5,000-candle dataset useful without
  // spending tokens on unnecessary indentation.
  return JSON.stringify({
    symbol: "XAU/USD",
    timezone: "UTC",
    candleCounts: marketData.reduce(
      (acc, dataset) => {
        acc[dataset.timeframe] = dataset.count;
        return acc;
      },
      {} as Record<string, number>
    ),
    derivedContext,
    timeframes: marketData,
  });
}

const ANALYSIS_PROMPT = `
Act as a disciplined professional XAU/USD market analyst specializing in ICT (Inner Circle Trader), Smart Money Concepts (SMC), market structure, liquidity, displacement, Fair Value Gaps (FVG/iFVG), order blocks, breakers, premium/discount, and institutional price action.

You are analyzing REAL XAU/USD MARKET DATA supplied by Project Black Rod.

There are NO screenshots.
Do not ask for screenshots.
Do not assume you can see a chart image.
The supplied OHLC candles, timestamps, timeframe labels, and derived objective market-data context are the source of truth.

TIMEFRAME HIERARCHY:
1D = major context
4H = major structure/context
1H = DIRECTION
15M = SETUP
5M = EXECUTION

CORE RULES:
- Analyze ONLY the supplied data.
- Never invent a price, swing, liquidity pool, FVG, order block, breaker, BOS, CHoCH, MSS, displacement, support, resistance, or target.
- Derived context supplied by the application is objective/candidate information, not a guaranteed ICT conclusion. Verify it against the raw candles.
- If something cannot be established from the supplied data, say "INSUFFICIENT DATA TO CONFIRM."
- Do not force a trade.
- Do not chase price.
- Do not enter in the middle of a move.
- Do not assume an FVG will hold.
- Do not assume liquidity has been taken.
- Do not predict a reversal without confirmation.
- 5M must not override clear higher-timeframe structure without strong evidence of a genuine structural shift.
- A setup is NOT valid merely because an FVG or order block exists.
- A setup must have a logical invalidation and a minimum risk/reward of 1:3.5.
- If a valid 1:3.5 or better setup cannot be supported by the supplied data, choose WAIT or NO TRADE.

ENTRY LANGUAGE:
For an executable bullish entry, use "LONG BUY".
For an executable bearish entry, use "SHORT SELL".
Do not label an executable setup simply "LONG" or "SHORT".
"LONG SELL" and "SHORT BUY" are exit/position-management actions, not new entries. Do not use them as entry recommendations.

REQUIRED CONFIRMATION SEQUENCE:

LONG BUY:
liquidity target/area
→ sell-side liquidity sweep
→ bullish displacement
→ bullish 5M MSS/CHoCH
→ bullish FVG/iFVG or relevant OB
→ retracement
→ entry confirmation

SHORT SELL:
liquidity target/area
→ buy-side liquidity sweep
→ bearish displacement
→ bearish 5M MSS/CHoCH
→ bearish FVG/iFVG or relevant OB
→ retracement
→ entry confirmation

If the sequence has not occurred, do not fabricate the missing step. Say:
"NO VALID ENTRY YET — WAIT."

ANALYSIS TASKS:

1. 1D MAJOR CONTEXT
Analyze:
- major trend/structure
- major swing highs/lows
- previous highs/lows
- major liquidity
- premium/discount where supportable
- major FVGs/iFVGs
- major order blocks/breakers where supportable
- major support/resistance

2. 4H STRUCTURE
Analyze:
- external and internal structure
- swing highs/lows
- BOS/CHoCH candidates
- displacement
- liquidity above and below price
- important FVGs
- order blocks/breakers
- relationship to 1D context

3. 1H DIRECTION
This timeframe determines directional bias.
Analyze:
- HH/HL or LH/LL structure
- BOS/CHoCH/MSS
- displacement
- liquidity sweeps
- equal highs/lows
- FVG/iFVG
- OB/breaker
- internal/external liquidity
- relationship to 4H and 1D

Give:
1H BIAS = BULLISH / BEARISH / NEUTRAL

4. 15M SETUP
Determine whether 15M confirms or contradicts the 1H direction.
Analyze:
- liquidity sweep
- BOS/CHoCH/MSS
- displacement
- FVG/iFVG
- OB/breaker
- equal highs/lows
- inducement
- internal/external liquidity

5. 5M EXECUTION
Use 5M ONLY to determine whether an entry confirmation exists.
Explicitly identify which required confirmation steps have happened and which have NOT happened.

6. FVG ANALYSIS
For important FVGs:
- timeframe
- bullish/bearish
- approximate boundaries
- formation
- mitigation status
- relation to liquidity
- relation to market structure
Do not treat every FVG as a trade signal.

7. LIQUIDITY MAP
Identify visible liquidity above and below current price:
- BSL
- SSL
- equal highs/lows
- previous highs/lows
- major pools
Only use levels supportable from the data.

8. TRADE DECISION
Choose exactly one:
- LONG BUY
- SHORT SELL
- WAIT FOR LONG BUY CONFIRMATION
- WAIT FOR SHORT SELL CONFIRMATION
- NO TRADE

A trade action is allowed only when:
- higher-timeframe direction is sufficiently clear,
- the 15M setup supports it,
- the 5M execution sequence has sufficient confirmation,
- entry, stop and target are supported by actual prices,
- calculated risk/reward is at least 1:3.5.

If any of those fail:
WAIT or NO TRADE.

9. ENTRY PLAN
When confirmed, provide:
- exact/approximate entry price or entry zone
- exact confirmation trigger
- stop loss
- TP1
- TP2
- TP3
- risk/reward
- invalidation
- confidence /10

The entry must be actionable and tied to a specific price/action confirmation.
Do not provide vague entries such as "around support."

10. CONDITIONAL PLAN
If no confirmed entry exists:
- LONG BUY IF = exact price/action confirmation required
- SHORT SELL IF = exact price/action confirmation required
- WAIT IF = condition preventing entry

11. DATA QUALITY CHECK
State:
- all supplied timeframes
- candle count for each
- whether candles are chronological
- whether latest candle exists
- whether there is enough history for the requested structure analysis
- any limitations

12. FINAL TRADE PLAN

CURRENT PRICE:
[exact latest supplied price]

1D CONTEXT:
[ ]

4H CONTEXT:
[ ]

1H BIAS:
[ ]

15M STRUCTURE:
[ ]

5M STATUS:
[ ]

MARKET CONDITION:
[TRENDING / RANGING / RETRACEMENT / EXPANSION / MANIPULATION / UNCLEAR]

LIQUIDITY TARGET:
[ ]

BEST ACTION:
[LONG BUY / SHORT SELL / WAIT / NO TRADE]

ENTRY:
[ ]

STOP LOSS:
[ ]

TP1:
[ ]

TP2:
[ ]

TP3:
[ ]

R:R:
[ ]

CONFIRMATION REQUIRED:
[ ]

CONFIDENCE:
[__/10]

INVALIDATION:
[ ]

FINAL RULE:
If the calculated R:R is below 1:3.5, DO NOT recommend the setup.
If no valid 1:3.5+ setup exists, output WAIT or NO TRADE.

Finally answer exactly:
"IF I WERE SITTING IN FRONT OF THIS CHART RIGHT NOW, THE ONE THING I SHOULD WAIT FOR BEFORE ENTERING IS: ______"

Fill the blank with the specific price/action confirmation supported by the supplied data.
`;

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    verdict: {
      type: "STRING",
      enum: ["bullish", "bearish", "neutral"],
    },
    confidence: {
      type: "NUMBER",
    },
    headline: {
      type: "STRING",
    },
    reasoning: {
      type: "STRING",
    },
    keyLevels: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          label: { type: "STRING" },
          price: { type: "NUMBER" },
          type: {
            type: "STRING",
            enum: ["support", "resistance"],
          },
        },
        required: ["label", "price", "type"],
      },
    },
    tradePlan: {
      type: "OBJECT",
      properties: {
        currentPrice: { type: "NUMBER" },
        dailyContext: { type: "STRING" },
        fourHourContext: { type: "STRING" },
        oneHourBias: { type: "STRING" },
        fifteenMinuteStructure: { type: "STRING" },
        fiveMinuteStatus: { type: "STRING" },
        marketCondition: { type: "STRING" },
        liquidityTarget: { type: "NUMBER" },
        bestAction: { type: "STRING" },
        entry: { type: "NUMBER" },
        stopLoss: { type: "NUMBER" },
        tp1: { type: "NUMBER" },
        tp2: { type: "NUMBER" },
        tp3: { type: "NUMBER" },
        riskReward: { type: "NUMBER" },
        confirmationRequired: { type: "STRING" },
        invalidation: { type: "STRING" },
      },
      required: [
        "dailyContext",
        "fourHourContext",
        "oneHourBias",
        "fifteenMinuteStructure",
        "fiveMinuteStatus",
        "marketCondition",
        "bestAction",
        "confirmationRequired",
        "invalidation",
      ],
    },
    generatedAt: {
      type: "STRING",
    },
  },
  required: [
    "verdict",
    "confidence",
    "headline",
    "reasoning",
    "keyLevels",
    "tradePlan",
    "generatedAt",
  ],
};

function sanitizeKeyLevels(value: unknown): KeyLevel[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(
      (level: any) =>
        level &&
        typeof level.label === "string" &&
        Number.isFinite(Number(level.price)) &&
        ["support", "resistance"].includes(level.type)
    )
    .map((level: any) => ({
      label: level.label,
      price: Number(level.price),
      type: level.type,
    }))
    .slice(0, 20);
}

function sanitizeTradePlan(value: any): TradePlan {
  const raw = value ?? {};

  const numberOrNull = (input: unknown) => {
    const number = Number(input);
    return Number.isFinite(number) ? number : null;
  };

  return {
    currentPrice: numberOrNull(raw.currentPrice),
    dailyContext:
      typeof raw.dailyContext === "string"
        ? raw.dailyContext
        : "Unavailable.",
    fourHourContext:
      typeof raw.fourHourContext === "string"
        ? raw.fourHourContext
        : "Unavailable.",
    oneHourBias:
      typeof raw.oneHourBias === "string"
        ? raw.oneHourBias
        : "NEUTRAL",
    fifteenMinuteStructure:
      typeof raw.fifteenMinuteStructure === "string"
        ? raw.fifteenMinuteStructure
        : "Unavailable.",
    fiveMinuteStatus:
      typeof raw.fiveMinuteStatus === "string"
        ? raw.fiveMinuteStatus
        : "Unavailable.",
    marketCondition:
      typeof raw.marketCondition === "string"
        ? raw.marketCondition
        : "Unclear",
    liquidityTarget: numberOrNull(raw.liquidityTarget),
    bestAction:
      typeof raw.bestAction === "string"
        ? raw.bestAction
        : "NO TRADE",
    entry: numberOrNull(raw.entry),
    stopLoss: numberOrNull(raw.stopLoss),
    tp1: numberOrNull(raw.tp1),
    tp2: numberOrNull(raw.tp2),
    tp3: numberOrNull(raw.tp3),
    riskReward: numberOrNull(raw.riskReward),
    confirmationRequired:
      typeof raw.confirmationRequired === "string"
        ? raw.confirmationRequired
        : "Wait for confirmation.",
    invalidation:
      typeof raw.invalidation === "string"
        ? raw.invalidation
        : "No valid setup.",
  };
}

function enforceRiskReward(
  tradePlan: TradePlan
): TradePlan {
  const action = tradePlan.bestAction.toUpperCase();

  const isTrade =
    action === "LONG BUY" ||
    action === "SHORT SELL";

  if (!isTrade) {
    return tradePlan;
  }

  if (
    tradePlan.entry === null ||
    tradePlan.stopLoss === null ||
    tradePlan.tp1 === null
  ) {
    return {
      ...tradePlan,
      bestAction: "NO TRADE",
      riskReward: null,
      confirmationRequired:
        "A complete entry, stop loss, and TP1 were not supplied. No trade.",
    };
  }

  const risk = Math.abs(
    tradePlan.entry - tradePlan.stopLoss
  );

  const reward = Math.abs(
    tradePlan.tp1 - tradePlan.entry
  );

  if (risk <= 0 || reward <= 0) {
    return {
      ...tradePlan,
      bestAction: "NO TRADE",
      riskReward: null,
      confirmationRequired:
        "Invalid entry/stop/target geometry. No trade.",
    };
  }

  const calculatedRr = reward / risk;

  if (calculatedRr < MIN_RISK_REWARD) {
    return {
      ...tradePlan,
      bestAction: "NO TRADE",
      riskReward: Number(calculatedRr.toFixed(2)),
      confirmationRequired:
        "The supplied setup does not meet the minimum 1:3.5 risk/reward requirement. Wait.",
    };
  }

  return {
    ...tradePlan,
    riskReward: Number(calculatedRr.toFixed(2)),
  };
}

export async function GET() {
  try {
    const geminiApiKey = process.env.GEMINI_API_KEY;
    const twelveDataApiKey =
      process.env.TWELVE_DATA_API_KEY;

    if (!geminiApiKey) {
      console.error("GEMINI_API_KEY is missing");

      return NextResponse.json(
        {
          ...FALLBACK_ANALYSIS,
          headline: "Gemini API key missing",
          reasoning:
            "GEMINI_API_KEY is not configured in the Vercel environment variables.",
        },
        {
          status: 200,
          headers: {
            "Cache-Control": "no-store, max-age=0",
          },
        }
      );
    }

    if (!twelveDataApiKey) {
      console.error("TWELVE_DATA_API_KEY is missing");

      return NextResponse.json(
        {
          ...FALLBACK_ANALYSIS,
          headline: "Market data API key missing",
          reasoning:
            "TWELVE_DATA_API_KEY is not configured in the Vercel environment variables.",
        },
        {
          status: 200,
          headers: {
            "Cache-Control": "no-store, max-age=0",
          },
        }
      );
    }

    const marketData: MarketDataSet[] =
      await Promise.all(
        TIMEFRAMES.map(
          async ({ label, interval, outputsize }) => {
            const url = new URL(
              "https://api.twelvedata.com/time_series"
            );

            url.searchParams.set(
              "symbol",
              "XAU/USD"
            );
            url.searchParams.set(
              "interval",
              interval
            );
            url.searchParams.set(
              "outputsize",
              String(outputsize)
            );
            url.searchParams.set(
              "apikey",
              twelveDataApiKey
            );
            url.searchParams.set(
              "format",
              "JSON"
            );
            url.searchParams.set(
              "timezone",
              "UTC"
            );

            const response = await fetch(
              url.toString(),
              {
                cache: "no-store",
              }
            );

            const data = await response.json();

            if (
              !response.ok ||
              data?.status === "error"
            ) {
              throw new Error(
                `${label} market data request failed: ${
                  data?.message ||
                  `HTTP ${response.status}`
                }`
              );
            }

            const candles: Candle[] =
              Array.isArray(data?.values)
                ? data.values
                    .map((candle: any) => ({
                      datetime: String(
                        candle?.datetime ?? ""
                      ),
                      open: Number(
                        candle?.open
                      ),
                      high: Number(
                        candle?.high
                      ),
                      low: Number(
                        candle?.low
                      ),
                      close: Number(
                        candle?.close
                      ),
                      volume:
                        candle?.volume !==
                        undefined
                          ? Number(
                              candle.volume
                            )
                          : null,
                    }))
                    .filter(
                      (candle: Candle) =>
                        candle.datetime &&
                        Number.isFinite(
                          candle.open
                        ) &&
                        Number.isFinite(
                          candle.high
                        ) &&
                        Number.isFinite(
                          candle.low
                        ) &&
                        Number.isFinite(
                          candle.close
                        )
                    )
                    .sort(
                      (
                        a: Candle,
                        b: Candle
                      ) =>
                        a.datetime.localeCompare(
                          b.datetime
                        )
                    )
                : [];

            if (candles.length === 0) {
              throw new Error(
                `No valid ${label} XAU/USD candle data was returned.`
              );
            }

            return {
              timeframe: label,
              interval,
              count: candles.length,
              candles,
            };
          }
        )
      );

    const derivedContext =
      buildDerivedContext(marketData);

    const marketDataText =
      buildMarketDataText(
        marketData,
        derivedContext
      );

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": geminiApiKey,
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [
              {
                text: ANALYSIS_PROMPT,
              },
            ],
          },
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: `Analyze this XAU/USD market dataset. The JSON contains 1D, 4H, 1H, 15M and 5M candles plus objective derived context.

IMPORTANT:
- The JSON is the source of truth.
- Use the full supplied candle history where relevant.
- Do not invent missing data.
- The 5M is execution only.
- Minimum acceptable R:R for an executable trade is 1:3.5.

MARKET DATA:
${marketDataText}`,
                },
              ],
            },
          ],
          generationConfig: {
            responseMimeType:
              "application/json",
            responseSchema: RESPONSE_SCHEMA,
            thinkingConfig: {
              thinkingLevel: "high",
            },
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText =
        await response.text();

      console.error(
        "================================="
      );
      console.error(
        "GEMINI API ERROR"
      );
      console.error(
        "Model:",
        GEMINI_MODEL
      );
      console.error(
        "Status:",
        response.status
      );
      console.error(
        "Response:",
        errorText
      );
      console.error(
        "================================="
      );

      return NextResponse.json(
        {
          ...FALLBACK_ANALYSIS,
          headline:
            "Gemini API request failed",
          reasoning: `Gemini returned HTTP ${response.status}. Check the Vercel deployment logs for the exact API error.`,
        },
        {
          status: 200,
          headers: {
            "Cache-Control":
              "no-store, max-age=0",
          },
        }
      );
    }

    const data =
      await response.json();

    const text =
      data?.candidates?.[0]?.content?.parts
        ?.map(
          (part: {
            text?: string;
          }) => part?.text || ""
        )
        .join("")
        .trim() || "";

    if (!text) {
      console.error(
        "Gemini returned no text:",
        data
      );

      return NextResponse.json(
        {
          ...FALLBACK_ANALYSIS,
          headline:
            "Gemini returned no analysis",
          reasoning:
            "Gemini responded successfully, but no usable analysis was returned.",
        },
        {
          status: 200,
          headers: {
            "Cache-Control":
              "no-store, max-age=0",
          },
        }
      );
    }

    let parsed: any;

    try {
      parsed = JSON.parse(text);
    } catch {
      console.error(
        "Failed to parse Gemini JSON:",
        text
      );

      return NextResponse.json(
        {
          ...FALLBACK_ANALYSIS,
          headline:
            "Invalid Gemini response",
          reasoning:
            "Gemini returned a response that could not be converted into the required analysis format.",
        },
        {
          status: 200,
          headers: {
            "Cache-Control":
              "no-store, max-age=0",
          },
        }
      );
    }

    const validVerdicts = [
      "bullish",
      "bearish",
      "neutral",
    ];

    const verdict =
      validVerdicts.includes(
        parsed?.verdict
      )
        ? parsed.verdict
        : "neutral";

    const confidence = Math.min(
      100,
      Math.max(
        0,
        Number.isFinite(
          Number(parsed?.confidence)
        )
          ? Number(parsed.confidence)
          : 50
      )
    );

    const headline =
      typeof parsed?.headline ===
      "string"
        ? parsed.headline
        : "XAU/USD market analysis";

    const reasoning =
      typeof parsed?.reasoning ===
      "string"
        ? parsed.reasoning
        : "Market conditions remain mixed.";

    const keyLevels =
      sanitizeKeyLevels(
        parsed?.keyLevels
      );

    const sanitizedTradePlan =
      sanitizeTradePlan(
        parsed?.tradePlan
      );

    const tradePlan =
      enforceRiskReward(
        sanitizedTradePlan
      );

    const finalVerdict =
      tradePlan.bestAction ===
        "LONG BUY"
        ? "bullish"
        : tradePlan.bestAction ===
          "SHORT SELL"
        ? "bearish"
        : verdict;

    return NextResponse.json(
      {
        verdict: finalVerdict,
        confidence,
        headline,
        reasoning,
        keyLevels,
        tradePlan,
        generatedAt:
          new Date().toISOString(),
        dataQuality: {
          requestedCandles: {
            "1D": 500,
            "4H": 800,
            "1H": 950,
            "15M": 1200,
            "5M": 1550,
          },
          receivedCandles:
            marketData.reduce(
              (acc, dataset) => {
                acc[dataset.timeframe] =
                  dataset.count;
                return acc;
              },
              {} as Record<
                string,
                number
              >
            ),
          currentPrice:
            derivedContext.currentPrice,
        },
      },
      {
        status: 200,
        headers: {
          "Cache-Control":
            "no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    console.error(
      "================================="
    );
    console.error(
      "ANALYZE ROUTE ERROR"
    );
    console.error(error);
    console.error(
      "================================="
    );

    return NextResponse.json(
      {
        ...FALLBACK_ANALYSIS,
        headline:
          "Analysis unavailable",
        reasoning:
          error instanceof Error
            ? error.message
            : "An unexpected server error occurred while contacting the market-data or Gemini analysis service.",
      },
      {
        status: 200,
        headers: {
          "Cache-Control":
            "no-store, max-age=0",
        },
      }
    );
  }
}
