import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const FALLBACK_ANALYSIS = {
  verdict: "neutral",
  confidence: 50,
  headline: "AI analysis unavailable",
  reasoning:
    "The Gemini analysis service is currently unavailable. Please try again shortly.",
  keyLevels: [],
  generatedAt: new Date().toISOString(),
};

const TIMEFRAMES = [
  { label: "1D", interval: "1day", outputsize: 300 },
  { label: "4H", interval: "4h", outputsize: 300 },
  { label: "1H", interval: "1h", outputsize: 300 },
  { label: "15M", interval: "15min", outputsize: 300 },
  { label: "5M", interval: "5min", outputsize: 300 },
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

export async function GET() {
  try {
    const geminiApiKey = process.env.GEMINI_API_KEY;
    const twelveDataApiKey = process.env.TWELVE_DATA_API_KEY;

    // --------------------------------------------------
    // 1. Check API keys
    // --------------------------------------------------

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

    // --------------------------------------------------
    // 2. Fetch XAU/USD market data
    // --------------------------------------------------

    const marketData: MarketDataSet[] = await Promise.all(
      TIMEFRAMES.map(async ({ label, interval, outputsize }) => {
        const url = new URL(
          "https://api.twelvedata.com/time_series"
        );

        url.searchParams.set("symbol", "XAU/USD");
        url.searchParams.set("interval", interval);
        url.searchParams.set("outputsize", String(outputsize));
        url.searchParams.set("apikey", twelveDataApiKey);
        url.searchParams.set("format", "JSON");
        url.searchParams.set("timezone", "UTC");

        const response = await fetch(url.toString(), {
          cache: "no-store",
        });

        const data = await response.json();

        if (!response.ok || data?.status === "error") {
          throw new Error(
            `${label} market data request failed: ${
              data?.message || `HTTP ${response.status}`
            }`
          );
        }

        const candles: Candle[] = Array.isArray(data?.values)
          ? data.values
              .map((candle: any) => ({
                datetime: String(candle?.datetime ?? ""),
                open: Number(candle?.open),
                high: Number(candle?.high),
                low: Number(candle?.low),
                close: Number(candle?.close),
                volume:
                  candle?.volume !== undefined
                    ? Number(candle.volume)
                    : null,
              }))
              .filter(
                (candle: Candle) =>
                  candle.datetime &&
                  Number.isFinite(candle.open) &&
                  Number.isFinite(candle.high) &&
                  Number.isFinite(candle.low) &&
                  Number.isFinite(candle.close)
              )
              .sort((a: Candle, b: Candle) =>
                a.datetime.localeCompare(b.datetime)
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
      })
    );

    // --------------------------------------------------
    // 3. Build the market-data message for Gemini
    // --------------------------------------------------

    const marketDataText = JSON.stringify(
      {
        symbol: "XAU/USD",
        timezone: "UTC",
        timeframes: marketData,
      },
      null,
      2
    );

    // --------------------------------------------------
    // 4. Prompt
    // --------------------------------------------------

    const prompt = `
Act as a professional XAU/USD trader and expert in ICT (Inner Circle Trader), Smart Money Concepts (SMC), Fair Value Gaps (FVG), liquidity, market structure, and institutional price action.

You are receiving MARKET DATA provided by the application, including available XAU/USD candle data for:
- 1D
- 4H
- 1H
- 15M
- 5M

Analyze the supplied data using a strict top-down approach.

IMPORTANT:
- Analyze ONLY the market data provided.
- Do NOT invent prices, FVGs, liquidity, order blocks, swing points, market structure, or candle patterns.
- If the data is insufficient or something cannot be determined reliably, say so.
- Do NOT force a trade.
- The 1H determines DIRECTION.
- The 15M determines SETUP.
- The 5M determines EXECUTION.
- Do not allow the 5M to override clear higher-timeframe structure without strong evidence of a genuine shift.

━━━━━━━━━━━━━━━━━━━━
1. HIGHER-TIMEFRAME ANALYSIS
━━━━━━━━━━━━━━━━━━━━

Analyze the 1D, 4H and 1H data.

Identify where possible:
- Market structure
- Bullish, bearish, or ranging conditions
- Major swing highs/lows
- Buy-side liquidity (BSL)
- Sell-side liquidity (SSL)
- Equal highs/lows
- FVGs and iFVGs
- Order blocks
- Breaker blocks
- Premium/discount
- Important support/resistance
- Major liquidity targets

Determine the dominant 1H bias and the most likely visible liquidity draw.

HTF BIAS:
BULLISH / BEARISH / NEUTRAL

PRIMARY LIQUIDITY TARGET:
[price/area]

SECONDARY LIQUIDITY TARGET:
[price/area]

━━━━━━━━━━━━━━━━━━━━
2. 15M SETUP
━━━━━━━━━━━━━━━━━━━━

Analyze the 15M data in relation to the higher-timeframe bias.

Look for:
- Liquidity sweeps
- BOS
- CHoCH
- MSS
- Displacement
- FVG/iFVG
- Order blocks
- Breaker blocks
- Equal highs/lows
- Internal/external liquidity
- Inducement
- Accumulation/distribution

Determine whether the 15M CONFIRMS or CONTRADICTS the higher-timeframe bias and identify the most important potential setup area.

━━━━━━━━━━━━━━━━━━━━
3. 5M ENTRY CONFIRMATION
━━━━━━━━━━━━━━━━━━━━

The 5M is ONLY for entry confirmation.

Do NOT recommend an entry merely because price reaches an FVG, order block, support, or resistance.

For LONG confirmation, look for:

LIQUIDITY → SELL-SIDE SWEEP → BULLISH DISPLACEMENT → MSS/CHoCH → FVG/iFVG → RETRACEMENT → ENTRY

For SHORT confirmation, look for:

LIQUIDITY → BUY-SIDE SWEEP → BEARISH DISPLACEMENT → MSS/CHoCH → FVG/iFVG → RETRACEMENT → ENTRY

Determine whether these conditions actually occurred in the supplied data.

If they have NOT occurred:
DO NOT give an immediate entry.
Prefer WAIT or NO TRADE.

━━━━━━━━━━━━━━━━━━━━
4. FVG & LIQUIDITY
━━━━━━━━━━━━━━━━━━━━

Analyze important visible FVGs and determine:
- Timeframe
- Bullish/bearish
- Mitigated or unmitigated
- Valid or invalid
- Relationship to liquidity and market structure

Do NOT treat every FVG as a trade signal.

Map important liquidity above and below price, including:
- BSL
- SSL
- Equal highs/lows
- Previous highs/lows
- Major liquidity pools

Determine which liquidity is most likely to be targeted first and explain why, based only on the supplied data.

━━━━━━━━━━━━━━━━━━━━
5. TRADE DECISION
━━━━━━━━━━━━━━━━━━━━

Choose ONE:

A. HIGH-PROBABILITY LONG
B. HIGH-PROBABILITY SHORT
C. WAIT FOR LONG CONFIRMATION
D. WAIT FOR SHORT CONFIRMATION
E. NO TRADE

Do NOT force a trade.

If there is no confirmed setup, say:

"NO VALID ENTRY YET — WAIT."

━━━━━━━━━━━━━━━━━━━━
6. ENTRY PLAN
━━━━━━━━━━━━━━━━━━━━

Only provide a confirmed entry plan if the required confirmation exists.

DIRECTION:
LONG / SHORT

ENTRY ZONE:
[approximate price]

ENTRY TRIGGER:
[confirmation]

STOP LOSS:
[logical invalidation]

TP1:
[first liquidity target]

TP2:
[second liquidity target]

TP3:
[extended target if supported]

RISK/REWARD:
[approximate R:R]

CONFIDENCE:
__/10

INVALIDATION:
[what invalidates the setup]

If no confirmed setup exists, instead provide:

LONG IF:
[required confirmation]

SHORT IF:
[required confirmation]

WAIT IF:
[what keeps the market invalid/unclear]

━━━━━━━━━━━━━━━━━━━━
7. FINAL MULTI-TIMEFRAME ASSESSMENT
━━━━━━━━━━━━━━━━━━━━

1D:
[context]

4H:
[structure]

1H:
[bias]

15M:
[setup/structure]

5M:
[confirmation/status]

Explain whether the timeframes are aligned.

Use this hierarchy:

1H = DIRECTION
15M = SETUP
5M = EXECUTION

━━━━━━━━━━━━━━━━━━━━
FINAL XAUUSD TRADE PLAN
━━━━━━━━━━━━━━━━━━━━

CURRENT PRICE:
[ ]

1H BIAS:
[ ]

15M STRUCTURE:
[ ]

5M STATUS:
[ ]

MARKET CONDITION:
[Trending / Ranging / Retracement / Expansion / Manipulation]

LIQUIDITY TARGET:
[ ]

BEST ACTION:
[LONG / SHORT / WAIT / NO TRADE]

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

MOST IMPORTANT RULE:

Do not give a trade simply because a possible reason exists.

Prioritize:

LIQUIDITY + MARKET STRUCTURE + DISPLACEMENT + MULTI-TIMEFRAME CONFLUENCE

over any single indicator or FVG.

Do not chase price.
Do not enter in the middle of a move.
Do not assume an FVG will hold.
Do not assume liquidity will be taken.
Do not predict reversals without confirmation.

Finally answer:

"IF I WERE SITTING IN FRONT OF THIS CHART RIGHT NOW, THE ONE THING I SHOULD WAIT FOR BEFORE ENTERING IS: ______"

Then state the exact price/action confirmation that should be observed before entering.
`;

    // --------------------------------------------------
    // 5. Gemini API request
    // --------------------------------------------------

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": geminiApiKey,
        },

        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: prompt,
                },
                {
                  text: `
Here is the actual XAU/USD market data to analyze.

IMPORTANT:
This JSON is the source of truth for the analysis.
Do not invent missing information.

${marketDataText}
`,
                },
              ],
            },
          ],

          generationConfig: {
            responseMimeType: "application/json",

            responseSchema: {
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
                      label: {
                        type: "STRING",
                      },

                      price: {
                        type: "NUMBER",
                      },

                      type: {
                        type: "STRING",
                        enum: ["support", "resistance"],
                      },
                    },

                    required: [
                      "label",
                      "price",
                      "type",
                    ],
                  },
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
                "generatedAt",
              ],
            },

            thinkingConfig: {
              thinkingLevel: "HIGH",
            },
          },
        }),
      }
    );

    // --------------------------------------------------
    // 6. Handle Gemini errors
    // --------------------------------------------------

    if (!response.ok) {
      const errorText = await response.text();

      console.error("=================================");
      console.error("GEMINI API ERROR");
      console.error("Status:", response.status);
      console.error("Response:", errorText);
      console.error("=================================");

      return NextResponse.json(
        {
          ...FALLBACK_ANALYSIS,
          headline: "Gemini API request failed",
          reasoning: `Gemini returned HTTP ${response.status}. Check the Vercel deployment logs for the exact API error.`,
        },
        {
          status: 200,
          headers: {
            "Cache-Control": "no-store, max-age=0",
          },
        }
      );
    }

    // --------------------------------------------------
    // 7. Parse Gemini response
    // --------------------------------------------------

    const data = await response.json();

    const text =
      data?.candidates?.[0]?.content?.parts
        ?.map((part: { text?: string }) => part?.text || "")
        .join("")
        .trim() || "";

    if (!text) {
      console.error("Gemini returned no text:", data);

      return NextResponse.json(
        {
          ...FALLBACK_ANALYSIS,
          headline: "Gemini returned no analysis",
          reasoning:
            "Gemini responded successfully, but no usable analysis was returned.",
        },
        {
          status: 200,
          headers: {
            "Cache-Control": "no-store, max-age=0",
          },
        }
      );
    }

    // --------------------------------------------------
    // 8. Parse structured JSON
    // --------------------------------------------------

    let parsed: any;

    try {
      parsed = JSON.parse(text);
    } catch (error) {
      console.error(
        "Failed to parse Gemini JSON:",
        text
      );

      return NextResponse.json(
        {
          ...FALLBACK_ANALYSIS,
          headline: "Invalid Gemini response",
          reasoning:
            "Gemini returned a response that could not be converted into the required analysis format.",
        },
        {
          status: 200,
          headers: {
            "Cache-Control": "no-store, max-age=0",
          },
        }
      );
    }

    // --------------------------------------------------
    // 9. Validate the response
    // --------------------------------------------------

    const validVerdicts = [
      "bullish",
      "bearish",
      "neutral",
    ];

    const verdict = validVerdicts.includes(
      parsed?.verdict
    )
      ? parsed.verdict
      : "neutral";

    const confidence = Math.min(
      100,
      Math.max(
        0,
        Number.isFinite(Number(parsed?.confidence))
          ? Number(parsed.confidence)
          : 50
      )
    );

    const headline =
      typeof parsed?.headline === "string"
        ? parsed.headline
        : "XAU/USD market analysis";

    const reasoning =
      typeof parsed?.reasoning === "string"
        ? parsed.reasoning
        : "Market conditions remain mixed.";

    const keyLevels = Array.isArray(
      parsed?.keyLevels
    )
      ? parsed.keyLevels
          .filter(
            (level: any) =>
              level &&
              typeof level.label === "string" &&
              Number.isFinite(
                Number(level.price)
              ) &&
              [
                "support",
                "resistance",
              ].includes(level.type)
          )
          .map((level: any) => ({
            label: level.label,
            price: Number(level.price),
            type: level.type,
          }))
      : [];

    // --------------------------------------------------
    // 10. Final response
    // --------------------------------------------------

    return NextResponse.json(
      {
        verdict,
        confidence,
        headline,
        reasoning,
        keyLevels,
        generatedAt: new Date().toISOString(),
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    console.error("=================================");
    console.error("ANALYZE ROUTE ERROR");
    console.error(error);
    console.error("=================================");

    return NextResponse.json(
      {
        ...FALLBACK_ANALYSIS,
        headline: "Analysis unavailable",
        reasoning:
          error instanceof Error
            ? error.message
            : "An unexpected server error occurred while contacting the market-data or Gemini analysis service.",
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  }
      }
