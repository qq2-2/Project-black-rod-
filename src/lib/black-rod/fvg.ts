import { SwingCandle } from "./swings";

export type FVGType =
  | "BULLISH"
  | "BEARISH";

export type FVGStatus =
  | "ACTIVE"
  | "PARTIALLY_MITIGATED"
  | "MITIGATED";

export interface FVGZone {
  index: number;
  datetime: string;

  type: FVGType;

  high: number;
  low: number;

  size: number;
  sizePercent: number;

  firstCandleIndex: number;
  middleCandleIndex: number;
  thirdCandleIndex: number;

  firstCandleDatetime: string;
  middleCandleDatetime: string;
  thirdCandleDatetime: string;

  middleCandleOpen: number;
  middleCandleHigh: number;
  middleCandleLow: number;
  middleCandleClose: number;

  status: FVGStatus;

  mitigationPercent: number;

  firstMitigationIndex: number | null;
  firstMitigationDatetime: string | null;

  fullyMitigatedIndex: number | null;
  fullyMitigatedDatetime: string | null;

  age: number;
}

export interface FVGAnalysis {
  zones: FVGZone[];

  bullishFVGs: FVGZone[];
  bearishFVGs: FVGZone[];

  activeBullishFVGs: FVGZone[];
  activeBearishFVGs: FVGZone[];

  latestBullish: FVGZone | null;
  latestBearish: FVGZone | null;

  nearestBullish: FVGZone | null;
  nearestBearish: FVGZone | null;
}

export interface FVGOptions {
  minimumGapPercent?: number;

  maxResults?: number;

  includeLastCandle?: boolean;

  mitigationMode?:
    | "TOUCH"
    | "CLOSE";
}

const DEFAULT_OPTIONS: Required<FVGOptions> = {
  minimumGapPercent: 0.0001,

  maxResults: 50,

  includeLastCandle: false,

  mitigationMode: "TOUCH",
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

function getAveragePrice(
  high: number,
  low: number
): number {
  return (high + low) / 2;
}

function getGapPercent(
  high: number,
  low: number
): number {
  const averagePrice =
    getAveragePrice(high, low);

  if (averagePrice <= 0) {
    return 0;
  }

  return (
    Math.abs(high - low) /
    averagePrice
  );
}

function candleTouchesZone(
  candle: SwingCandle,
  zoneHigh: number,
  zoneLow: number
): boolean {
  return (
    candle.high >= zoneLow &&
    candle.low <= zoneHigh
  );
}

function candleClosesThroughZone(
  candle: SwingCandle,
  type: FVGType,
  zoneHigh: number,
  zoneLow: number
): boolean {
  if (type === "BULLISH") {
    return candle.close <= zoneLow;
  }

  return candle.close >= zoneHigh;
}

function getMitigationPercent(
  candles: SwingCandle[],
  startIndex: number,
  endIndex: number,
  type: FVGType,
  zoneHigh: number,
  zoneLow: number
): {
  status: FVGStatus;
  mitigationPercent: number;
  firstMitigationIndex: number | null;
  fullyMitigatedIndex: number | null;
} {
  const gapSize = zoneHigh - zoneLow;

  if (gapSize <= 0) {
    return {
      status: "MITIGATED",
      mitigationPercent: 100,
      firstMitigationIndex: null,
      fullyMitigatedIndex: null,
    };
  }

  let maximumMitigation = 0;

  let firstMitigationIndex:
    | number
    | null = null;

  let fullyMitigatedIndex:
    | number
    | null = null;

  for (
    let i = startIndex;
    i <= endIndex;
    i += 1
  ) {
    const candle = candles[i];

    if (!isValidCandle(candle)) {
      continue;
    }

    let mitigationPercent = 0;

    if (type === "BULLISH") {
      if (candle.low <= zoneHigh) {
        const penetration =
          zoneHigh - candle.low;

        mitigationPercent =
          Math.min(
            100,
            Math.max(
              0,
              (penetration / gapSize) *
                100
            )
          );
      }
    } else {
      if (candle.high >= zoneLow) {
        const penetration =
          candle.high - zoneLow;

        mitigationPercent =
          Math.min(
            100,
            Math.max(
              0,
              (penetration / gapSize) *
                100
            )
          );
      }
    }

    if (
      mitigationPercent >
      maximumMitigation
    ) {
      maximumMitigation =
        mitigationPercent;
    }

    if (
      firstMitigationIndex === null &&
      mitigationPercent > 0
    ) {
      firstMitigationIndex = i;
    }

    if (
      fullyMitigatedIndex === null &&
      mitigationPercent >= 100
    ) {
      fullyMitigatedIndex = i;
      break;
    }
  }

  if (fullyMitigatedIndex !== null) {
    return {
      status: "MITIGATED",
      mitigationPercent: 100,
      firstMitigationIndex,
      fullyMitigatedIndex,
    };
  }

  if (maximumMitigation > 0) {
    return {
      status: "PARTIALLY_MITIGATED",
      mitigationPercent:
        maximumMitigation,
      firstMitigationIndex,
      fullyMitigatedIndex: null,
    };
  }

  return {
    status: "ACTIVE",
    mitigationPercent: 0,
    firstMitigationIndex: null,
    fullyMitigatedIndex: null,
  };
}

function detectBullishFVG(
  candles: SwingCandle[],
  index: number,
  options: Required<FVGOptions>
): FVGZone | null {
  if (index < 2) {
    return null;
  }

  const first = candles[index - 2];
  const middle = candles[index - 1];
  const third = candles[index];

  if (
    !isValidCandle(first) ||
    !isValidCandle(middle) ||
    !isValidCandle(third)
  ) {
    return null;
  }

  /*
   * Bullish FVG:
   *
   * Candle 1 high
   *       ↓
   *       ┌──────────────┐
   *       │     GAP      │
   *       └──────────────┘
   *       ↑
   * Candle 3 low
   *
   * Condition:
   *
   * Candle 3 low > Candle 1 high
   */

  if (
    third.low <= first.high
  ) {
    return null;
  }

  const zoneLow = first.high;
  const zoneHigh = third.low;

  const size =
    zoneHigh - zoneLow;

  const sizePercent =
    getGapPercent(
      zoneHigh,
      zoneLow
    );

  if (
    sizePercent <
    options.minimumGapPercent
  ) {
    return null;
  }

  const mitigation =
    getMitigationPercent(
      candles,
      index + 1,
      candles.length - 1,
      "BULLISH",
      zoneHigh,
      zoneLow
    );

  return {
    index,
    datetime: String(
      third.datetime
    ),

    type: "BULLISH",

    high: zoneHigh,
    low: zoneLow,

    size,
    sizePercent,

    firstCandleIndex:
      index - 2,

    middleCandleIndex:
      index - 1,

    thirdCandleIndex:
      index,

    firstCandleDatetime:
      String(first.datetime),

    middleCandleDatetime:
      String(middle.datetime),

    thirdCandleDatetime:
      String(third.datetime),

    middleCandleOpen:
      middle.open,

    middleCandleHigh:
      middle.high,

    middleCandleLow:
      middle.low,

    middleCandleClose:
      middle.close,

    status:
      mitigation.status,

    mitigationPercent:
      mitigation.mitigationPercent,

    firstMitigationIndex:
      mitigation.firstMitigationIndex,

    firstMitigationDatetime:
      mitigation.firstMitigationIndex !==
      null
        ? String(
            candles[
              mitigation
                .firstMitigationIndex
            ].datetime
          )
        : null,

    fullyMitigatedIndex:
      mitigation.fullyMitigatedIndex,

    fullyMitigatedDatetime:
      mitigation.fullyMitigatedIndex !==
      null
        ? String(
            candles[
              mitigation
                .fullyMitigatedIndex
            ].datetime
          )
        : null,

    age:
      candles.length -
      1 -
      index,
  };
}

function detectBearishFVG(
  candles: SwingCandle[],
  index: number,
  options: Required<FVGOptions>
): FVGZone | null {
  if (index < 2) {
    return null;
  }

  const first = candles[index - 2];
  const middle = candles[index - 1];
  const third = candles[index];

  if (
    !isValidCandle(first) ||
    !isValidCandle(middle) ||
    !isValidCandle(third)
  ) {
    return null;
  }

  /*
   * Bearish FVG:
   *
   * Candle 1 low
   *       ↑
   *       ┌──────────────┐
   *       │     GAP      │
   *       └──────────────┘
   *       ↓
   * Candle 3 high
   *
   * Condition:
   *
   * Candle 3 high < Candle 1 low
   */

  if (
    third.high >= first.low
  ) {
    return null;
  }

  const zoneHigh = first.low;
  const zoneLow = third.high;

  const size =
    zoneHigh - zoneLow;

  const sizePercent =
    getGapPercent(
      zoneHigh,
      zoneLow
    );

  if (
    sizePercent <
    options.minimumGapPercent
  ) {
    return null;
  }

  const mitigation =
    getMitigationPercent(
      candles,
      index + 1,
      candles.length - 1,
      "BEARISH",
      zoneHigh,
      zoneLow
    );

  return {
    index,
    datetime: String(
      third.datetime
    ),

    type: "BEARISH",

    high: zoneHigh,
    low: zoneLow,

    size,
    sizePercent,

    firstCandleIndex:
      index - 2,

    middleCandleIndex:
      index - 1,

    thirdCandleIndex:
      index,

    firstCandleDatetime:
      String(first.datetime),

    middleCandleDatetime:
      String(middle.datetime),

    thirdCandleDatetime:
      String(third.datetime),

    middleCandleOpen:
      middle.open,

    middleCandleHigh:
      middle.high,

    middleCandleLow:
      middle.low,

    middleCandleClose:
      middle.close,

    status:
      mitigation.status,

    mitigationPercent:
      mitigation.mitigationPercent,

    firstMitigationIndex:
      mitigation.firstMitigationIndex,

    firstMitigationDatetime:
      mitigation.firstMitigationIndex !==
      null
        ? String(
            candles[
              mitigation
                .firstMitigationIndex
            ].datetime
          )
        : null,

    fullyMitigatedIndex:
      mitigation.fullyMitigatedIndex,

    fullyMitigatedDatetime:
      mitigation.fullyMitigatedIndex !==
      null
        ? String(
            candles[
              mitigation
                .fullyMitigatedIndex
            ].datetime
          )
        : null,

    age:
      candles.length -
      1 -
      index,
  };
}

function deduplicateFVGs(
  zones: FVGZone[]
): FVGZone[] {
  const seen = new Set<string>();
  const result: FVGZone[] = [];

  for (const zone of zones) {
    const key = [
      zone.type,
      zone.index,
      zone.high.toFixed(6),
      zone.low.toFixed(6),
    ].join("|");

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(zone);
  }

  return result;
}

function sortNewestFirst(
  zones: FVGZone[]
): FVGZone[] {
  return [...zones].sort(
    (a, b) =>
      b.index - a.index
  );
}

function getNearestBullish(
  zones: FVGZone[],
  currentPrice: number
): FVGZone | null {
  const active = zones.filter(
    (zone) =>
      zone.type === "BULLISH" &&
      zone.status !== "MITIGATED"
  );

  if (!active.length) {
    return null;
  }

  /*
   * Bullish FVGs are below price.
   * Prefer the nearest valid zone beneath
   * current price.
   */

  const belowPrice = active.filter(
    (zone) =>
      zone.high <= currentPrice
  );

  if (belowPrice.length) {
    return [...belowPrice].sort(
      (a, b) =>
        currentPrice -
        a.high -
        (currentPrice - b.high)
    )[0];
  }

  return [...active].sort(
    (a, b) =>
      Math.abs(
        currentPrice -
          getAveragePrice(
            a.high,
            a.low
          )
      ) -
      Math.abs(
        currentPrice -
          getAveragePrice(
            b.high,
            b.low
          )
      )
  )[0];
}

function getNearestBearish(
  zones: FVGZone[],
  currentPrice: number
): FVGZone | null {
  const active = zones.filter(
    (zone) =>
      zone.type === "BEARISH" &&
      zone.status !== "MITIGATED"
  );

  if (!active.length) {
    return null;
  }

  /*
   * Bearish FVGs are above price.
   * Prefer the nearest valid zone above
   * current price.
   */

  const abovePrice = active.filter(
    (zone) =>
      zone.low >= currentPrice
  );

  if (abovePrice.length) {
    return [...abovePrice].sort(
      (a, b) =>
        a.low -
        currentPrice -
        (b.low - currentPrice)
    )[0];
  }

  return [...active].sort(
    (a, b) =>
      Math.abs(
        currentPrice -
          getAveragePrice(
            a.high,
            a.low
          )
      ) -
      Math.abs(
        currentPrice -
          getAveragePrice(
            b.high,
            b.low
          )
      )
  )[0];
}

export function detectFVGs(
  candles: SwingCandle[],
  currentPrice?: number,
  options: FVGOptions = {}
): FVGAnalysis {
  const config: Required<FVGOptions> = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

  if (
    !Array.isArray(candles) ||
    candles.length < 3
  ) {
    return {
      zones: [],
      bullishFVGs: [],
      bearishFVGs: [],
      activeBullishFVGs: [],
      activeBearishFVGs: [],
      latestBullish: null,
      latestBearish: null,
      nearestBullish: null,
      nearestBearish: null,
    };
  }

  const lastIndex =
    config.includeLastCandle
      ? candles.length - 1
      : candles.length - 2;

  const zones: FVGZone[] = [];

  for (
    let i = 2;
    i <= lastIndex;
    i += 1
  ) {
    const bullish =
      detectBullishFVG(
        candles,
        i,
        config
      );

    if (bullish) {
      zones.push(bullish);
    }

    const bearish =
      detectBearishFVG(
        candles,
        i,
        config
      );

    if (bearish) {
      zones.push(bearish);
    }

    if (
      zones.length >=
      config.maxResults
    ) {
      break;
    }
  }

  const uniqueZones =
    deduplicateFVGs(zones);

  const sortedZones =
    sortNewestFirst(uniqueZones);

  const bullishFVGs =
    sortedZones.filter(
      (zone) =>
        zone.type === "BULLISH"
    );

  const bearishFVGs =
    sortedZones.filter(
      (zone) =>
        zone.type === "BEARISH"
    );

  const activeBullishFVGs =
    bullishFVGs.filter(
      (zone) =>
        zone.status !== "MITIGATED"
    );

  const activeBearishFVGs =
    bearishFVGs.filter(
      (zone) =>
        zone.status !== "MITIGATED"
    );

  const latestBullish =
    bullishFVGs.length
      ? bullishFVGs[0]
      : null;

  const latestBearish =
    bearishFVGs.length
      ? bearishFVGs[0]
      : null;

  let nearestBullish:
    | FVGZone
    | null = null;

  let nearestBearish:
    | FVGZone
    | null = null;

  if (
    Number.isFinite(currentPrice)
  ) {
    nearestBullish =
      getNearestBullish(
        sortedZones,
        currentPrice as number
      );

    nearestBearish =
      getNearestBearish(
        sortedZones,
        currentPrice as number
      );
  }

  return {
    zones: sortedZones,

    bullishFVGs,
    bearishFVGs,

    activeBullishFVGs,
    activeBearishFVGs,

    latestBullish,
    latestBearish,

    nearestBullish,
    nearestBearish,
  };
}

export function getActiveFVGs(
  candles: SwingCandle[],
  currentPrice?: number,
  options: FVGOptions = {}
): FVGZone[] {
  const analysis =
    detectFVGs(
      candles,
      currentPrice,
      options
    );

  return analysis.zones.filter(
    (zone) =>
      zone.status !== "MITIGATED"
  );
}

export function getLatestBullishFVG(
  candles: SwingCandle[],
  options: FVGOptions = {}
): FVGZone | null {
  const analysis =
    detectFVGs(
      candles,
      undefined,
      options
    );

  return analysis.latestBullish;
}

export function getLatestBearishFVG(
  candles: SwingCandle[],
  options: FVGOptions = {}
): FVGZone | null {
  const analysis =
    detectFVGs(
      candles,
      undefined,
      options
    );

  return analysis.latestBearish;
}

export function getNearestBullishFVG(
  candles: SwingCandle[],
  currentPrice: number,
  options: FVGOptions = {}
): FVGZone | null {
  const analysis =
    detectFVGs(
      candles,
      currentPrice,
      options
    );

  return analysis.nearestBullish;
}

export function getNearestBearishFVG(
  candles: SwingCandle[],
  currentPrice: number,
  options: FVGOptions = {}
): FVGZone | null {
  const analysis =
    detectFVGs(
      candles,
      currentPrice,
      options
    );

  return analysis.nearestBearish;
}
