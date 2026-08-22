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
