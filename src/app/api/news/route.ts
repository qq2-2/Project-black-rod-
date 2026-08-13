import { NextResponse } from "next/server";

export async function GET() {
  try {
    const apiKey = process.env.MARKETAUX_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing MARKETAUX_API_KEY" },
        { status: 500 }
      );
    }

    const url =
      `https://api.marketaux.com/v1/news/all?symbols=XAUUSD,GOLD` +
      `&language=en&limit=10&api_token=${apiKey}`;

    const response = await fetch(url, {
      next: { revalidate: 300 },
    });

    const data = await response.json();

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch market news" },
      { status: 500 }
    );
  }
                                 }
