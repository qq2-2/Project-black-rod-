export type SwingType = "HIGH" | "LOW";

export type SwingStrength =
  | "WEAK"
  | "MODERATE"
  | "STRONG";

export interface SwingCandle {
  datetime: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number | null;
}

export interface SwingPoint {
  type: SwingType;
  index: number;
  datetime: string;
  price: number;

  strength: SwingStrength;

  leftBars: number;
  rightBars: number;

  candle: {
    open: number;
    high: number;
    low: number;
    close: number;
  };
}

export interface SwingDetectionOptions {
  leftBars?: number;
  rightBars?: number;
  strengthLookback?: number;
  maxSwings?: number;
}

export interface SwingAnalysis {
  highs: SwingPoint[];
  lows: SwingPoint[];
  all: SwingPoint[];

  latestHigh: SwingPoint | null;
  latestLow: SwingPoint | null;

  previousHigh: SwingPoint | null;
  previousLow: SwingPoint | null;
}

const DEFAULT_OPTIONS: Required<SwingDetectionOptions> = {
  leftBars: 2,
  rightBars: 2,
  strengthLookback: 10,
  maxSwings: 100,
};

function isValidCandle(
  candle: SwingCandle
): boolean {
  return (
    Boolean(candle) &&
    Number.isFinite(candle.open) &&
    Number.isFinite(candle.high) &&
    Number.isFinite(candle.low) &&
    Number.isFinite(candle.close) &&
    Boolean(candle.datetime)
  );
}

function isSwingHigh(
  candles: SwingCandle[],
  index: number,
  leftBars: number,
  rightBars: number
): boolean {
  const current = candles[index];

  if (!current) {
    return false;
  }

  const start = index - leftBars;
  const end = index + rightBars;

  if (start < 0 || end >= candles.length) {
    return false;
  }

  for (
    let i = start;
    i <= end;
    i += 1
  ) {
    if (i === index) {
      continue;
    }

    const comparisonCandle = candles[i];

    if (
      comparisonCandle.high >=
      current.high
    ) {
      return false;
    }
  }

  return true;
}

function isSwingLow(
  candles: SwingCandle[],
  index: number,
  leftBars: number,
  rightBars: number
): boolean {
  const current = candles[index];

  if (!current) {
    return false;
  }

  const start = index - leftBars;
  const end = index + rightBars;

  if (start < 0 || end >= candles.length) {
    return false;
  }

  for (
    let i = start;
    i <= end;
    i += 1
  ) {
    if (i === index) {
      continue;
    }

    const comparisonCandle = candles[i];

    if (
      comparisonCandle.low <=
      current.low
    ) {
      return false;
    }
  }

  return true;
}

function calculateAverageRange(
  candles: SwingCandle[],
  startIndex: number,
  lookback: number
): number {
  const start = Math.max(
    0,
    startIndex - lookback
  );

  const ranges: number[] = [];

  for (
    let i = start;
    i < startIndex;
    i += 1
  ) {
    const candle = candles[i];

    if (!candle) {
      continue;
    }

    const range =
      candle.high - candle.low;

    if (
      Number.isFinite(range) &&
      range > 0
    ) {
      ranges.push(range);
    }
  }

  if (!ranges.length) {
    return 0;
  }

  const total = ranges.reduce(
    (sum, value) => sum + value,
    0
  );

  return total / ranges.length;
}

function calculateSwingStrength(
  candles: SwingCandle[],
  index: number,
  type: SwingType,
  lookback: number
): SwingStrength {
  const candle = candles[index];

  if (!candle) {
    return "WEAK";
  }

  const averageRange =
    calculateAverageRange(
      candles,
      index,
      lookback
    );

  if (
    averageRange <= 0 ||
    !Number.isFinite(averageRange)
  ) {
    return "WEAK";
  }

  const swingRange =
    candle.high - candle.low;

  const surroundingStart =
    Math.max(0, index - lookback);

  const surroundingEnd =
    Math.min(
      candles.length - 1,
      index + lookback
    );

  let surroundingExtreme: number;

  if (type === "HIGH") {
    surroundingExtreme = Number.NEGATIVE_INFINITY;

    for (
      let i = surroundingStart;
      i <= surroundingEnd;
      i += 1
    ) {
      if (i === index) {
        continue;
      }

      const high = candles[i]?.high;

      if (
        Number.isFinite(high) &&
        high > surroundingExtreme
      ) {
        surroundingExtreme = high;
      }
    }

    if (
      !Number.isFinite(
        surroundingExtreme
      )
    ) {
      return "WEAK";
    }
  } else {
    surroundingExtreme = Number.POSITIVE_INFINITY;

    for (
      let i = surroundingStart;
      i <= surroundingEnd;
      i += 1
    ) {
      if (i === index) {
        continue;
      }

      const low = candles[i]?.low;

      if (
        Number.isFinite(low) &&
        low < surroundingExtreme
      ) {
        surroundingExtreme = low;
      }
    }

    if (
      !Number.isFinite(
        surroundingExtreme
      )
    ) {
      return "WEAK";
    }
  }

  const excursion =
    type === "HIGH"
      ? candle.high - surroundingExtreme
      : surroundingExtreme - candle.low;

  const rangeScore =
    swingRange / averageRange;

  const excursionScore =
    excursion / averageRange;

  const strengthScore =
    rangeScore * 0.4 +
    excursionScore * 0.6;

  if (strengthScore >= 2.5) {
    return "STRONG";
  }

  if (strengthScore >= 1.25) {
    return "MODERATE";
  }

  return "WEAK";
}

function createSwingPoint(
  candles: SwingCandle[],
  index: number,
  type: SwingType,
  leftBars: number,
  rightBars: number,
  strengthLookback: number
): SwingPoint {
  const candle = candles[index];

  const strength =
    calculateSwingStrength(
      candles,
      index,
      type,
      strengthLookback
    );

  return {
    type,
    index,
    datetime: candle.datetime,
    price:
      type === "HIGH"
        ? candle.high
        : candle.low,
    strength,
    leftBars,
    rightBars,
    candle: {
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
    },
  };
}

function deduplicateSwings(
  swings: SwingPoint[]
): SwingPoint[] {
  const result: SwingPoint[] = [];

  for (const swing of swings) {
    const previous =
      result[result.length - 1];

    if (!previous) {
      result.push(swing);
      continue;
    }

    if (
      previous.index === swing.index &&
      previous.type === swing.type
    ) {
      if (
        swing.strength === "STRONG" &&
        previous.strength !== "STRONG"
      ) {
        result[result.length - 1] = swing;
      }

      continue;
    }

    result.push(swing);
  }

  return result;
}

export function detectSwingHighs(
  candles: SwingCandle[],
  options: SwingDetectionOptions = {}
): SwingPoint[] {
  const config = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

  if (
    !Array.isArray(candles) ||
    candles.length === 0
  ) {
    return [];
  }

  const validCandles =
    candles.filter(isValidCandle);

  if (
    validCandles.length <
    config.leftBars +
      config.rightBars +
      1
  ) {
    return [];
  }

  const swings: SwingPoint[] = [];

  /*
   * IMPORTANT:
   *
   * We intentionally stop at:
   *
   * candles.length - rightBars
   *
   * because the final rightBars candles are not
   * fully confirmed yet.
   *
   * Example:
   * rightBars = 2
   *
   * A candle needs two candles AFTER it to
   * confirm that it is actually a swing.
   */
  const lastConfirmedIndex =
    validCandles.length -
    config.rightBars -
    1;

  for (
    let index = config.leftBars;
    index <= lastConfirmedIndex;
    index += 1
  ) {
    if (
      isSwingHigh(
        validCandles,
        index,
        config.leftBars,
        config.rightBars
      )
    ) {
      swings.push(
        createSwingPoint(
          validCandles,
          index,
          "HIGH",
          config.leftBars,
          config.rightBars,
          config.strengthLookback
        )
      );
    }
  }

  const deduplicated =
    deduplicateSwings(swings);

  return deduplicated.slice(
    -config.maxSwings
  );
}

export function detectSwingLows(
  candles: SwingCandle[],
  options: SwingDetectionOptions = {}
): SwingPoint[] {
  const config = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

  if (
    !Array.isArray(candles) ||
    candles.length === 0
  ) {
    return [];
  }

  const validCandles =
    candles.filter(isValidCandle);

  if (
    validCandles.length <
    config.leftBars +
      config.rightBars +
      1
  ) {
    return [];
  }

  const swings: SwingPoint[] = [];

  const lastConfirmedIndex =
    validCandles.length -
    config.rightBars -
    1;

  for (
    let index = config.leftBars;
    index <= lastConfirmedIndex;
    index += 1
  ) {
    if (
      isSwingLow(
        validCandles,
        index,
        config.leftBars,
        config.rightBars
      )
    ) {
      swings.push(
        createSwingPoint(
          validCandles,
          index,
          "LOW",
          config.leftBars,
          config.rightBars,
          config.strengthLookback
        )
      );
    }
  }

  const deduplicated =
    deduplicateSwings(swings);

  return deduplicated.slice(
    -config.maxSwings
  );
}

export function detectSwings(
  candles: SwingCandle[],
  options: SwingDetectionOptions = {}
): SwingAnalysis {
  const config = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

  if (
    !Array.isArray(candles) ||
    candles.length === 0
  ) {
    return {
      highs: [],
      lows: [],
      all: [],
      latestHigh: null,
      latestLow: null,
      previousHigh: null,
      previousLow: null,
    };
  }

  const highs =
    detectSwingHighs(
      candles,
      config
    );

  const lows =
    detectSwingLows(
      candles,
      config
    );

  const all =
    [...highs, ...lows].sort(
      (a, b) => a.index - b.index
    );

  const latestHigh =
    highs.length > 0
      ? highs[highs.length - 1]
      : null;

  const latestLow =
    lows.length > 0
      ? lows[lows.length - 1]
      : null;

  const previousHigh =
    highs.length > 1
      ? highs[highs.length - 2]
      : null;

  const previousLow =
    lows.length > 1
      ? lows[lows.length - 2]
      : null;

  return {
    highs,
    lows,
    all,
    latestHigh,
    latestLow,
    previousHigh,
    previousLow,
  };
}

export function getLastSwingHigh(
  candles: SwingCandle[],
  options: SwingDetectionOptions = {}
): SwingPoint | null {
  const swings =
    detectSwingHighs(
      candles,
      options
    );

  return swings.length
    ? swings[swings.length - 1]
    : null;
}

export function getLastSwingLow(
  candles: SwingCandle[],
  options: SwingDetectionOptions = {}
): SwingPoint | null {
  const swings =
    detectSwingLows(
      candles,
      options
    );

  return swings.length
    ? swings[swings.length - 1]
    : null;
  }
