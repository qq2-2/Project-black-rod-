import { NextResponse } from "next/server";

export async function GET() {
  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing GEMINI_API_KEY" },
        { status: 500 }
      );
    }

    const prompt = `
You are an institutional XAU/USD market analyst.

Return ONLY valid JSON with this exact structure:
{
  "verdict": "bullish" | "bearish" | "neutral",
  "confidence": 75,
  "headline": "Short market headline",
  "reasoning": "2-3 sentence analysis",
  "keyLevels": [
    { "label": "Support", "price": 4300, "type": "support" },
    { "label": "Resistance", "price": 4380, "type": "resistance" }
  ],
  "generatedAt": "ISO timestamp"
}

Keep the analysis concise and professional.
`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: "Gemini API request failed", details: errorText },
        { status: 500 }
      );
    }

    const data = await response.json();

    const text = data.candidates?.[0]?.content?.parts
      ?.map((part: any) => part.text || "")
      .join("")
      .trim();

    if (!text) {
      return NextResponse.json({
        verdict: "neutral",
        confidence: 60,
        headline: "AI analysis temporarily unavailable",
        reasoning:
          "The AI service did not return a usable analysis. Using a neutral fallback.",
        keyLevels: [
          { label: "Support", price: 4300, type: "support" },
          { label: "Resistance", price: 4380, type: "resistance" },
        ],
        generatedAt: new Date().toISOString(),
      });
    }

    const cleaned = text
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    return NextResponse.json(JSON.parse(cleaned));
  } catch (error) {
    return NextResponse.json(
      {
        verdict: "neutral",
        confidence: 50,
        headline: "Analysis unavailable",
        reasoning:
          "An error occurred while generating AI analysis. Showing a neutral fallback.",
        keyLevels: [
          { label: "Support", price: 4300, type: "support" },
          { label: "Resistance", price: 4380, type: "resistance" },
        ],
        generatedAt: new Date().toISOString(),
      },
      { status: 200 }
    );
  }
        }
