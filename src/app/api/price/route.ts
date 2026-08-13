import { NextResponse } from "next/server";

export async function GET() {
  try {
    const apiKey = process.env.TWELVE_DATA_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing TWELVE_DATA_API_KEY" },
        { status: 500 }
      );
    }

    const url = `https://api.twelvedata.com/quote?symbol=XAU/USD&apikey=${apiKey}`;

    const response = await fetch(url, {
      next: { revalidate: 30 },
    });

    const data = await response.json();

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch XAU/USD price" },
      { status: 500 }
    );
  }
        }
      
