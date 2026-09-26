import {
  SwingCandle,
  SwingPoint,
} from "./swings";

export type LiquidityType =
  | "BSL"
  | "SSL";

export type LiquiditySource =
  | "SWING"
  | "EQUAL_LEVEL"
  | "PREVIOUS_DAY"
  | "PREVIOUS_WEEK";

export type EqualLevelType =
  | "EQH"
  | "EQL";

export interface LiquidityLevel {
  type: LiquidityType;
  source: LiquiditySource;

  price: number;
  datetime: string;

  strength: "WEAK" | "MODERATE" | "STRONG";

  swingIndex: number | null;

  referenceCount: number;

  referencePrices: number[];

  equalLevelType: EqualLevelType | null;
}

export interface EqualLevel {
  type: EqualLevelType;

  price: number;

  datetime: string;

  referenceCount: number;

  referencePrices: number[];

  swingIndices: number[];

  tolerancePercent: number;
}

export interface PreviousPeriodLiquidity {
  previousDayHigh: LiquidityLevel | null;
  previousDayLow: LiquidityLevel | null;

  previousWeekHigh: LiquidityLevel | null;
  previousWeekLow: LiquidityLevel | null;
}

export interface LiquidityAnalysis {
  buySide: LiquidityLevel[];
  sellSide: LiquidityLevel[];

  equalHighs: EqualLevel[];
  equalLows: EqualLevel[];

  previousDayHigh: LiquidityLevel | null;
  previousDayLow: LiquidityLevel | null;

  previousWeekHigh: LiquidityLevel | null;
  previousWeekLow: LiquidityLevel | null;

  nearestBuySide: LiquidityLevel | null;
  nearestSellSide: LiquidityLevel | null;

  highestBuySide: LiquidityLevel | null;
  lowestSellSide: LiquidityLevel | null;
}

export interface LiquidityOptions {
  equalLevelTolerancePercent?: number;
  minimumEqualReferences?: number;
  maxLevels?: number;
  maxEqualLevels?: number;
}

const DEFAULT_OPTIONS: Required<LiquidityOptions> = {
  equalLevelTolerancePercent: 0.06,
  minimumEqualReferences: 2,
  maxLevels: 50,
  maxEqualLevels: 20,
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

function isValidSwing(
  swing: SwingPoint
): boolean {
  return (
    Boolean(swing) &&
    Number.isFinite(swing.price) &&
    Number.isFinite(swing.index) &&
    Boolean(swing.datetime)
  );
}

function getLiquidityStrength(
  referenceCount: number,
  source: LiquiditySource
): "WEAK" | "MODERATE" | "STRONG" {
  if (
    source === "PREVIOUS_DAY" ||
    source === "PREVIOUS_WEEK"
  ) {
    return "STRONG";
  }

  if (referenceCount >= 3) {
    return "STRONG";
  }

  if (referenceCount === 2) {
    return "MODERATE";
  }

  return "WEAK";
}

function pricesAreEqual(
  priceA: number,
  priceB: number,
  tolerancePercent: number
): boolean {
  if (
    !Number.isFinite(priceA) ||
    !Number.isFinite(priceB) ||
    priceB === 0
  ) {
    return false;
  }

  const differencePercent =
    (Math.abs(priceA - priceB) /
      Math.abs(priceB)) *
    100;

  return (
    differencePercent <=
    tolerancePercent
  );
}

function calculateAveragePrice(
  prices: number[]
): number {
  if (!prices.length) {
    return 0;
  }

  const total = prices.reduce(
    (sum, price) => sum + price,
    0
  );

  return total / prices.length;
}

function getMostRecentDatetime(
  swings: SwingPoint[]
): string {
  if (!swings.length) {
    return "";
  }

  const sorted = [...swings].sort(
    (a, b) =>
      a.index - b.index
  );

  return (
    sorted[sorted.length - 1]
      ?.datetime ?? ""
  );
}

function clusterEqualLevels(
  swings: SwingPoint[],
  type: EqualLevelType,
  tolerancePercent: number,
  minimumReferences: number,
  maxLevels: number
): EqualLevel[] {
  const validSwings =
    swings
      .filter(isValidSwing)
      .sort(
        (a, b) =>
          a.index - b.index
      );

  const clusters: SwingPoint[][] = [];

  for (const swing of validSwings) {
    let matchingCluster:
      | SwingPoint[]
      | null = null;

    for (const cluster of clusters) {
      const clusterPrice =
        calculateAveragePrice(
          cluster.map(
            (item) => item.price
          )
        );

      if (
        pricesAreEqual(
          swing.price,
          clusterPrice,
          tolerancePercent
        )
      ) {
        matchingCluster = cluster;
        break;
      }
    }

    if (matchingCluster) {
      matchingCluster.push(swing);
    } else {
      clusters.push([swing]);
    }
  }

  const equalLevels: EqualLevel[] = [];

  for (const cluster of clusters) {
    if (
      cluster.length <
      minimumReferences
    ) {
      continue;
    }

    const prices = cluster.map(
      (swing) => swing.price
    );

    const averagePrice =
      calculateAveragePrice(prices);

    const latestSwing =
      cluster
        .slice()
        .sort(
          (a, b) =>
            a.index - b.index
        )
        .at(-1);

    if (!latestSwing) {
      continue;
    }

    equalLevels.push({
      type,
      price: averagePrice,
      datetime:
        latestSwing.datetime,
      referenceCount:
        cluster.length,
      referencePrices: prices,
      swingIndices: cluster.map(
        (swing) => swing.index
      ),
      tolerancePercent,
    });
  }

  return equalLevels
    .sort(
      (a, b) =>
        b.referenceCount -
        a.referenceCount
    )
    .slice(0, maxLevels);
}

function createSwingLiquidity(
  swing: SwingPoint,
  type: LiquidityType
): LiquidityLevel {
  return {
    type,
    source: "SWING",
    price: swing.price,
    datetime: swing.datetime,
    strength: getLiquidityStrength(
      1,
      "SWING"
    ),
    swingIndex: swing.index,
    referenceCount: 1,
    referencePrices: [
      swing.price,
    ],
    equalLevelType: null,
  };
}

function createEqualLiquidity(
  equalLevel: EqualLevel
): LiquidityLevel {
  const liquidityType: LiquidityType =
    equalLevel.type === "EQH"
      ? "BSL"
      : "SSL";

  return {
    type: liquidityType,
    source: "EQUAL_LEVEL",
    price: equalLevel.price,
    datetime: equalLevel.datetime,
    strength: getLiquidityStrength(
      equalLevel.referenceCount,
      "EQUAL_LEVEL"
    ),
    swingIndex:
      equalLevel.swingIndices.at(
        -1
      ) ?? null,
    referenceCount:
      equalLevel.referenceCount,
    referencePrices:
      equalLevel.referencePrices,
    equalLevelType:
      equalLevel.type,
  };
}

function getPreviousDayHigh(
  dailyCandles: SwingCandle[]
): LiquidityLevel | null {
  if (
    !Array.isArray(dailyCandles) ||
    dailyCandles.length < 2
  ) {
    return null;
  }

  const validCandles =
    dailyCandles.filter(
      isValidCandle
    );

  if (validCandles.length < 2) {
    return null;
  }

  const previousDay =
    validCandles[
      validCandles.length - 2
    ];

  if (!previousDay) {
    return null;
  }

  return {
    type: "BSL",
    source: "PREVIOUS_DAY",
    price: previousDay.high,
    datetime:
      previousDay.datetime,
    strength: "STRONG",
    swingIndex: null,
    referenceCount: 1,
    referencePrices: [
      previousDay.high,
    ],
    equalLevelType: null,
  };
}

function getPreviousDayLow(
  dailyCandles: SwingCandle[]
): LiquidityLevel | null {
  if (
    !Array.isArray(dailyCandles) ||
    dailyCandles.length < 2
  ) {
    return null;
  }

  const validCandles =
    dailyCandles.filter(
      isValidCandle
    );

  if (validCandles.length < 2) {
    return null;
  }

  const previousDay =
    validCandles[
      validCandles.length - 2
    ];

  if (!previousDay) {
    return null;
  }

  return {
    type: "SSL",
    source: "PREVIOUS_DAY",
    price: previousDay.low,
    datetime:
      previousDay.datetime,
    strength: "STRONG",
    swingIndex: null,
    referenceCount: 1,
    referencePrices: [
      previousDay.low,
    ],
    equalLevelType: null,
  };
}

function getPreviousWeekHigh(
  dailyCandles: SwingCandle[]
): LiquidityLevel | null {
  if (
    !Array.isArray(dailyCandles) ||
    dailyCandles.length < 8
  ) {
    return null;
  }

  const validCandles =
    dailyCandles.filter(
      isValidCandle
    );

  if (validCandles.length < 8) {
    return null;
  }

  const currentDayIndex =
    validCandles.length - 1;

  const currentDay =
    validCandles[currentDayIndex];

  if (!currentDay) {
    return null;
  }

  const currentDate =
    new Date(currentDay.datetime);

  if (
    Number.isNaN(
      currentDate.getTime()
    )
  ) {
    return null;
  }

  const currentDayOfWeek =
    currentDate.getUTCDay();

  const daysSinceMonday =
    currentDayOfWeek === 0
      ? 6
      : currentDayOfWeek - 1;

  const currentWeekMonday =
    new Date(currentDate);

  currentWeekMonday.setUTCDate(
    currentWeekMonday.getUTCDate() -
      daysSinceMonday
  );

  currentWeekMonday.setUTCHours(
    0,
    0,
    0,
    0
  );

  const previousWeekStart =
    new Date(currentWeekMonday);

  previousWeekStart.setUTCDate(
    previousWeekStart.getUTCDate() -
      7
  );

  const previousWeekEnd =
    new Date(currentWeekMonday);

  previousWeekEnd.setUTCMilliseconds(
    -1
  );

  const previousWeekCandles =
    validCandles.filter(
      (candle) => {
        const date =
          new Date(
            candle.datetime
          );

        return (
          date >=
            previousWeekStart &&
          date <=
            previousWeekEnd
        );
      }
    );

  if (
    !previousWeekCandles.length
  ) {
    return null;
  }

  const high = Math.max(
    ...previousWeekCandles.map(
      (candle) => candle.high
    )
  );

  const referenceCandle =
    previousWeekCandles[
      previousWeekCandles.length - 1
    ];

  return {
    type: "BSL",
    source: "PREVIOUS_WEEK",
    price: high,
    datetime:
      referenceCandle?.datetime ?? "",
    strength: "STRONG",
    swingIndex: null,
    referenceCount:
      previousWeekCandles.length,
    referencePrices:
      previousWeekCandles.map(
        (candle) => candle.high
      ),
    equalLevelType: null,
  };
}

function getPreviousWeekLow(
  dailyCandles: SwingCandle[]
): LiquidityLevel | null {
  if (
    !Array.isArray(dailyCandles) ||
    dailyCandles.length < 8
  ) {
    return null;
  }

  const validCandles =
    dailyCandles.filter(
      isValidCandle
    );

  if (validCandles.length < 8) {
    return null;
  }

  const currentDay =
    validCandles[
      validCandles.length - 1
    ];

  if (!currentDay) {
    return null;
  }

  const currentDate =
    new Date(currentDay.datetime);

  if (
    Number.isNaN(
      currentDate.getTime()
    )
  ) {
    return null;
  }

  const currentDayOfWeek =
    currentDate.getUTCDay();

  const daysSinceMonday =
    currentDayOfWeek === 0
      ? 6
      : currentDayOfWeek - 1;

  const currentWeekMonday =
    new Date(currentDate);

  currentWeekMonday.setUTCDate(
    currentWeekMonday.getUTCDate() -
      daysSinceMonday
  );

  currentWeekMonday.setUTCHours(
    0,
    0,
    0,
    0
  );

  const previousWeekStart =
    new Date(currentWeekMonday);

  previousWeekStart.setUTCDate(
    previousWeekStart.getUTCDate() -
      7
  );

  const previousWeekEnd =
    new Date(currentWeekMonday);

  previousWeekEnd.setUTCMilliseconds(
    -1
  );

  const previousWeekCandles =
    validCandles.filter(
      (candle) => {
        const date =
          new Date(
            candle.datetime
          );

        return (
          date >=
            previousWeekStart &&
          date <=
            previousWeekEnd
        );
      }
    );

  if (
    !previousWeekCandles.length
  ) {
    return null;
  }

  const low = Math.min(
    ...previousWeekCandles.map(
      (candle) => candle.low
    )
  );

  const referenceCandle =
    previousWeekCandles[
      previousWeekCandles.length - 1
    ];

  return {
    type: "SSL",
    source: "PREVIOUS_WEEK",
    price: low,
    datetime:
      referenceCandle?.datetime ?? "",
    strength: "STRONG",
    swingIndex: null,
    referenceCount:
      previousWeekCandles.length,
    referencePrices:
      previousWeekCandles.map(
        (candle) => candle.low
      ),
    equalLevelType: null,
  };
}

function sortLiquidityLevels(
  levels: LiquidityLevel[]
): LiquidityLevel[] {
  return [...levels].sort(
    (a, b) => b.price - a.price
  );
}

function getNearestBuySide(
  levels: LiquidityLevel[],
  currentPrice: number
): LiquidityLevel | null {
  const candidates =
    levels
      .filter(
        (level) =>
          level.price > currentPrice
      )
      .sort(
        (a, b) =>
          a.price - b.price
      );

  return candidates[0] ?? null;
}

function getNearestSellSide(
  levels: LiquidityLevel[],
  currentPrice: number
): LiquidityLevel | null {
  const candidates =
    levels
      .filter(
        (level) =>
          level.price < currentPrice
      )
      .sort(
        (a, b) =>
          b.price - a.price
      );

  return candidates[0] ?? null;
}

function deduplicateLiquidity(
  levels: LiquidityLevel[],
  tolerancePercent: number
): LiquidityLevel[] {
  const result: LiquidityLevel[] = [];

  const sorted =
    [...levels].sort(
      (a, b) =>
        a.price - b.price
    );

  for (const level of sorted) {
    const existing =
      result.find(
        (item) =>
          item.type === level.type &&
          pricesAreEqual(
            item.price,
            level.price,
            tolerancePercent
          )
      );

    if (!existing) {
      result.push(level);
      continue;
    }

    if (
      level.strength ===
        "STRONG" &&
      existing.strength !==
        "STRONG"
    ) {
      const index =
        result.indexOf(existing);

      result[index] = level;

      continue;
    }

    if (
      level.referenceCount >
      existing.referenceCount
    ) {
      const index =
        result.indexOf(existing);

      result[index] = {
        ...existing,
        ...level,
        referenceCount:
          level.referenceCount,
        referencePrices:
          level.referencePrices,
      };
    }
  }

  return result;
}

export function analyzeLiquidity(
  candles: SwingCandle[],
  swingHighs: SwingPoint[],
  swingLows: SwingPoint[],
  currentPrice: number,
  dailyCandles: SwingCandle[] = [],
  options: LiquidityOptions = {}
): LiquidityAnalysis {
  const config = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

  const validHighs =
    swingHighs.filter(
      (swing) =>
        swing.type === "HIGH" &&
        isValidSwing(swing)
    );

  const validLows =
    swingLows.filter(
      (swing) =>
        swing.type === "LOW" &&
        isValidSwing(swing)
    );

  const equalHighs =
    clusterEqualLevels(
      validHighs,
      "EQH",
      config.equalLevelTolerancePercent,
      config.minimumEqualReferences,
      config.maxEqualLevels
    );

  const equalLows =
    clusterEqualLevels(
      validLows,
      "EQL",
      config.equalLevelTolerancePercent,
      config.minimumEqualReferences,
      config.maxEqualLevels
    );

  const buySide: LiquidityLevel[] =
    [];

  const sellSide: LiquidityLevel[] =
    [];

  /*
   * Every confirmed swing high represents
   * potential buy-side liquidity.
   */
  for (const swing of validHighs) {
    buySide.push(
      createSwingLiquidity(
        swing,
        "BSL"
      )
    );
  }

  /*
   * Every confirmed swing low represents
   * potential sell-side liquidity.
   */
  for (const swing of validLows) {
    sellSide.push(
      createSwingLiquidity(
        swing,
        "SSL"
      )
    );
  }

  /*
   * Equal highs create concentrated
   * buy-side liquidity.
   */
  for (const equalHigh of equalHighs) {
    buySide.push(
      createEqualLiquidity(
        equalHigh
      )
    );
  }

  /*
   * Equal lows create concentrated
   * sell-side liquidity.
   */
  for (const equalLow of equalLows) {
    sellSide.push(
      createEqualLiquidity(
        equalLow
      )
    );
  }

  const previousDayHigh =
    getPreviousDayHigh(
      dailyCandles
    );

  const previousDayLow =
    getPreviousDayLow(
      dailyCandles
    );

  const previousWeekHigh =
    getPreviousWeekHigh(
      dailyCandles
    );

  const previousWeekLow =
    getPreviousWeekLow(
      dailyCandles
    );

  if (previousDayHigh) {
    buySide.push(previousDayHigh);
  }

  if (previousDayLow) {
    sellSide.push(previousDayLow);
  }

  if (previousWeekHigh) {
    buySide.push(previousWeekHigh);
  }

  if (previousWeekLow) {
    sellSide.push(previousWeekLow);
  }

  const uniqueBuySide =
    deduplicateLiquidity(
      buySide,
      config.equalLevelTolerancePercent
    );

  const uniqueSellSide =
    deduplicateLiquidity(
      sellSide,
      config.equalLevelTolerancePercent
    );

  const limitedBuySide =
    sortLiquidityLevels(
      uniqueBuySide
    ).slice(0, config.maxLevels);

  const limitedSellSide =
    sortLiquidityLevels(
      uniqueSellSide
    ).slice(0, config.maxLevels);

  const safeCurrentPrice =
    Number.isFinite(currentPrice)
      ? currentPrice
      : 0;

  const nearestBuySide =
    safeCurrentPrice > 0
      ? getNearestBuySide(
          limitedBuySide,
          safeCurrentPrice
        )
      : null;

  const nearestSellSide =
    safeCurrentPrice > 0
      ? getNearestSellSide(
          limitedSellSide,
          safeCurrentPrice
        )
      : null;

  const highestBuySide =
    limitedBuySide.length
      ? limitedBuySide.reduce(
          (highest, level) =>
            level.price >
            highest.price
              ? level
              : highest
        )
      : null;

  const lowestSellSide =
    limitedSellSide.length
      ? limitedSellSide.reduce(
          (lowest, level) =>
            level.price <
            lowest.price
              ? level
              : lowest
        )
      : null;

  return {
    buySide: limitedBuySide,
    sellSide: limitedSellSide,

    equalHighs,
    equalLows,

    previousDayHigh,
    previousDayLow,

    previousWeekHigh,
    previousWeekLow,

    nearestBuySide,
    nearestSellSide,

    highestBuySide,
    lowestSellSide,
  };
}

export function getBuySideLiquidity(
  analysis: LiquidityAnalysis
): LiquidityLevel[] {
  return analysis.buySide;
}

export function getSellSideLiquidity(
  analysis: LiquidityAnalysis
): LiquidityLevel[] {
  return analysis.sellSide;
}

export function getEqualHighs(
  analysis: LiquidityAnalysis
): EqualLevel[] {
  return analysis.equalHighs;
}

export function getEqualLows(
  analysis: LiquidityAnalysis
): EqualLevel[] {
  return analysis.equalLows;
}

export function getNearestBuySideLiquidity(
  analysis: LiquidityAnalysis
): LiquidityLevel | null {
  return analysis.nearestBuySide;
}

export function getNearestSellSideLiquidity(
  analysis: LiquidityAnalysis
): LiquidityLevel | null {
  return analysis.nearestSellSide;
  }
