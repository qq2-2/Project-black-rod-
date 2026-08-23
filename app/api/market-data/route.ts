import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const TIMEFRAMES = {
  "5m": "5min",
  "15m": "15min",
  "1H": "1h",
  "4H": "4h",
  "1D": "1day",
} as const;

type Timeframe = keyof typeof TIMEFRAMES;

type Candle = {
  datetime: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
};

type CandleResponse = {
  candles?: Candle[];
  error?: string;
  details?: string;
};

async function fetchTimeframe(
  request: NextRequest,
  timeframe: Timeframe
) {
  const interval = TIMEFRAMES[timeframe];

  const url = new URL(
    "/api/candles",
    request.url
  );

  url.searchParams.set("interval", interval);
  url.searchParams.set("outputsize", "500");

  const response = await fetch(url.toString(), {
    cache: "no-store",
  });

  const data: CandleResponse =
    await response.json();

  if (!response.ok || data?.error) {
    throw new Error(
      data?.details ||
        data?.error ||
        `Failed to load ${timeframe} market data`
    );
  }

  return data.candles || [];
}

export async function GET(request: NextRequest) {
  try {
    const entries = await Promise.all(
      (
        Object.keys(TIMEFRAMES) as Timeframe[]
      ).map(async (timeframe) => {
        const candles = await fetchTimeframe(
          request,
          timeframe
        );

        return [
          timeframe,
          {
            interval: TIMEFRAMES[timeframe],
            count: candles.length,
            candles,
          },
        ] as const;
      })
    );

    const timeframes = Object.fromEntries(
      entries
    );

    return NextResponse.json(
      {
        symbol: "XAU/USD",
        timeframes,
        generatedAt:
          new Date().toISOString(),
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
      "MARKET DATA ROUTE ERROR:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to build multi-timeframe XAU/USD market data",
        details:
          error instanceof Error
            ? error.message
            : "Unknown error",
      },
      {
        status: 500,
      }
    );
  }
    }
