import {
  SwingAnalysis,
  SwingCandle,
  SwingDetectionOptions,
  detectSwings,
} from "./swings";
import {
  StructureAnalysis,
  StructureOptions,
  analyzeStructure,
} from "./structure";
import {
  LiquidityAnalysis,
  LiquidityOptions,
  analyzeLiquidity,
} from "./liquidity";
import {
  DisplacementAnalysis,
  DisplacementOptions,
  detectDisplacements,
} from "./displacement";
import {
  FVGAnalysis,
  FVGOptions,
  detectFVGs,
} from "./fvg";
import {
  OrderBlockAnalysis,
  OrderBlockOptions,
  detectOrderBlocks,
} from "./orderBlocks";
import {
  PremiumDiscountAnalysis,
  PremiumDiscountOptions,
  analyzePremiumDiscount,
} from "./premiumDiscount";
import {
  ConfluenceAnalysis,
  ConfluenceOptions,
  analyzeConfluence,
} from "./confluence";
import {
  EntryValidationResult,
  ValidatorOptions,
  validateEntry,
} from "./validator";

export interface BlackRodCandle extends SwingCandle {
  datetime: string;
  volume?: number | null;
}

export interface BlackRodTimeframeInput {
  timeframe: string;
  candles: BlackRodCandle[];
}

export interface BlackRodEngineInput {
  currentPrice: number;
  timeframe: string;
  candles: BlackRodCandle[];
  dailyCandles?: BlackRodCandle[];
  weeklyCandles?: BlackRodCandle[];
  higherTimeframes?: BlackRodTimeframeInput[];
}

export interface BlackRodTimeframeState {
  timeframe: string;
  candleCount: number;
  latestCandle: BlackRodCandle | null;
  swings: SwingAnalysis;
  structure: StructureAnalysis;
  liquidity: LiquidityAnalysis;
  displacement: DisplacementAnalysis;
  fvg: FVGAnalysis;
  orderBlocks: OrderBlockAnalysis;
  premiumDiscount: PremiumDiscountAnalysis;
  confluence: ConfluenceAnalysis;
  validation: EntryValidationResult;
}

export interface BlackRodEngineOptions {
  swings?: SwingDetectionOptions;
  structure?: StructureOptions;
  liquidity?: LiquidityOptions;
  displacement?: DisplacementOptions;
  fvg?: FVGOptions;
  orderBlocks?: OrderBlockOptions;
  premiumDiscount?: PremiumDiscountOptions;
  confluence?: ConfluenceOptions;
  validator?: ValidatorOptions;
}

export interface BlackRodEngineResult {
  engine: "BLACK_ROD";
  version: "1.0.0";
  timeframe: string;
  currentPrice: number;
  state: BlackRodTimeframeState;
  higherTimeframes: BlackRodTimeframeState[];
  finalValidation: EntryValidationResult;
  generatedAt: string;
}

const DEFAULT_ENGINE_OPTIONS: BlackRodEngineOptions = {};

function isFiniteNumber(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value)
  );
}

function normalizeCandles(
  candles: BlackRodCandle[]
): BlackRodCandle[] {
  return [...candles]
    .filter(
      (candle) =>
        isFiniteNumber(candle.open) &&
        isFiniteNumber(candle.high) &&
        isFiniteNumber(candle.low) &&
        isFiniteNumber(candle.close)
    )
    .filter(
      (candle) =>
        candle.high >= candle.low &&
        candle.high >= candle.open &&
        candle.high >= candle.close &&
        candle.low <= candle.open &&
        candle.low <= candle.close
    )
    .sort((a, b) => {
      const aTime = a.datetime
        ? new Date(a.datetime).getTime()
        : 0;
      const bTime = b.datetime
        ? new Date(b.datetime).getTime()
        : 0;

      return aTime - bTime;
    });
}

function getLatestCandle(
  candles: BlackRodCandle[]
): BlackRodCandle | null {
  return candles.length
    ? candles[candles.length - 1]
    : null;
}

function getLatestPrice(
  candles: BlackRodCandle[],
  fallback: number
): number {
  const latest = getLatestCandle(candles);

  if (latest && isFiniteNumber(latest.close)) {
    return latest.close;
  }

  return fallback;
}

function buildTimeframeState(
  timeframe: string,
  candlesInput: BlackRodCandle[],
  currentPrice: number,
  dailyCandles: BlackRodCandle[] = [],
  weeklyCandles: BlackRodCandle[] = [],
  options: BlackRodEngineOptions = DEFAULT_ENGINE_OPTIONS
): BlackRodTimeframeState {
  const candles = normalizeCandles(candlesInput);

  if (!candles.length) {
    throw new Error(
      `BLACK_ROD_ENGINE: No valid candles supplied for ${timeframe}.`
    );
  }

  const price = getLatestPrice(
    candles,
    currentPrice
  );

  /*
   * 1. SWINGS
   *
   * Confirmed pivots only. The swing module deliberately
   * excludes unconfirmed right-edge pivots.
   */
  const swings = detectSwings(
    candles,
    options.swings
  );

  /*
   * 2. STRUCTURE
   *
   * Uses confirmed swings to classify HH/HL/LH/LL
   * and detect BOS / CHoCH / MSS.
   */
  const structure = analyzeStructure(
    candles,
    swings.highs,
    swings.lows,
    options.structure
  );

  /*
   * 3. LIQUIDITY
   *
   * Maps swing highs/lows, equal levels and previous
   * period liquidity. Sweep detection remains separate.
   */
  const liquidity = analyzeLiquidity(
    candles,
    swings.highs,
    swings.lows,
    price,
    dailyCandles,
    options.liquidity
  );

  /*
   * 4. DISPLACEMENT
   *
   * Measures objective expansion in body/range and
   * close-location behavior.
   */
  const displacement = detectDisplacements(
    candles,
    options.displacement
  );

  /*
   * 5. FVG
   *
   * Detects three-candle imbalance zones and their
   * current mitigation state.
   */
  const fvg = detectFVGs(
    candles,
    price,
    options.fvg
  );

  /*
   * 6. ORDER BLOCKS
   *
   * Uses displacement plus the preceding opposing
   * candle to identify candidate institutional zones.
   */
  const orderBlocks = detectOrderBlocks(
    candles,
    price,
    options.orderBlocks
  );

  /*
   * 7. PREMIUM / DISCOUNT
   *
   * Determines the current dealing-range location
   * from confirmed swing structure.
   */
  const premiumDiscount =
    analyzePremiumDiscount(
      candles,
      swings.highs,
      swings.lows,
      price,
      options.premiumDiscount
    );

  /*
   * 8. MULTI-FACTOR CONFLUENCE
   *
   * This is evidence aggregation, not the final trade
   * decision. The validator remains the final gate.
   */
  const confluence = analyzeConfluence(
    structure,
    liquidity,
    displacement,
    fvg,
    orderBlocks,
    premiumDiscount,
    undefined,
    options.confluence
  );

  /*
   * 9. ENTRY VALIDATION
   *
   * The validator enforces:
   *
   * LIQUIDITY
   * → SWEEP
   * → DISPLACEMENT
   * → MSS/CHoCH/BOS
   * → FVG/OB
   * → PREMIUM/DISCOUNT
   * → MTF CONFLUENCE
   * → R:R >= 1:3.5
   */
  const validation = validateEntry(
    price,
    structure,
    liquidity,
    displacement,
    fvg,
    orderBlocks,
    premiumDiscount,
    confluence,
    options.validator
  );

  /*
   * weeklyCandles is accepted here so the engine API can
   * support previous-week liquidity without forcing every
   * liquidity implementation to consume it immediately.
   */
  void weeklyCandles;

  return {
    timeframe,
    candleCount: candles.length,
    latestCandle: getLatestCandle(candles),
    swings,
    structure,
    liquidity,
    displacement,
    fvg,
    orderBlocks,
    premiumDiscount,
    confluence,
    validation,
  };
}

function chooseFinalValidation(
  primary: EntryValidationResult,
  higherTimeframes: BlackRodTimeframeState[]
): EntryValidationResult {
  /*
   * A higher timeframe does not automatically create a
   * trade. It can only prevent the primary timeframe from
   * overriding a clear opposing structure.
   *
   * This keeps the engine conservative:
   * no forced trade when HTF evidence conflicts.
   */
  if (!primary.valid) {
    return primary;
  }

  const primaryDirection = primary.direction;

  const opposingHTF = higherTimeframes.some(
    (state) =>
      state.validation.direction !== "NEUTRAL" &&
      state.validation.direction !== primaryDirection &&
      (
        state.validation.status === "CONFIRMED" ||
        state.validation.valid
      )
  );

  if (opposingHTF) {
    return {
      ...primary,
      valid: false,
      action: "NO VALID ENTRY YET — WAIT.",
      status: "PARTIAL",
      missingConfirmations: [
        ...primary.missingConfirmations,
        "HIGHER-TIMEFRAME ALIGNMENT",
      ],
      reasons: [
        ...primary.reasons,
        "A higher timeframe has confirmed opposing directional evidence.",
      ],
      generatedAt: new Date().toISOString(),
    };
  }

  return primary;
}

export function runBlackRodEngine(
  input: BlackRodEngineInput,
  options: BlackRodEngineOptions = DEFAULT_ENGINE_OPTIONS
): BlackRodEngineResult {
  if (!input) {
    throw new Error(
      "BLACK_ROD_ENGINE: Input is required."
    );
  }

  if (!isFiniteNumber(input.currentPrice)) {
    throw new Error(
      "BLACK_ROD_ENGINE: currentPrice must be a finite number."
    );
  }

  if (!input.timeframe) {
    throw new Error(
      "BLACK_ROD_ENGINE: timeframe is required."
    );
  }

  if (!Array.isArray(input.candles)) {
    throw new Error(
      "BLACK_ROD_ENGINE: candles must be an array."
    );
  }

  const dailyCandles =
    normalizeCandles(
      input.dailyCandles ?? []
    );

  const weeklyCandles =
    normalizeCandles(
      input.weeklyCandles ?? []
    );

  const primaryState =
    buildTimeframeState(
      input.timeframe,
      input.candles,
      input.currentPrice,
      dailyCandles,
      weeklyCandles,
      options
    );

  const higherTimeframes =
    (input.higherTimeframes ?? [])
      .filter(
        (item) =>
          item &&
          item.timeframe &&
          Array.isArray(item.candles)
      )
      .map((item) =>
        buildTimeframeState(
          item.timeframe,
          item.candles,
          input.currentPrice,
          dailyCandles,
          weeklyCandles,
          options
        )
      );

  const finalValidation =
    chooseFinalValidation(
      primaryState.validation,
      higherTimeframes
    );

  return {
    engine: "BLACK_ROD",
    version: "1.0.0",
    timeframe: input.timeframe,
    currentPrice:
      getLatestPrice(
        normalizeCandles(input.candles),
        input.currentPrice
      ),
    state: primaryState,
    higherTimeframes,
    finalValidation,
    generatedAt: new Date().toISOString(),
  };
}

export function runBlackRodMultiTimeframeEngine(
  currentPrice: number,
  timeframes: BlackRodTimeframeInput[],
  dailyCandles: BlackRodCandle[] = [],
  weeklyCandles: BlackRodCandle[] = [],
  options: BlackRodEngineOptions = DEFAULT_ENGINE_OPTIONS
): BlackRodEngineResult {
  if (!Array.isArray(timeframes) || !timeframes.length) {
    throw new Error(
      "BLACK_ROD_ENGINE: At least one timeframe is required."
    );
  }

  const [primary, ...higher] = timeframes;

  return runBlackRodEngine(
    {
      currentPrice,
      timeframe: primary.timeframe,
      candles: primary.candles,
      dailyCandles,
      weeklyCandles,
      higherTimeframes: higher,
    },
    options
  );
}

export function getBlackRodSummary(
  result: BlackRodEngineResult
) {
  const validation = result.finalValidation;

  return {
    engine: result.engine,
    version: result.version,
    timeframe: result.timeframe,
    currentPrice: result.currentPrice,
    action: validation.action,
    direction: validation.direction,
    valid: validation.valid,
    status: validation.status,
    entry: validation.levels.entry,
    stopLoss: validation.levels.stopLoss,
    takeProfit1: validation.levels.takeProfit1,
    takeProfit2: validation.levels.takeProfit2,
    takeProfit3: validation.levels.takeProfit3,
    riskReward: validation.levels.riskReward,
    missingConfirmations:
      validation.missingConfirmations,
    reasons: validation.reasons,
    generatedAt: result.generatedAt,
  };
}
