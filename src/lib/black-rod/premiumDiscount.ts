import { SwingCandle, SwingPoint } from "./swings";

export type MarketZone =
  | "PREMIUM"
  | "DISCOUNT"
  | "EQUILIBRIUM";

export type PremiumDiscountBias =
  | "BULLISH"
  | "BEARISH"
  | "NEUTRAL";

export interface DealingRange {
  high: number;
  low: number;
  equilibrium: number;
  rangeSize: number;
  rangePercent: number;
  highDatetime: string;
  lowDatetime: string;
  highIndex: number;
  lowIndex: number;
}

export interface OTEZone {
  bullishLow: number;
  bullishHigh: number;
  bearishLow: number;
  bearishHigh: number;
  bullishPercentLow: number;
  bullishPercentHigh: number;
  bearishPercentLow: number;
  bearishPercentHigh: number;
}

export interface PremiumDiscountAnalysis {
  dealingRange: DealingRange | null;

  currentPrice: number | null;

  currentZone: MarketZone;

  currentPercent: number | null;

  distanceFromEquilibrium: number | null;

  premiumHigh: number | null;
  equilibrium: number | null;
  discountLow: number | null;

  ote: OTEZone | null;

  bias: PremiumDiscountBias;

  isInPremium: boolean;
  isInDiscount: boolean;
  isAtEquilibrium: boolean;
}

export interface PremiumDiscountOptions {
  minimumRangePercent?: number;
  equilibriumTolerancePercent?: number;

  premiumThresholdPercent?: number;
  discountThresholdPercent?: number;

  oteLowPercent?: number;
  oteHighPercent?: number;

  maxLookback?: number;
}

const DEFAULT_OPTIONS: Required<PremiumDiscountOptions> = {
  minimumRangePercent: 0.05,
  equilibriumTolerancePercent: 1,

  premiumThresholdPercent: 50,
  discountThresholdPercent: 50,

  oteLowPercent: 62,
  oteHighPercent: 79,

  maxLookback: 200,
};

function isValidCandle(
  candle: SwingCandle
): boolean {
  return (
    Number.isFinite(candle.open) &&
    Number.isFinite(candle.high) &&
    Number.isFinite(candle.low) &&
    Number.isFinite(candle.close) &&
    candle.high >= candle.low &&
    candle.high >= candle.open &&
    candle.high >= candle.close &&
    candle.low <= candle.open &&
    candle.low <= candle.close
  );
}

function isValidSwing(
  swing: SwingPoint
): boolean {
  return (
    Number.isFinite(swing.price) &&
    Number.isInteger(swing.index) &&
    swing.index >= 0
  );
}

function clamp(
  value: number,
  min: number,
  max: number
): number {
  return Math.min(
    max,
    Math.max(min, value)
  );
}

function calculatePercentage(
  price: number,
  low: number,
  high: number
): number {
  const range = high - low;

  if (range <= 0) {
    return 50;
  }

  return (
    ((price - low) / range) *
    100
  );
}

function calculateEquilibrium(
  low: number,
  high: number
): number {
  return low + (high - low) / 2;
}

function createDealingRange(
  highSwing: SwingPoint,
  lowSwing: SwingPoint
): DealingRange | null {
  const high = highSwing.price;
  const low = lowSwing.price;

  if (
    !Number.isFinite(high) ||
    !Number.isFinite(low) ||
    high <= low
  ) {
    return null;
  }

  const rangeSize = high - low;

  const rangePercent =
    low !== 0
      ? (rangeSize / Math.abs(low)) * 100
      : 0;

  return {
    high,
    low,

    equilibrium:
      calculateEquilibrium(
        low,
        high
      ),

    rangeSize,

    rangePercent,

    highDatetime:
      String(
        highSwing.datetime
      ),

    lowDatetime:
      String(
        lowSwing.datetime
      ),

    highIndex:
      highSwing.index,

    lowIndex:
      lowSwing.index,
  };
}

function findDealingRange(
  candles: SwingCandle[],
  swingHighs: SwingPoint[],
  swingLows: SwingPoint[],
  options: Required<PremiumDiscountOptions>
): DealingRange | null {
  const validHighs =
    swingHighs
      .filter(isValidSwing)
      .sort(
        (a, b) =>
          b.index - a.index
      );

  const validLows =
    swingLows
      .filter(isValidSwing)
      .sort(
        (a, b) =>
          b.index - a.index
      );

  if (
    !validHighs.length ||
    !validLows.length
  ) {
    return null;
  }

  const latestHigh =
    validHighs[0];

  const latestLow =
    validLows[0];

  const candidate =
    createDealingRange(
      latestHigh,
      latestLow
    );

  if (
    candidate &&
    candidate.rangePercent >=
      options.minimumRangePercent
  ) {
    return candidate;
  }

  const recentHighs =
    validHighs.slice(
      0,
      options.maxLookback
    );

  const recentLows =
    validLows.slice(
      0,
      options.maxLookback
    );

  for (
    const high of recentHighs
  ) {
    for (
      const low of recentLows
    ) {
      if (
        high.index ===
        low.index
      ) {
        continue;
      }

      const range =
        createDealingRange(
          high,
          low
        );

      if (!range) {
        continue;
      }

      if (
        range.rangePercent >=
        options.minimumRangePercent
      ) {
        return range;
      }
    }
  }

  return null;
}

function calculateOTE(
  dealingRange: DealingRange,
  options: Required<PremiumDiscountOptions>
): OTEZone {
  const range =
    dealingRange.rangeSize;

  const lowPercent =
    options.oteLowPercent;

  const highPercent =
    options.oteHighPercent;

  /*
   * Bullish OTE:
   * Retracement downward from the dealing-range high.
   *
   * Example:
   * 62% = high - 38% of range
   * 79% = high - 21% of range
   *
   * The returned zone is ordered low -> high.
   */

  const bullishHigh =
    dealingRange.high -
    range *
      ((100 - lowPercent) /
        100);

  const bullishLow =
    dealingRange.high -
    range *
      ((100 - highPercent) /
        100);

  /*
   * Bearish OTE:
   * Retracement upward from the dealing-range low.
   *
   * 62% = low + 62% of range
   * 79% = low + 79% of range
   */

  const bearishLow =
    dealingRange.low +
    range *
      (lowPercent / 100);

  const bearishHigh =
    dealingRange.low +
    range *
      (highPercent / 100);

  return {
    bullishLow:
      Math.min(
        bullishLow,
        bullishHigh
      ),

    bullishHigh:
      Math.max(
        bullishLow,
        bullishHigh
      ),

    bearishLow:
      Math.min(
        bearishLow,
        bearishHigh
      ),

    bearishHigh:
      Math.max(
        bearishLow,
        bearishHigh
      ),

    bullishPercentLow:
      Math.min(
        lowPercent,
        highPercent
      ),

    bullishPercentHigh:
      Math.max(
        lowPercent,
        highPercent
      ),

    bearishPercentLow:
      Math.min(
        lowPercent,
        highPercent
      ),

    bearishPercentHigh:
      Math.max(
        lowPercent,
        highPercent
      ),
  };
}

function determineZone(
  currentPercent: number,
  options: Required<PremiumDiscountOptions>
): MarketZone {
  const equilibrium =
    50;

  const tolerance =
    options.equilibriumTolerancePercent;

  if (
    Math.abs(
      currentPercent -
        equilibrium
    ) <= tolerance
  ) {
    return "EQUILIBRIUM";
  }

  if (
    currentPercent >
    options.premiumThresholdPercent
  ) {
    return "PREMIUM";
  }

  if (
    currentPercent <
    options.discountThresholdPercent
  ) {
    return "DISCOUNT";
  }

  return "EQUILIBRIUM";
}

function determineBias(
  zone: MarketZone
): PremiumDiscountBias {
  if (zone === "DISCOUNT") {
    return "BULLISH";
  }

  if (zone === "PREMIUM") {
    return "BEARISH";
  }

  return "NEUTRAL";
}

function getCurrentPrice(
  candles: SwingCandle[]
): number | null {
  for (
    let i = candles.length - 1;
    i >= 0;
    i -= 1
  ) {
    if (
      isValidCandle(
        candles[i]
      )
    ) {
      return candles[i].close;
    }
  }

  return null;
}

export function analyzePremiumDiscount(
  candles: SwingCandle[],
  swingHighs: SwingPoint[],
  swingLows: SwingPoint[],
  currentPrice?: number,
  options: PremiumDiscountOptions = {}
): PremiumDiscountAnalysis {
  const config:
    Required<PremiumDiscountOptions> =
    {
      ...DEFAULT_OPTIONS,
      ...options,
    };

  const safeCandles =
    Array.isArray(candles)
      ? candles
      : [];

  const price =
    Number.isFinite(
      currentPrice
    )
      ? (currentPrice as number)
      : getCurrentPrice(
          safeCandles
        );

  const dealingRange =
    findDealingRange(
      safeCandles,
      Array.isArray(
        swingHighs
      )
        ? swingHighs
        : [],
      Array.isArray(
        swingLows
      )
        ? swingLows
        : [],
      config
    );

  if (
    !dealingRange ||
    price === null
  ) {
    return {
      dealingRange,

      currentPrice: price,

      currentZone:
        "EQUILIBRIUM",

      currentPercent:
        dealingRange &&
        price !== null
          ? calculatePercentage(
              price,
              dealingRange.low,
              dealingRange.high
            )
          : null,

      distanceFromEquilibrium:
        dealingRange &&
        price !== null
          ? price -
            dealingRange.equilibrium
          : null,

      premiumHigh:
        dealingRange?.high ??
        null,

      equilibrium:
        dealingRange?.equilibrium ??
        null,

      discountLow:
        dealingRange?.low ??
        null,

      ote:
        dealingRange
          ? calculateOTE(
              dealingRange,
              config
            )
          : null,

      bias: "NEUTRAL",

      isInPremium: false,
      isInDiscount: false,
      isAtEquilibrium: true,
    };
  }

  const rawPercent =
    calculatePercentage(
      price,
      dealingRange.low,
      dealingRange.high
    );

  const currentPercent =
    clamp(
      rawPercent,
      0,
      100
    );

  const currentZone =
    determineZone(
      currentPercent,
      config
    );

  const bias =
    determineBias(
      currentZone
    );

  const distanceFromEquilibrium =
    price -
    dealingRange.equilibrium;

  return {
    dealingRange,

    currentPrice: price,

    currentZone,

    currentPercent,

    distanceFromEquilibrium,

    premiumHigh:
      dealingRange.high,

    equilibrium:
      dealingRange.equilibrium,

    discountLow:
      dealingRange.low,

    ote:
      calculateOTE(
        dealingRange,
        config
      ),

    bias,

    isInPremium:
      currentZone ===
      "PREMIUM",

    isInDiscount:
      currentZone ===
      "DISCOUNT",

    isAtEquilibrium:
      currentZone ===
      "EQUILIBRIUM",
  };
}

export function getCurrentMarketZone(
  candles: SwingCandle[],
  swingHighs: SwingPoint[],
  swingLows: SwingPoint[],
  currentPrice?: number,
  options: PremiumDiscountOptions = {}
): MarketZone {
  return analyzePremiumDiscount(
    candles,
    swingHighs,
    swingLows,
    currentPrice,
    options
  ).currentZone;
}

export function getDealingRange(
  candles: SwingCandle[],
  swingHighs: SwingPoint[],
  swingLows: SwingPoint[],
  options: PremiumDiscountOptions = {}
): DealingRange | null {
  return analyzePremiumDiscount(
    candles,
    swingHighs,
    swingLows,
    undefined,
    options
  ).dealingRange;
}

export function getOTEZone(
  candles: SwingCandle[],
  swingHighs: SwingPoint[],
  swingLows: SwingPoint[],
  options: PremiumDiscountOptions = {}
): OTEZone | null {
  return analyzePremiumDiscount(
    candles,
    swingHighs,
    swingLows,
    undefined,
    options
  ).ote;
}

export function isPriceInDiscount(
  candles: SwingCandle[],
  swingHighs: SwingPoint[],
  swingLows: SwingPoint[],
  currentPrice?: number,
  options: PremiumDiscountOptions = {}
): boolean {
  return (
    analyzePremiumDiscount(
      candles,
      swingHighs,
      swingLows,
      currentPrice,
      options
    ).currentZone ===
    "DISCOUNT"
  );
}

export function isPriceInPremium(
  candles: SwingCandle[],
  swingHighs: SwingPoint[],
  swingLows: SwingPoint[],
  currentPrice?: number,
  options: PremiumDiscountOptions = {}
): boolean {
  return (
    analyzePremiumDiscount(
      candles,
      swingHighs,
      swingLows,
      currentPrice,
      options
    ).currentZone ===
    "PREMIUM"
  );
}
