import {
  SwingCandle,
  SwingPoint,
} from "./swings";

export type StructureLabel =
  | "HH"
  | "HL"
  | "LH"
  | "LL";

export type StructureBias =
  | "BULLISH"
  | "BEARISH"
  | "NEUTRAL";

export type StructureEventType =
  | "BOS"
  | "CHoCH"
  | "MSS";

export interface StructurePoint {
  swing: SwingPoint;
  label: StructureLabel;
  comparedTo: SwingPoint | null;
  priceDifference: number | null;
  percentageDifference: number | null;
}

export interface StructureEvent {
  type: StructureEventType;
  direction: "BULLISH" | "BEARISH";
  swing: SwingPoint;
  breakPrice: number;
  breakDatetime: string;
  candleIndex: number;
  candle: {
    open: number;
    high: number;
    low: number;
    close: number;
  };
  previousBias: StructureBias;
  resultingBias: StructureBias;
  strength: "NORMAL" | "STRONG";
}

export interface StructureAnalysis {
  points: StructurePoint[];

  highs: StructurePoint[];
  lows: StructurePoint[];

  events: StructureEvent[];

  bosEvents: StructureEvent[];
  chochEvents: StructureEvent[];
  mssEvents: StructureEvent[];

  latestEvent: StructureEvent | null;

  bias: StructureBias;

  latestHigh: StructurePoint | null;
  latestLow: StructurePoint | null;

  protectedHigh: SwingPoint | null;
  protectedLow: SwingPoint | null;
}

export interface StructureOptions {
  minimumBreakPercent?: number;
  displacementBodyMultiplier?: number;
  maxEvents?: number;
  maxPoints?: number;
}

const DEFAULT_OPTIONS: Required<StructureOptions> = {
  minimumBreakPercent: 0.00005,
  displacementBodyMultiplier: 1.5,
  maxEvents: 50,
  maxPoints: 100,
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

function getPercentageDifference(
  currentPrice: number,
  previousPrice: number
): number {
  if (
    !Number.isFinite(currentPrice) ||
    !Number.isFinite(previousPrice) ||
    previousPrice === 0
  ) {
    return 0;
  }

  return (
    ((currentPrice - previousPrice) /
      Math.abs(previousPrice)) *
    100
  );
}

function getAverageBodySize(
  candles: SwingCandle[],
  index: number,
  lookback = 10
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
    const candle = candles[i];

    if (!candle || !isValidCandle(candle)) {
      continue;
    }

    const body = Math.abs(
      candle.close - candle.open
    );

    if (
      Number.isFinite(body) &&
      body > 0
    ) {
      bodies.push(body);
    }
  }

  if (!bodies.length) {
    return 0;
  }

  const total = bodies.reduce(
    (sum, value) => sum + value,
    0
  );

  return total / bodies.length;
}

function isStrongBreak(
  candles: SwingCandle[],
  candleIndex: number,
  multiplier: number
): boolean {
  const candle = candles[candleIndex];

  if (!candle) {
    return false;
  }

  const averageBody =
    getAverageBodySize(
      candles,
      candleIndex
    );

  if (averageBody <= 0) {
    return false;
  }

  const currentBody = Math.abs(
    candle.close - candle.open
  );

  return (
    currentBody >=
    averageBody * multiplier
  );
}

function classifyHigh(
  current: SwingPoint,
  previous: SwingPoint
): StructureLabel {
  if (current.price > previous.price) {
    return "HH";
  }

  return "LH";
}

function classifyLow(
  current: SwingPoint,
  previous: SwingPoint
): StructureLabel {
  if (current.price > previous.price) {
    return "HL";
  }

  return "LL";
}

function buildStructurePoints(
  highs: SwingPoint[],
  lows: SwingPoint[],
  maxPoints: number
): StructurePoint[] {
  const points: StructurePoint[] = [];

  for (
    let i = 0;
    i < highs.length;
    i += 1
  ) {
    const current = highs[i];

    if (!current) {
      continue;
    }

    const previous =
      i > 0
        ? highs[i - 1]
        : null;

    if (!previous) {
      points.push({
        swing: current,
        label: "HH",
        comparedTo: null,
        priceDifference: null,
        percentageDifference: null,
      });

      continue;
    }

    points.push({
      swing: current,
      label: classifyHigh(
        current,
        previous
      ),
      comparedTo: previous,
      priceDifference:
        current.price -
        previous.price,
      percentageDifference:
        getPercentageDifference(
          current.price,
          previous.price
        ),
    });
  }

  for (
    let i = 0;
    i < lows.length;
    i += 1
  ) {
    const current = lows[i];

    if (!current) {
      continue;
    }

    const previous =
      i > 0
        ? lows[i - 1]
        : null;

    if (!previous) {
      points.push({
        swing: current,
        label: "HL",
        comparedTo: null,
        priceDifference: null,
        percentageDifference: null,
      });

      continue;
    }

    points.push({
      swing: current,
      label: classifyLow(
        current,
        previous
      ),
      comparedTo: previous,
      priceDifference:
        current.price -
        previous.price,
      percentageDifference:
        getPercentageDifference(
          current.price,
          previous.price
        ),
    });
  }

  return points
    .sort(
      (a, b) =>
        a.swing.index -
        b.swing.index
    )
    .slice(-maxPoints);
}

function findFirstSwingAfterIndex(
  swings: SwingPoint[],
  index: number
): SwingPoint | null {
  for (const swing of swings) {
    if (swing.index > index) {
      return swing;
    }
  }

  return null;
}

function hasCandleClosedAbove(
  candles: SwingCandle[],
  startIndex: number,
  level: number,
  minimumBreakPercent: number
): number | null {
  for (
    let i = startIndex;
    i < candles.length;
    i += 1
  ) {
    const candle = candles[i];

    if (!candle || !isValidCandle(candle)) {
      continue;
    }

    const breakPercent =
      ((candle.close - level) /
        Math.abs(level)) *
      100;

    if (
      candle.close > level &&
      breakPercent >=
        minimumBreakPercent
    ) {
      return i;
    }
  }

  return null;
}

function hasCandleClosedBelow(
  candles: SwingCandle[],
  startIndex: number,
  level: number,
  minimumBreakPercent: number
): number | null {
  for (
    let i = startIndex;
    i < candles.length;
    i += 1
  ) {
    const candle = candles[i];

    if (!candle || !isValidCandle(candle)) {
      continue;
    }

    const breakPercent =
      ((level - candle.close) /
        Math.abs(level)) *
      100;

    if (
      candle.close < level &&
      breakPercent >=
        minimumBreakPercent
    ) {
      return i;
    }
  }

  return null;
}

function buildBullishBreakEvent(
  candles: SwingCandle[],
  swing: SwingPoint,
  candleIndex: number,
  previousBias: StructureBias,
  type: StructureEventType,
  displacementMultiplier: number
): StructureEvent | null {
  const candle = candles[candleIndex];

  if (!candle) {
    return null;
  }

  const resultingBias: StructureBias =
    "BULLISH";

  const strength =
    isStrongBreak(
      candles,
      candleIndex,
      displacementMultiplier
    )
      ? "STRONG"
      : "NORMAL";

  return {
    type,
    direction: "BULLISH",
    swing,
    breakPrice: candle.close,
    breakDatetime: candle.datetime,
    candleIndex,
    candle: {
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
    },
    previousBias,
    resultingBias,
    strength,
  };
}

function buildBearishBreakEvent(
  candles: SwingCandle[],
  swing: SwingPoint,
  candleIndex: number,
  previousBias: StructureBias,
  type: StructureEventType,
  displacementMultiplier: number
): StructureEvent | null {
  const candle = candles[candleIndex];

  if (!candle) {
    return null;
  }

  const resultingBias: StructureBias =
    "BEARISH";

  const strength =
    isStrongBreak(
      candles,
      candleIndex,
      displacementMultiplier
    )
      ? "STRONG"
      : "NORMAL";

  return {
    type,
    direction: "BEARISH",
    swing,
    breakPrice: candle.close,
    breakDatetime: candle.datetime,
    candleIndex,
    candle: {
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
    },
    previousBias,
    resultingBias,
    strength,
  };
}

function detectStructureEvents(
  candles: SwingCandle[],
  highs: SwingPoint[],
  lows: SwingPoint[],
  options: Required<StructureOptions>
): StructureEvent[] {
  const events: StructureEvent[] = [];

  if (!candles.length) {
    return events;
  }

  let bias: StructureBias =
    "NEUTRAL";

  const processedHighBreaks =
    new Set<number>();

  const processedLowBreaks =
    new Set<number>();

  /*
   * We process confirmed swing levels in
   * chronological order.
   *
   * A bullish break occurs when a candle CLOSES
   * above a confirmed swing high.
   *
   * A bearish break occurs when a candle CLOSES
   * below a confirmed swing low.
   *
   * Wicks alone do NOT count as structure breaks.
   */
  const allSwings = [
    ...highs,
    ...lows,
  ].sort(
    (a, b) =>
      a.index - b.index
  );

  for (const swing of allSwings) {
    if (swing.type === "HIGH") {
      if (
        processedHighBreaks.has(
          swing.index
        )
      ) {
        continue;
      }

      const breakIndex =
        hasCandleClosedAbove(
          candles,
          swing.index +
            1,
          swing.price,
          options.minimumBreakPercent
        );

      if (
        breakIndex === null
      ) {
        continue;
      }

      processedHighBreaks.add(
        swing.index
      );

      let eventType: StructureEventType;

      if (bias === "BEARISH") {
        eventType =
          isStrongBreak(
            candles,
            breakIndex,
            options.displacementBodyMultiplier
          )
            ? "MSS"
            : "CHoCH";
      } else {
        eventType = "BOS";
      }

      const event =
        buildBullishBreakEvent(
          candles,
          swing,
          breakIndex,
          bias,
          eventType,
          options.displacementBodyMultiplier
        );

      if (event) {
        events.push(event);
        bias = "BULLISH";
      }
    } else {
      if (
        processedLowBreaks.has(
          swing.index
        )
      ) {
        continue;
      }

      const breakIndex =
        hasCandleClosedBelow(
          candles,
          swing.index +
            1,
          swing.price,
          options.minimumBreakPercent
        );

      if (
        breakIndex === null
      ) {
        continue;
      }

      processedLowBreaks.add(
        swing.index
      );

      let eventType: StructureEventType;

      if (bias === "BULLISH") {
        eventType =
          isStrongBreak(
            candles,
            breakIndex,
            options.displacementBodyMultiplier
          )
            ? "MSS"
            : "CHoCH";
      } else {
        eventType = "BOS";
      }

      const event =
        buildBearishBreakEvent(
          candles,
          swing,
          breakIndex,
          bias,
          eventType,
          options.displacementBodyMultiplier
        );

      if (event) {
        events.push(event);
        bias = "BEARISH";
      }
    }
  }

  return events
    .sort(
      (a, b) =>
        a.candleIndex -
        b.candleIndex
    )
    .slice(-options.maxEvents);
}

export function analyzeStructure(
  candles: SwingCandle[],
  swingHighs: SwingPoint[],
  swingLows: SwingPoint[],
  options: StructureOptions = {}
): StructureAnalysis {
  const config = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

  if (
    !Array.isArray(candles) ||
    !candles.length
  ) {
    return {
      points: [],
      highs: [],
      lows: [],
      events: [],
      bosEvents: [],
      chochEvents: [],
      mssEvents: [],
      latestEvent: null,
      bias: "NEUTRAL",
      latestHigh: null,
      latestLow: null,
      protectedHigh: null,
      protectedLow: null,
    };
  }

  const validCandles =
    candles.filter(isValidCandle);

  const validHighs =
    swingHighs.filter(
      (swing) =>
        swing.type === "HIGH"
    );

  const validLows =
    swingLows.filter(
      (swing) =>
        swing.type === "LOW"
    );

  const points =
    buildStructurePoints(
      validHighs,
      validLows,
      config.maxPoints
    );

  const events =
    detectStructureEvents(
      validCandles,
      validHighs,
      validLows,
      config
    );

  const bosEvents =
    events.filter(
      (event) =>
        event.type === "BOS"
    );

  const chochEvents =
    events.filter(
      (event) =>
        event.type === "CHoCH"
    );

  const mssEvents =
    events.filter(
      (event) =>
        event.type === "MSS"
    );

  const latestEvent =
    events.length
      ? events[events.length - 1]
      : null;

  let bias: StructureBias =
    "NEUTRAL";

  if (latestEvent) {
    bias =
      latestEvent.resultingBias;
  } else {
    const recentPoints =
      points.slice(-4);

    const hasBullishStructure =
      recentPoints.some(
        (point) =>
          point.label === "HH"
      ) &&
      recentPoints.some(
        (point) =>
          point.label === "HL"
      );

    const hasBearishStructure =
      recentPoints.some(
        (point) =>
          point.label === "LH"
      ) &&
      recentPoints.some(
        (point) =>
          point.label === "LL"
      );

    if (hasBullishStructure) {
      bias = "BULLISH";
    } else if (hasBearishStructure) {
      bias = "BEARISH";
    }
  }

  const latestHigh =
    validHighs.length
      ? points
          .filter(
            (point) =>
              point.swing.type ===
              "HIGH"
          )
          .at(-1) ?? null
      : null;

  const latestLow =
    validLows.length
      ? points
          .filter(
            (point) =>
              point.swing.type ===
              "LOW"
          )
          .at(-1) ?? null
      : null;

  let protectedHigh:
    SwingPoint | null = null;

  let protectedLow:
    SwingPoint | null = null;

  /*
   * In bullish structure, the most recent
   * meaningful swing low becomes the protected
   * low.
   *
   * In bearish structure, the most recent
   * meaningful swing high becomes the protected
   * high.
   */
  if (bias === "BULLISH") {
    protectedLow =
      validLows.length
        ? validLows[
            validLows.length - 1
          ]
        : null;
  }

  if (bias === "BEARISH") {
    protectedHigh =
      validHighs.length
        ? validHighs[
            validHighs.length - 1
          ]
        : null;
  }

  return {
    points,
    highs: points.filter(
      (point) =>
        point.swing.type === "HIGH"
    ),
    lows: points.filter(
      (point) =>
        point.swing.type === "LOW"
    ),
    events,
    bosEvents,
    chochEvents,
    mssEvents,
    latestEvent,
    bias,
    latestHigh,
    latestLow,
    protectedHigh,
    protectedLow,
  };
}

export function getStructureBias(
  analysis: StructureAnalysis
): StructureBias {
  return analysis.bias;
}

export function getLatestStructureEvent(
  analysis: StructureAnalysis
): StructureEvent | null {
  return analysis.latestEvent;
}

export function getLatestBOS(
  analysis: StructureAnalysis
): StructureEvent | null {
  return (
    analysis.bosEvents.at(-1) ??
    null
  );
}

export function getLatestCHoCH(
  analysis: StructureAnalysis
): StructureEvent | null {
  return (
    analysis.chochEvents.at(-1) ??
    null
  );
}

export function getLatestMSS(
  analysis: StructureAnalysis
): StructureEvent | null {
  return (
    analysis.mssEvents.at(-1) ??
    null
  );
}
