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

    const intervalParam =
      searchParams.get("interval") || "5min";

    const outputsizeParam =
      searchParams.get("outputsize") || "500";

    if (
      !VALID_INTERVALS.includes(
        intervalParam as Interval
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid interval. Use 5min, 15min, 1h, 4h, or 1day.",
        },
        { status: 400 }
      );
    }

    const parsedOutputsize = Number(
      outputsizeParam
    );

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

    url.searchParams.set(
      "symbol",
      "XAU/USD"
    );

    url.searchParams.set(
      "interval",
      intervalParam
    );

    url.searchParams.set(
      "outputsize",
      String(outputsize)
    );

    url.searchParams.set(
      "apikey",
      apiKey
    );

    url.searchParams.set(
      "format",
      "JSON"
    );

    url.searchParams.set(
      "timezone",
      "UTC"
    );

    /*
     * Cache the Twelve Data request for 60 seconds.
     *
     * This prevents repeated requests for the same
     * symbol + interval + outputsize from hammering
     * the Twelve Data API.
     */
    const response = await fetch(
      url.toString(),
      {
        next: {
          revalidate: 60,
        },
      }
    );

    const data = await response.json();

    if (
      !response.ok ||
      data?.status === "error"
    ) {
      console.error(
        "Twelve Data candle error:",
        {
          status: response.status,
          interval: intervalParam,
          outputsize,
          data,
        }
      );

      return NextResponse.json(
        {
          error:
            "Failed to fetch XAU/USD candles",
          details:
            data?.message ||
            "Unknown Twelve Data error",
        },
        {
          status:
            response.status >= 400
              ? response.status
              : 502,
        }
      );
    }

    if (!Array.isArray(data?.values)) {
      console.error(
        "Twelve Data returned no values:",
        data
      );

      return NextResponse.json(
        {
          error:
            "No candle data was returned",
          details:
            data?.message ||
            "Twelve Data returned an unexpected response.",
        },
        { status: 502 }
      );
    }

    const candles = data.values
      .map((candle: any) => ({
        datetime: String(
          candle?.datetime ?? ""
        ),
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
        (candle: any) =>
          candle.datetime &&
          Number.isFinite(candle.open) &&
          Number.isFinite(candle.high) &&
          Number.isFinite(candle.low) &&
          Number.isFinite(candle.close)
      )
      .sort(
        (a: any, b: any) =>
          new Date(a.datetime).getTime() -
          new Date(b.datetime).getTime()
      );

    if (!candles.length) {
      return NextResponse.json(
        {
          error:
            "No valid XAU/USD candles were returned",
          details:
            "Twelve Data returned data, but none of the candles were valid.",
        },
        { status: 502 }
      );
    }

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
          "Cache-Control":
            "public, s-maxage=60, stale-while-revalidate=30",
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
        details:
          error instanceof Error
            ? error.message
            : "Unknown server error",
      },
      { status: 500 }
    );
  }
  }
