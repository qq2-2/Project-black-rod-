import { SwingCandle } from "./swings";

export type DisplacementDirection =
  | "BULLISH"
  | "BEARISH";

export type DisplacementStrength =
  | "WEAK"
  | "MODERATE"
  | "STRONG";

export interface DisplacementEvent {
  index: number;
  datetime: string;

  direction: DisplacementDirection;
  strength: DisplacementStrength;

  open: number;
  high: number;
  low: number;
  close: number;

  bodySize: number;
  rangeSize: number;

  averageBodySize: number;
  averageRangeSize: number;

  bodyRatio: number;
  rangeRatio: number;

  closeLocation: number;

  upperWick: number;
  lowerWick: number;

  consecutiveCount: number;
}

export interface DisplacementAnalysis {
  events: DisplacementEvent[];

  bullishEvents: DisplacementEvent[];
  bearishEvents: DisplacementEvent[];

  latestBullish: DisplacementEvent | null;
  latestBearish: DisplacementEvent | null;
  latest: DisplacementEvent | null;
}

export interface DisplacementOptions {
  lookback?: number;

  bodyMultiplier?: number;
  rangeMultiplier?: number;

  closeLocationThreshold?: number;

  minimumBodyPercent?: number;

  maxEvents?: number;

  includeLastCandle?: boolean;
}

const DEFAULT_OPTIONS: Required<DisplacementOptions> = {
  lookback: 10,

  bodyMultiplier: 1.5,
  rangeMultiplier: 1.2,

  closeLocationThreshold: 0.75,

  minimumBodyPercent: 0.5,

  maxEvents: 50,

  includeLastCandle: false,
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

function getBodySize(
  candle: SwingCandle
): number {
  return Math.abs(
    candle.close - candle.open
  );
}

function getRangeSize(
  candle: SwingCandle
): number {
  return candle.high - candle.low;
}

function getUpperWick(
  candle: SwingCandle
): number {
  return (
    candle.high -
    Math.max(candle.open, candle.close)
  );
}

function getLowerWick(
  candle: SwingCandle
): number {
  return (
    Math.min(candle.open, candle.close) -
    candle.low
  );
}

function getCloseLocation(
  candle: SwingCandle
): number {
  const range = getRangeSize(candle);

  if (range <= 0) {
    return 0.5;
  }

  return (
    (candle.close - candle.low) /
    range
  );
}

function getAverage(
  values: number[]
): number {
  if (!values.length) {
    return 0;
  }

  const total = values.reduce(
    (sum, value) => sum + value,
    0
  );

  return total / values.length;
}

function getAverageBodySize(
  candles: SwingCandle[],
  index: number,
  lookback: number
): number {
  const start = Math.max(
    0,
    index - lookback
  );

  const bodies: number[] = [];

  for (
    let i = start;
    i < index;
    i += 1
  ) {
    if (!isValidCandle(candles[i])) {
      continue;
    }

    bodies.push(
      getBodySize(candles[i])
    );
  }

  return getAverage(bodies);
}

function getAverageRangeSize(
  candles: SwingCandle[],
  index: number,
  lookback: number
): number {
  const start = Math.max(
    0,
    index - lookback
  );

  const ranges: number[] = [];

  for (
    let i = start;
    i < index;
    i += 1
  ) {
    if (!isValidCandle(candles[i])) {
      continue;
    }

    ranges.push(
      getRangeSize(candles[i])
    );
  }

  return getAverage(ranges);
}

function getStrength(
  bodyRatio: number,
  rangeRatio: number,
  closeLocation: number,
  direction: DisplacementDirection
): DisplacementStrength {
  const directionalClose =
    direction === "BULLISH"
      ? closeLocation
      : 1 - closeLocation;

  if (
    bodyRatio >= 2 &&
    rangeRatio >= 1.5 &&
    directionalClose >= 0.85
  ) {
    return "STRONG";
  }

  if (
    bodyRatio >= 1.5 &&
    rangeRatio >= 1.2 &&
    directionalClose >= 0.75
  ) {
    return "MODERATE";
  }

  return "WEAK";
}

function isDisplacementCandidate(
  candle: SwingCandle,
  averageBodySize: number,
  averageRangeSize: number,
  options: Required<DisplacementOptions>
): boolean {
  const bodySize = getBodySize(candle);
  const rangeSize = getRangeSize(candle);

  if (
    bodySize <= 0 ||
    rangeSize <= 0
  ) {
    return false;
  }

  if (averageBodySize <= 0) {
    return false;
  }

  if (averageRangeSize <= 0) {
    return false;
  }

  const bodyRatio =
    bodySize / averageBodySize;

  const rangeRatio =
    rangeSize / averageRangeSize;

  const bodyPercent =
    bodySize / rangeSize;

  const closeLocation =
    getCloseLocation(candle);

  const bullish =
    candle.close > candle.open;

  const bearish =
    candle.close < candle.open;

  const directionalClose =
    bullish
      ? closeLocation
      : 1 - closeLocation;

  if (!bullish && !bearish) {
    return false;
  }

  if (
    bodyRatio <
    options.bodyMultiplier
  ) {
    return false;
  }

  if (
    rangeRatio <
    options.rangeMultiplier
  ) {
    return false;
  }

  if (
    bodyPercent <
    options.minimumBodyPercent
  ) {
    return false;
  }

  if (
    directionalClose <
    options.closeLocationThreshold
  ) {
    return false;
  }

  return true;
}

function countConsecutiveDisplacement(
  candles: SwingCandle[],
  index: number,
  direction: DisplacementDirection,
  options: Required<DisplacementOptions>
): number {
  let count = 1;

  for (
    let i = index - 1;
    i >= 0;
    i -= 1
  ) {
    if (!isValidCandle(candles[i])) {
      break;
    }

    const candle = candles[i];

    const candleDirection =
      candle.close > candle.open
        ? "BULLISH"
        : candle.close < candle.open
          ? "BEARISH"
          : null;

    if (
      candleDirection !== direction
    ) {
      break;
    }

    const averageBodySize =
      getAverageBodySize(
        candles,
        i,
        options.lookback
      );

    const averageRangeSize =
      getAverageRangeSize(
        candles,
        i,
        options.lookback
      );

    if (
      !isDisplacementCandidate(
        candle,
        averageBodySize,
        averageRangeSize,
        options
      )
    ) {
      break;
    }

    count += 1;
  }

  return count;
}

function createDisplacementEvent(
  candles: SwingCandle[],
  index: number,
  options: Required<DisplacementOptions>
): DisplacementEvent | null {
  const candle = candles[index];

  if (!isValidCandle(candle)) {
    return null;
  }

  const averageBodySize =
    getAverageBodySize(
      candles,
      index,
      options.lookback
    );

  const averageRangeSize =
    getAverageRangeSize(
      candles,
      index,
      options.lookback
    );

  if (
    !isDisplacementCandidate(
      candle,
      averageBodySize,
      averageRangeSize,
      options
    )
  ) {
    return null;
  }

  const bodySize =
    getBodySize(candle);

  const rangeSize =
    getRangeSize(candle);

  const bodyRatio =
    averageBodySize > 0
      ? bodySize / averageBodySize
      : 0;

  const rangeRatio =
    averageRangeSize > 0
      ? rangeSize / averageRangeSize
      : 0;

  const closeLocation =
    getCloseLocation(candle);

  const direction =
    candle.close > candle.open
      ? "BULLISH"
      : "BEARISH";

  const strength =
    getStrength(
      bodyRatio,
      rangeRatio,
      closeLocation,
      direction
    );

  const consecutiveCount =
    countConsecutiveDisplacement(
      candles,
      index,
      direction,
      options
    );

  return {
    index,
    datetime: String(candle.datetime),

    direction,
    strength,

    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,

    bodySize,
    rangeSize,

    averageBodySize,
    averageRangeSize,

    bodyRatio,
    rangeRatio,

    closeLocation,

    upperWick:
      getUpperWick(candle),

    lowerWick:
      getLowerWick(candle),

    consecutiveCount,
  };
}

export function detectDisplacements(
  candles: SwingCandle[],
  options: DisplacementOptions = {}
): DisplacementAnalysis {
  const config: Required<DisplacementOptions> = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

  if (!Array.isArray(candles)) {
    return {
      events: [],
      bullishEvents: [],
      bearishEvents: [],
      latestBullish: null,
      latestBearish: null,
      latest: null,
    };
  }

  if (candles.length === 0) {
    return {
      events: [],
      bullishEvents: [],
      bearishEvents: [],
      latestBullish: null,
      latestBearish: null,
      latest: null,
    };
  }

  const lastIndex = config.includeLastCandle
    ? candles.length - 1
    : candles.length - 2;

  if (lastIndex < 0) {
    return {
      events: [],
      bullishEvents: [],
      bearishEvents: [],
      latestBullish: null,
      latestBearish: null,
      latest: null,
    };
  }

  const events: DisplacementEvent[] = [];

  for (
    let i = 0;
    i <= lastIndex;
    i += 1
  ) {
    const event =
      createDisplacementEvent(
        candles,
        i,
        config
      );

    if (!event) {
      continue;
    }

    events.push(event);

    if (
      events.length >=
      config.maxEvents
    ) {
      break;
    }
  }

  const bullishEvents =
    events.filter(
      (event) =>
        event.direction === "BULLISH"
    );

  const bearishEvents =
    events.filter(
      (event) =>
        event.direction === "BEARISH"
    );

  const latestBullish =
    bullishEvents.length
      ? bullishEvents[
          bullishEvents.length - 1
        ]
      : null;

  const latestBearish =
    bearishEvents.length
      ? bearishEvents[
          bearishEvents.length - 1
        ]
      : null;

  const latest =
    events.length
      ? events[events.length - 1]
      : null;

  return {
    events,
    bullishEvents,
    bearishEvents,
    latestBullish,
    latestBearish,
    latest,
  };
}

export function getLatestDisplacement(
  candles: SwingCandle[],
  options: DisplacementOptions = {}
): DisplacementEvent | null {
  const analysis =
    detectDisplacements(
      candles,
      options
    );

  return analysis.latest;
}

export function getLatestBullishDisplacement(
  candles: SwingCandle[],
  options: DisplacementOptions = {}
): DisplacementEvent | null {
  const analysis =
    detectDisplacements(
      candles,
      options
    );

  return analysis.latestBullish;
}

export function getLatestBearishDisplacement(
  candles: SwingCandle[],
  options: DisplacementOptions = {}
): DisplacementEvent | null {
  const analysis =
    detectDisplacements(
      candles,
      options
    );

  return analysis.latestBearish;
}
