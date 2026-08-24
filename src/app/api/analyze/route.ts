import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const FALLBACK_ANALYSIS = {
  verdict: "neutral",
  confidence: 50,
  headline: "AI analysis unavailable",
  reasoning:
    "The Gemini analysis service is currently unavailable. Please try again shortly.",
  keyLevels: [
    { label: "Support", price: 4300, type: "support" },
    { label: "Resistance", price: 4380, type: "resistance" },
  ],
  generatedAt: new Date().toISOString(),
};

export async function GET() {
  try {
    const apiKey = process.env.GEMINI_API_KEY;

    // --------------------------------------------------
    // 1. Check API key
    // --------------------------------------------------

    if (!apiKey) {
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

    // --------------------------------------------------
    // 2. Prompt
    // --------------------------------------------------

    const prompt = `
You are an institutional XAU/USD market analyst.

Analyze the current gold market based ONLY on the market information provided to you.

At this stage, if no live market data is provided, do not invent prices or pretend that you have real-time market data.

Return a concise professional market assessment.

The verdict must be exactly one of:
- bullish
- bearish
- neutral

Confidence must be a number from 0 to 100.

Provide 1-3 useful support/resistance levels only when they can be reasonably inferred from the supplied market data.

Do not provide financial advice.
`;

    // --------------------------------------------------
    // 3. Gemini API request
    // --------------------------------------------------

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },

        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt,
                },
              ],
            },
          ],

          generationConfig: {
            response_mime_type: "application/json",

            response_schema: {
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

                    required: ["label", "price", "type"],
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
          },
        }),
      }
    );

    // --------------------------------------------------
    // 4. Handle Gemini errors
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
    // 5. Parse Gemini response
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
    // 6. Parse structured JSON
    // --------------------------------------------------

    let parsed;

    try {
      parsed = JSON.parse(text);
    } catch (error) {
      console.error("Failed to parse Gemini JSON:", text);

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
    // 7. Validate the response
    // --------------------------------------------------

    const validVerdicts = ["bullish", "bearish", "neutral"];

    const verdict = validVerdicts.includes(parsed?.verdict)
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

    const keyLevels = Array.isArray(parsed?.keyLevels)
      ? parsed.keyLevels
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
      : [];

    // --------------------------------------------------
    // 8. Final response
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
          "An unexpected server error occurred while contacting the Gemini analysis service.",
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
const ANALYSIS_PROMPT = `
Act as a professional XAU/USD trader and expert in ICT (Inner Circle Trader), Smart Money Concepts (SMC), Fair Value Gaps (FVG), liquidity, market structure, and institutional price action.

You are analyzing XAU/USD using REAL MARKET DATA PROVIDED BY PROJECT BLACK ROD.

The market data supplied to you may contain multiple timeframes, including:

1H — Higher-Timeframe Bias
15M — Setup / Structure
5M — Entry Confirmation
4H — Higher-Timeframe Context
1D — Major Higher-Timeframe Context

IMPORTANT:

There are NO screenshots.

Do NOT expect screenshots and do NOT ask for screenshots.

Instead, read and analyze the OHLC/candle data, timestamps, timeframe information, and any other market data provided in the request.

The supplied market data represents the actual chart information available to you.

Your job is to analyze the provided data exactly as it is.

DO NOT invent:
- price levels
- swing highs/lows
- liquidity
- FVGs
- order blocks
- breaker blocks
- BOS
- CHoCH
- MSS
- displacement
- candle patterns
- support/resistance
- market structure

unless they can reasonably be derived from the supplied market data.

If the supplied data is insufficient to confidently identify something, explicitly say:

"INSUFFICIENT DATA TO CONFIRM."

Do not fill missing information with assumptions.

━━━━━━━━━━━━━━━━━━━━
1. HIGHER-TIMEFRAME ANALYSIS
━━━━━━━━━━━━━━━━━━━━

Analyze the higher-timeframe market data first.

Use the available 4H, 1D, and 1H data when provided.

Determine:

• Overall market structure
• Bullish, bearish, or ranging conditions
• Higher-timeframe bias
• Major swing highs and lows
• Buy-side liquidity (BSL)
• Sell-side liquidity (SSL)
• Equal highs/lows where identifiable
• Major FVGs and iFVGs where identifiable
• Important order blocks where identifiable
• Breaker blocks where identifiable
• Premium/discount where identifiable
• Important support/resistance
• Major liquidity targets

Determine where price appears most likely to be drawn based on the visible/derivable liquidity and structure.

Give:

HTF BIAS:
BULLISH / BEARISH / NEUTRAL

PRIMARY LIQUIDITY TARGET:
[price/area or INSUFFICIENT DATA TO CONFIRM]

SECONDARY LIQUIDITY TARGET:
[price/area or INSUFFICIENT DATA TO CONFIRM]


━━━━━━━━━━━━━━━━━━━━
2. 1H MARKET STRUCTURE & BIAS
━━━━━━━━━━━━━━━━━━━━

Analyze the 1H data specifically.

Identify:

• Swing structure
• Higher highs / higher lows
• Lower highs / lower lows
• BOS
• CHoCH
• MSS
• Displacement
• Liquidity sweeps
• Equal highs/lows
• FVGs
• iFVGs
• Order blocks
• Breaker blocks
• Internal liquidity
• External liquidity
• Inducement

Determine:

1H BIAS:
BULLISH / BEARISH / NEUTRAL

Explain the structural reason for the bias using the supplied candle data.


━━━━━━━━━━━━━━━━━━━━
3. 15M MARKET STRUCTURE & SETUP
━━━━━━━━━━━━━━━━━━━━

Now analyze the 15M data in relation to the higher-timeframe bias.

Look for:

• Liquidity sweeps
• BOS
• CHoCH
• MSS
• Displacement
• FVG formation
• FVG retracement
• iFVG
• Order blocks
• Breaker blocks
• Equal highs/lows
• Internal liquidity
• External liquidity
• Inducement
• Signs of accumulation/distribution

Determine whether the 15M:

CONFIRMS
or
CONTRADICTS

the higher-timeframe bias.

Identify the most important area where a potential trade could develop.

Do not call a setup valid merely because an FVG or order block exists.


━━━━━━━━━━━━━━━━━━━━
4. 5M ENTRY CONFIRMATION
━━━━━━━━━━━━━━━━━━━━

IMPORTANT:

DO NOT use the 5M data to independently predict market direction.

The 5M timeframe is ONLY for ENTRY CONFIRMATION.

Do NOT recommend an entry merely because price reaches an FVG, order block, support, resistance, or liquidity level.

Before suggesting an entry, look for a sequence such as:

LIQUIDITY
→
SWEEP
→
DISPLACEMENT
→
MSS / CHoCH
→
FVG
→
RETRACEMENT
→
ENTRY

For a LONG setup, look for evidence such as:

1. Price reaches or sweeps sell-side liquidity.
2. Bullish displacement occurs.
3. A bullish 5M MSS/CHoCH occurs.
4. A bullish FVG is created.
5. Price retraces into the FVG/iFVG or relevant order block.
6. Entry becomes valid only after the above confirmation.

For a SHORT setup, look for:

1. Price reaches or sweeps buy-side liquidity.
2. Bearish displacement occurs.
3. A bearish 5M MSS/CHoCH occurs.
4. A bearish FVG is created.
5. Price retraces into the FVG/iFVG or relevant order block.
6. Entry becomes valid only after the above confirmation.

These are NOT assumptions that the setup exists.

Determine from the supplied 5M market data whether these conditions have actually occurred.

If they have NOT occurred:

DO NOT give an immediate entry.

Instead say:

"NO VALID ENTRY YET — WAIT."


━━━━━━━━━━━━━━━━━━━━
5. FVG ANALYSIS
━━━━━━━━━━━━━━━━━━━━

Analyze FVGs that can be derived from the supplied candle data.

For each important FVG, determine:

• Timeframe
• Bullish or bearish
• Formation area
• Whether it has been mitigated
• Whether it remains valid
• Whether it aligns with liquidity
• Whether it aligns with market structure
• Whether it could potentially act as an entry zone

DO NOT treat every FVG as a trade signal.

An FVG requires additional confluence before being considered actionable.

If the supplied data does not contain enough candles to reliably determine an FVG, state:

"INSUFFICIENT DATA TO CONFIRM FVG."


━━━━━━━━━━━━━━━━━━━━
6. LIQUIDITY ANALYSIS
━━━━━━━━━━━━━━━━━━━━

Map liquidity that can reasonably be identified from the supplied market data.

ABOVE CURRENT PRICE:

• Buy-side liquidity
• Equal highs
• Previous highs
• Liquidity pools
• Potential targets

BELOW CURRENT PRICE:

• Sell-side liquidity
• Equal lows
• Previous lows
• Liquidity pools
• Potential targets

Determine which liquidity is most likely to be targeted first and explain WHY using the supplied structure.

Do not invent liquidity levels that are not supported by the data.


━━━━━━━━━━━━━━━━━━━━
7. TRADE DECISION
━━━━━━━━━━━━━━━━━━━━

After analyzing all available timeframes, choose ONE:

A. HIGH-PROBABILITY LONG
B. HIGH-PROBABILITY SHORT
C. WAIT FOR LONG CONFIRMATION
D. WAIT FOR SHORT CONFIRMATION
E. NO TRADE

Do NOT force a trade.

If the market does not provide enough confirmation, say:

"NO VALID ENTRY YET — WAIT."

Waiting is preferable to taking a low-quality setup.


━━━━━━━━━━━━━━━━━━━━
8. ENTRY PLAN
━━━━━━━━━━━━━━━━━━━━

If a confirmed setup exists, provide:

DIRECTION:
LONG / SHORT

ENTRY ZONE:
[exact approximate price or price range]

ENTRY TRIGGER:
[exact confirmation]

STOP LOSS:
[logical invalidation level]

TP1:
[first liquidity target]

TP2:
[second liquidity target]

TP3:
[extended target if applicable]

RISK/REWARD:
[approximate R:R]

CONFIDENCE:
__/10

INVALIDATION:
[what would make the setup invalid]


━━━━━━━━━━━━━━━━━━━━
9. CONDITIONAL SETUP
━━━━━━━━━━━━━━━━━━━━

If there is NO confirmed entry right now, create a conditional plan.

LONG IF:

Explain the exact sequence that must happen before a long becomes valid.

SHORT IF:

Explain the exact sequence that must happen before a short becomes valid.

WAIT IF:

Explain what would keep the market invalid or unclear.


━━━━━━━━━━━━━━━━━━━━
10. MULTI-TIMEFRAME CONFLUENCE
━━━━━━━━━━━━━━━━━━━━

Give me a final assessment of:

4H:
[Bias / structure / context]

1D:
[Bias / structure / context if data is available]

1H:
[Bias]

15M:
[Structure]

5M:
[Confirmation/status]

Then explain whether the available timeframes are aligned.

Use this hierarchy:

4H / 1D = MAJOR CONTEXT
1H = DIRECTION
15M = SETUP
5M = EXECUTION

Never allow the 5M to override clear higher-timeframe structure without strong evidence of a genuine higher-timeframe shift.


━━━━━━━━━━━━━━━━━━━━
11. DATA QUALITY CHECK
━━━━━━━━━━━━━━━━━━━━

Before making the final trade decision, check whether sufficient market data was provided.

Confirm:

• Which timeframes were provided
• Approximate number of candles available for each timeframe
• Whether the data appears chronologically ordered
• Whether enough historical candles exist to identify meaningful structure
• Whether the latest candle represents the current/latest available market data

If an important timeframe is missing, explicitly state that it is missing.

Do not pretend to have analyzed a timeframe that was not supplied.


━━━━━━━━━━━━━━━━━━━━
12. FINAL TRADE PLAN
━━━━━━━━━━━━━━━━━━━━

Use this exact format:

━━━━━━━━━━━━━━━━━━
XAUUSD TRADE PLAN
━━━━━━━━━━━━━━━━━━

CURRENT PRICE:
[ ]

4H CONTEXT:
[ ]

1D CONTEXT:
[ ]

1H BIAS:
[ ]

15M STRUCTURE:
[ ]

5M STATUS:
[ ]

MARKET CONDITION:
[Trending / Ranging / Retracement / Expansion / Manipulation / Unclear]

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

━━━━━━━━━━━━━━━━━━


MOST IMPORTANT RULE:

DO NOT GIVE ME A TRADE JUST BECAUSE YOU CAN FIND A REASON FOR ONE.

Act like a disciplined ICT/SMC trader waiting for confirmation.

The preferred sequence is:

4H / 1D CONTEXT
↓
1H BIAS
↓
15M LIQUIDITY / SETUP
↓
5M LIQUIDITY SWEEP
↓
5M DISPLACEMENT
↓
5M MSS / CHoCH
↓
FVG / iFVG RETRACEMENT
↓
ENTRY

If this sequence has not occurred, WAIT.

Do not chase price.

Do not enter in the middle of a move.

Do not assume an FVG will hold.

Do not assume liquidity will be taken.

Do not predict reversals without confirmation.

Do not force a bullish or bearish bias.

Prioritize:

LIQUIDITY
+
MARKET STRUCTURE
+
DISPLACEMENT
+
MULTI-TIMEFRAME CONFLUENCE

over any single indicator or FVG.

Finally answer:

"IF I WERE SITTING IN FRONT OF THIS CHART RIGHT NOW, THE ONE THING I SHOULD WAIT FOR BEFORE ENTERING IS: ______"

Then give me the exact price/action confirmation I should wait for, based ONLY on the market data provided.
`;
export async function GET(request: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
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

    const marketData = await getAllMarketData(request);

    const marketDataText =
      buildMarketDataText(marketData);

    const availableTimeframes = marketData
      .filter((item) => item.candles.length > 0)
      .map(
        (item) =>
          `${item.timeframe}: ${item.candles.length} candles`
      )
      .join(", ");

    const fullPrompt = `
${ANALYSIS_PROMPT}

━━━━━━━━━━━━━━━━━━━━
PROJECT BLACK ROD MARKET DATA
━━━━━━━━━━━━━━━━━━━━

Available timeframes:

${availableTimeframes || "NONE"}

The following OHLC data is the ONLY market information you may use:

${marketDataText}

IMPORTANT DATA RULE:

Use ONLY the supplied market data.

Do not claim that you can see a chart image.

Do not invent missing candles or prices.

If a timeframe contains "NO DATA AVAILABLE", treat that timeframe as unavailable.

Current/latest price should be derived from the most recent available candle close.

Now perform the complete analysis.
`;

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: fullPrompt,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              properties: {
                verdict: {
                  type: "STRING",
                  enum: [
                    "bullish",
                    "bearish",
                    "neutral",
                  ],
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
                        enum: [
                          "support",
                          "resistance",
                        ],
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
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();

      console.error(
        "================================="
      );
      console.error("GEMINI API ERROR");
      console.error("Status:", response.status);
      console.error("Response:", errorText);
      console.error(
        "================================="
      );

      return NextResponse.json(
        {
          ...FALLBACK_ANALYSIS,
          headline: "Gemini API request failed",
          reasoning:
            `Gemini returned HTTP ${response.status}. ` +
            "Check the Vercel deployment logs for the exact API error.",
        },
        {
          status: 200,
          headers: {
            "Cache-Control": "no-store, max-age=0",
          },
        }
      );
    }

    const data = await response.json();

    const text =
      data?.candidates?.[0]?.content?.parts
        ?.map(
          (part: { text?: string }) =>
            part?.text || ""
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
            "Cache-Control": "no-store, max-age=0",
          },
        }
      );
    }

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
          headline:
            "Invalid Gemini response",
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

    const numericConfidence = Number(
      parsed?.confidence
    );

    const confidence = Math.min(
      100,
      Math.max(
        0,
        Number.isFinite(numericConfidence)
          ? numericConfidence
          : 0
      )
    );

    const headline =
      typeof parsed?.headline === "string"
        ? parsed.headline
        : "XAU/USD market analysis";

    const reasoning =
      typeof parsed?.reasoning === "string"
        ? parsed.reasoning
        : "Market conditions remain unclear.";

    const keyLevels = Array.isArray(
      parsed?.keyLevels
    )
      ? parsed.keyLevels
          .filter(
            (level: any) =>
              level &&
              typeof level.label ===
                "string" &&
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

    return NextResponse.json(
      {
        verdict,
        confidence,
        headline,
        reasoning,
        keyLevels,
        generatedAt:
          new Date().toISOString(),
      } satisfies AnalysisResponse,
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
        headline: "Analysis unavailable",
        reasoning:
          "An unexpected server error occurred while loading market data or contacting Gemini.",
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
