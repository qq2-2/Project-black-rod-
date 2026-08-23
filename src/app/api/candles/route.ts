import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const VALID_INTERVALS = [
  "5min",
  "15min",
  "1h",
  "4h",
  "1day",
] as const;

type Interval = (typeof VALID_INTERVALS)[number];

export async function GET(request: NextRequest) {
  try {
    const apiKey = process.env.TWELVE_DATA_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          error: "TWELVE_DATA_API_KEY is not configured",
        },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);

    const intervalParam = searchParams.get("interval") || "5min";
    const outputsizeParam =
      searchParams.get("outputsize") || "500";

    if (!VALID_INTERVALS.includes(intervalParam as Interval)) {
      return NextResponse.json(
        {
          error:
            "Invalid interval. Use 5min, 15min, 1h, 4h, or 1day.",
        },
        { status: 400 }
      );
    }

    const parsedOutputsize = Number(outputsizeParam);

    const outputsize = Math.min(
      5000,
      Math.max(
        1,
        Number.isFinite(parsedOutputsize)
          ? parsedOutputsize
          : 500
      )
    );

    const url = new URL(
      "https://api.twelvedata.com/time_series"
    );

    url.searchParams.set("symbol", "XAU/USD");
    url.searchParams.set("interval", intervalParam);
    url.searchParams.set(
      "outputsize",
      String(outputsize)
    );
    url.searchParams.set("apikey", apiKey);
    url.searchParams.set("format", "JSON");
    url.searchParams.set("timezone", "UTC");

    const response = await fetch(url.toString(), {
      cache: "no-store",
    });

    const data = await response.json();

    if (!response.ok || data?.status === "error") {
      console.error(
        "Twelve Data candle error:",
        data
      );

      return NextResponse.json(
        {
          error: "Failed to fetch XAU/USD candles",
          details:
            data?.message ||
            "Unknown Twelve Data error",
        },
        {
          status: response.status || 500,
        }
      );
    }

    const candles = Array.isArray(data?.values)
      ? data.values
          .map((candle: any) => ({
            datetime: String(candle.datetime),
            open: Number(candle.open),
            high: Number(candle.high),
            low: Number(candle.low),
            close: Number(candle.close),
            volume:
              candle.volume !== undefined
                ? Number(candle.volume)
                : null,
          }))
          .filter(
            (candle: any) =>
              candle.datetime &&
              Number.isFinite(candle.open) &&
              Number.isFinite(candle.high) &&
              Number.isFinite(candle.low) &&
              Number.isFinite(candle.close)
          )
          .sort((a: any, b: any) =>
            a.datetime.localeCompare(b.datetime)
          )
      : [];

    return NextResponse.json(
      {
        symbol: "XAU/USD",
        interval: intervalParam,
        count: candles.length,
        candles,
        meta: data?.meta ?? null,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    console.error(
      "CANDLES ROUTE ERROR:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Unexpected error while fetching market data",
      },
      { status: 500 }
    );
  }
      }
