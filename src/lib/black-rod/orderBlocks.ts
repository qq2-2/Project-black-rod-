import { SwingCandle } from "./swings";

export type OrderBlockType =
  | "BULLISH"
  | "BEARISH";

export type OrderBlockStatus =
  | "ACTIVE"
  | "PARTIALLY_MITIGATED"
  | "MITIGATED"
  | "INVALIDATED";

export interface OrderBlock {
  index: number;
  datetime: string;
  type: OrderBlockType;
  high: number;
  low: number;
  open: number;
  close: number;
  bodySize: number;
  rangeSize: number;
  bodyPercent: number;
  displacementIndex: number;
  displacementDatetime: string;
  displacementBodySize: number;
  displacementRangeSize: number;
  status: OrderBlockStatus;
  mitigationPercent: number;
  firstMitigationIndex: number | null;
  firstMitigationDatetime: string | null;
  fullyMitigatedIndex: number | null;
  fullyMitigatedDatetime: string | null;
  invalidatedIndex: number | null;
  invalidatedDatetime: string | null;
  age: number;
}

export interface OrderBlockAnalysis {
  orderBlocks: OrderBlock[];
  bullishOrderBlocks: OrderBlock[];
  bearishOrderBlocks: OrderBlock[];
  activeBullishOrderBlocks: OrderBlock[];
  activeBearishOrderBlocks: OrderBlock[];
  latestBullish: OrderBlock | null;
  latestBearish: OrderBlock | null;
  nearestBullish: OrderBlock | null;
  nearestBearish: OrderBlock | null;
}

export interface OrderBlockOptions {
  lookback?: number;
  displacementBodyMultiplier?: number;
  displacementRangeMultiplier?: number;
  minimumDisplacementBodyPercent?: number;
  maxSearchBack?: number;
  maxResults?: number;
  includeLastCandle?: boolean;
}

const DEFAULT_OPTIONS: Required<OrderBlockOptions> = {
  lookback: 10,
  displacementBodyMultiplier: 1.5,
  displacementRangeMultiplier: 1.2,
  minimumDisplacementBodyPercent: 0.5,
  maxSearchBack: 5,
  maxResults: 30,
  includeLastCandle: false,
};

function isValidCandle(candle: SwingCandle): boolean {
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

function getBodySize(candle: SwingCandle): number {
  return Math.abs(candle.close - candle.open);
}

function getRangeSize(candle: SwingCandle): number {
  return candle.high - candle.low;
}

function getAverage(values: number[]): number {
  if (!values.length) {
    return 0;
  }

  return (
    values.reduce(
      (sum, value) => sum + value,
      0
    ) / values.length
  );
}

function getAverageBodySize(
  candles: SwingCandle[],
  index: number,
  lookback: number
): number {
  const start = Math.max(0, index - lookback);
  const values: number[] = [];

  for (let i = start; i < index; i += 1) {
    if (!isValidCandle(candles[i])) {
      continue;
    }

    values.push(getBodySize(candles[i]));
  }

  return getAverage(values);
}

function getAverageRangeSize(
  candles: SwingCandle[],
  index: number,
  lookback: number
): number {
  const start = Math.max(0, index - lookback);
  const values: number[] = [];

  for (let i = start; i < index; i += 1) {
    if (!isValidCandle(candles[i])) {
      continue;
    }

    values.push(getRangeSize(candles[i]));
  }

  return getAverage(values);
}

function isBullishDisplacement(
  candles: SwingCandle[],
  index: number,
  options: Required<OrderBlockOptions>
): boolean {
  const candle = candles[index];

  if (
    !isValidCandle(candle) ||
    candle.close <= candle.open
  ) {
    return false;
  }

  const body = getBodySize(candle);
  const range = getRangeSize(candle);

  const averageBody = getAverageBodySize(
    candles,
    index,
    options.lookback
  );

  const averageRange = getAverageRangeSize(
    candles,
    index,
    options.lookback
  );

  if (
    body <= 0 ||
    range <= 0 ||
    averageBody <= 0 ||
    averageRange <= 0
  ) {
    return false;
  }

  const bodyRatio = body / averageBody;
  const rangeRatio = range / averageRange;
  const bodyPercent = body / range;
  const closeLocation =
    (candle.close - candle.low) / range;

  return (
    bodyRatio >= options.displacementBodyMultiplier &&
    rangeRatio >= options.displacementRangeMultiplier &&
    bodyPercent >= options.minimumDisplacementBodyPercent &&
    closeLocation >= 0.75
  );
}

function isBearishDisplacement(
  candles: SwingCandle[],
  index: number,
  options: Required<OrderBlockOptions>
): boolean {
  const candle = candles[index];

  if (
    !isValidCandle(candle) ||
    candle.close >= candle.open
  ) {
    return false;
  }

  const body = getBodySize(candle);
  const range = getRangeSize(candle);

  const averageBody = getAverageBodySize(
    candles,
    index,
    options.lookback
  );

  const averageRange = getAverageRangeSize(
    candles,
    index,
    options.lookback
  );

  if (
    body <= 0 ||
    range <= 0 ||
    averageBody <= 0 ||
    averageRange <= 0
  ) {
    return false;
  }

  const bodyRatio = body / averageBody;
  const rangeRatio = range / averageRange;
  const bodyPercent = body / range;
  const closeLocation =
    (candle.close - candle.low) / range;

  return (
    bodyRatio >= options.displacementBodyMultiplier &&
    rangeRatio >= options.displacementRangeMultiplier &&
    bodyPercent >= options.minimumDisplacementBodyPercent &&
    closeLocation <= 0.25
  );
}

function findBullishOrderBlock(
  candles: SwingCandle[],
  displacementIndex: number,
  options: Required<OrderBlockOptions>
): number | null {
  const start = Math.max(
    0,
    displacementIndex - options.maxSearchBack
  );

  for (
    let i = displacementIndex - 1;
    i >= start;
    i -= 1
  ) {
    const candle = candles[i];

    if (!isValidCandle(candle)) {
      continue;
    }

    if (candle.close < candle.open) {
      return i;
    }
  }

  return null;
}

function findBearishOrderBlock(
  candles: SwingCandle[],
  displacementIndex: number,
  options: Required<OrderBlockOptions>
): number | null {
  const start = Math.max(
    0,
    displacementIndex - options.maxSearchBack
  );

  for (
    let i = displacementIndex - 1;
    i >= start;
    i -= 1
  ) {
    const candle = candles[i];

    if (!isValidCandle(candle)) {
      continue;
    }

    if (candle.close > candle.open) {
      return i;
    }
  }

  return null;
}

function getMitigation(
  candles: SwingCandle[],
  startIndex: number,
  endIndex: number,
  type: OrderBlockType,
  zoneHigh: number,
  zoneLow: number
): {
  status: OrderBlockStatus;
  mitigationPercent: number;
  firstMitigationIndex: number | null;
  fullyMitigatedIndex: number | null;
  invalidatedIndex: number | null;
} {
  const zoneSize = zoneHigh - zoneLow;

  if (zoneSize <= 0) {
    return {
      status: "INVALIDATED",
      mitigationPercent: 100,
      firstMitigationIndex: null,
      fullyMitigatedIndex: null,
      invalidatedIndex: null,
    };
  }

  let maximumMitigation = 0;
  let firstMitigationIndex: number | null = null;
  let fullyMitigatedIndex: number | null = null;
  let invalidatedIndex: number | null = null;

  for (
    let i = startIndex;
    i <= endIndex;
    i += 1
  ) {
    const candle = candles[i];

    if (!isValidCandle(candle)) {
      continue;
    }

    if (type === "BULLISH") {
      if (candle.close < zoneLow) {
        invalidatedIndex = i;
        break;
      }

      if (candle.low <= zoneHigh) {
        const penetration = zoneHigh - candle.low;

        const percentage = Math.min(
          100,
          Math.max(
            0,
            (penetration / zoneSize) * 100
          )
        );

        maximumMitigation = Math.max(
          maximumMitigation,
          percentage
        );

        if (firstMitigationIndex === null) {
          firstMitigationIndex = i;
        }

        if (
          percentage >= 100 &&
          fullyMitigatedIndex === null
        ) {
          fullyMitigatedIndex = i;
        }
      }
    }

    if (type === "BEARISH") {
      if (candle.close > zoneHigh) {
        invalidatedIndex = i;
        break;
      }

      if (candle.high >= zoneLow) {
        const penetration = candle.high - zoneLow;

        const percentage = Math.min(
          100,
          Math.max(
            0,
            (penetration / zoneSize) * 100
          )
        );

        maximumMitigation = Math.max(
          maximumMitigation,
          percentage
        );

        if (firstMitigationIndex === null) {
          firstMitigationIndex = i;
        }

        if (
          percentage >= 100 &&
          fullyMitigatedIndex === null
        ) {
          fullyMitigatedIndex = i;
        }
      }
    }
  }

  if (invalidatedIndex !== null) {
    return {
      status: "INVALIDATED",
      mitigationPercent: maximumMitigation,
      firstMitigationIndex,
      fullyMitigatedIndex,
      invalidatedIndex,
    };
  }

  if (fullyMitigatedIndex !== null) {
    return {
      status: "MITIGATED",
      mitigationPercent: 100,
      firstMitigationIndex,
      fullyMitigatedIndex,
      invalidatedIndex: null,
    };
  }

  if (maximumMitigation > 0) {
    return {
      status: "PARTIALLY_MITIGATED",
      mitigationPercent: maximumMitigation,
      firstMitigationIndex,
      fullyMitigatedIndex: null,
      invalidatedIndex: null,
    };
  }

  return {
    status: "ACTIVE",
    mitigationPercent: 0,
    firstMitigationIndex: null,
    fullyMitigatedIndex: null,
    invalidatedIndex: null,
  };
}

function createOrderBlock(
  candles: SwingCandle[],
  orderBlockIndex: number,
  displacementIndex: number,
  type: OrderBlockType
): OrderBlock | null {
  const orderBlock = candles[orderBlockIndex];
  const displacement = candles[displacementIndex];

  if (
    !isValidCandle(orderBlock) ||
    !isValidCandle(displacement)
  ) {
    return null;
  }

  const bodySize = getBodySize(orderBlock);
  const rangeSize = getRangeSize(orderBlock);

  if (rangeSize <= 0) {
    return null;
  }

  return {
    index: orderBlockIndex,
    datetime: String(orderBlock.datetime),
    type,

    high: orderBlock.high,
    low: orderBlock.low,

    open: orderBlock.open,
    close: orderBlock.close,

    bodySize,
    rangeSize,

    bodyPercent: bodySize / rangeSize,

    displacementIndex,

    displacementDatetime: String(
      displacement.datetime
    ),

    displacementBodySize:
      getBodySize(displacement),

    displacementRangeSize:
      getRangeSize(displacement),

    status: "ACTIVE",

    mitigationPercent: 0,

    firstMitigationIndex: null,
    firstMitigationDatetime: null,

    fullyMitigatedIndex: null,
    fullyMitigatedDatetime: null,

    invalidatedIndex: null,
    invalidatedDatetime: null,

    age:
      candles.length -
      1 -
      orderBlockIndex,
  };
}

function applyMitigation(
  candles: SwingCandle[],
  orderBlock: OrderBlock
): OrderBlock {
  const mitigation = getMitigation(
    candles,
    orderBlock.displacementIndex + 1,
    candles.length - 1,
    orderBlock.type,
    orderBlock.high,
    orderBlock.low
  );

  return {
    ...orderBlock,

    status: mitigation.status,

    mitigationPercent:
      mitigation.mitigationPercent,

    firstMitigationIndex:
      mitigation.firstMitigationIndex,

    firstMitigationDatetime:
      mitigation.firstMitigationIndex !== null
        ? String(
            candles[
              mitigation.firstMitigationIndex
            ].datetime
          )
        : null,

    fullyMitigatedIndex:
      mitigation.fullyMitigatedIndex,

    fullyMitigatedDatetime:
      mitigation.fullyMitigatedIndex !== null
        ? String(
            candles[
              mitigation.fullyMitigatedIndex
            ].datetime
          )
        : null,

    invalidatedIndex:
      mitigation.invalidatedIndex,

    invalidatedDatetime:
      mitigation.invalidatedIndex !== null
        ? String(
            candles[
              mitigation.invalidatedIndex
            ].datetime
          )
        : null,
  };
}

function deduplicateOrderBlocks(
  orderBlocks: OrderBlock[]
): OrderBlock[] {
  const seen = new Set<string>();
  const result: OrderBlock[] = [];

  for (const orderBlock of orderBlocks) {
    const key = [
      orderBlock.type,
      orderBlock.index,
    ].join("|");

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(orderBlock);
  }

  return result;
}

function getNearestBullish(
  orderBlocks: OrderBlock[],
  currentPrice: number
): OrderBlock | null {
  const active = orderBlocks.filter(
    (orderBlock) =>
      orderBlock.type === "BULLISH" &&
      orderBlock.status === "ACTIVE" &&
      orderBlock.high <= currentPrice
  );

  if (!active.length) {
    return null;
  }

  return [...active].sort(
    (a, b) =>
      currentPrice -
      a.high -
      (currentPrice - b.high)
  )[0];
}

function getNearestBearish(
  orderBlocks: OrderBlock[],
  currentPrice: number
): OrderBlock | null {
  const active = orderBlocks.filter(
    (orderBlock) =>
      orderBlock.type === "BEARISH" &&
      orderBlock.status === "ACTIVE" &&
      orderBlock.low >= currentPrice
  );

  if (!active.length) {
    return null;
  }

  return [...active].sort(
    (a, b) =>
      a.low -
      currentPrice -
      (b.low - currentPrice)
  )[0];
}

export function detectOrderBlocks(
  candles: SwingCandle[],
  currentPrice?: number,
  options: OrderBlockOptions = {}
): OrderBlockAnalysis {
  const config: Required<OrderBlockOptions> = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

  if (
    !Array.isArray(candles) ||
    candles.length < 3
  ) {
    return {
      orderBlocks: [],
      bullishOrderBlocks: [],
      bearishOrderBlocks: [],
      activeBullishOrderBlocks: [],
      activeBearishOrderBlocks: [],
      latestBullish: null,
      latestBearish: null,
      nearestBullish: null,
      nearestBearish: null,
    };
  }

  const lastIndex = config.includeLastCandle
    ? candles.length - 1
    : candles.length - 2;

  const orderBlocks: OrderBlock[] = [];

  for (
    let i = 1;
    i <= lastIndex;
    i += 1
  ) {
    let orderBlockIndex: number | null = null;
    let type: OrderBlockType | null = null;

    if (
      isBullishDisplacement(
        candles,
        i,
        config
      )
    ) {
      orderBlockIndex =
        findBullishOrderBlock(
          candles,
          i,
          config
        );

      type = "BULLISH";
    } else if (
      isBearishDisplacement(
        candles,
        i,
        config
      )
    ) {
      orderBlockIndex =
        findBearishOrderBlock(
          candles,
          i,
          config
        );

      type = "BEARISH";
    }

    if (
      orderBlockIndex === null ||
      type === null
    ) {
      continue;
    }

    const orderBlock = createOrderBlock(
      candles,
      orderBlockIndex,
      i,
      type
    );

    if (!orderBlock) {
      continue;
    }

    orderBlocks.push(
      applyMitigation(
        candles,
        orderBlock
      )
    );

    if (
      orderBlocks.length >=
      config.maxResults
    ) {
      break;
    }
  }

  const uniqueOrderBlocks =
    deduplicateOrderBlocks(
      orderBlocks
    );

  const sortedOrderBlocks =
    [...uniqueOrderBlocks].sort(
      (a, b) => b.index - a.index
    );

  const bullishOrderBlocks =
    sortedOrderBlocks.filter(
      (orderBlock) =>
        orderBlock.type === "BULLISH"
    );

  const bearishOrderBlocks =
    sortedOrderBlocks.filter(
      (orderBlock) =>
        orderBlock.type === "BEARISH"
    );

  const activeBullishOrderBlocks =
    bullishOrderBlocks.filter(
      (orderBlock) =>
        orderBlock.status === "ACTIVE"
    );

  const activeBearishOrderBlocks =
    bearishOrderBlocks.filter(
      (orderBlock) =>
        orderBlock.status === "ACTIVE"
    );

  const latestBullish =
    bullishOrderBlocks.length
      ? bullishOrderBlocks[0]
      : null;

  const latestBearish =
    bearishOrderBlocks.length
      ? bearishOrderBlocks[0]
      : null;

  let nearestBullish:
    | OrderBlock
    | null = null;

  let nearestBearish:
    | OrderBlock
    | null = null;

  if (Number.isFinite(currentPrice)) {
    nearestBullish =
      getNearestBullish(
        sortedOrderBlocks,
        currentPrice as number
      );

    nearestBearish =
      getNearestBearish(
        sortedOrderBlocks,
        currentPrice as number
      );
  }

  return {
    orderBlocks: sortedOrderBlocks,

    bullishOrderBlocks,
    bearishOrderBlocks,

    activeBullishOrderBlocks,
    activeBearishOrderBlocks,

    latestBullish,
    latestBearish,

    nearestBullish,
    nearestBearish,
  };
}

export function getActiveOrderBlocks(
  candles: SwingCandle[],
  currentPrice?: number,
  options: OrderBlockOptions = {}
): OrderBlock[] {
  const analysis =
    detectOrderBlocks(
      candles,
      currentPrice,
      options
    );

  return analysis.orderBlocks.filter(
    (orderBlock) =>
      orderBlock.status === "ACTIVE"
  );
}

export function getLatestBullishOrderBlock(
  candles: SwingCandle[],
  options: OrderBlockOptions = {}
): OrderBlock | null {
  const analysis =
    detectOrderBlocks(
      candles,
      undefined,
      options
    );

  return analysis.latestBullish;
}

export function getLatestBearishOrderBlock(
  candles: SwingCandle[],
  options: OrderBlockOptions = {}
): OrderBlock | null {
  const analysis =
    detectOrderBlocks(
      candles,
      undefined,
      options
    );

  return analysis.latestBearish;
}

export function getNearestBullishOrderBlock(
  candles: SwingCandle[],
  currentPrice: number,
  options: OrderBlockOptions = {}
): OrderBlock | null {
  const analysis =
    detectOrderBlocks(
      candles,
      currentPrice,
      options
    );

  return analysis.nearestBullish;
}

export function getNearestBearishOrderBlock(
  candles: SwingCandle[],
  currentPrice: number,
  options: OrderBlockOptions = {}
): OrderBlock | null {
  const analysis =
    detectOrderBlocks(
      candles,
      currentPrice,
      options
    );

  return analysis.nearestBearish;
}
