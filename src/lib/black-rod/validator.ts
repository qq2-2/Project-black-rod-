import {
  StructureAnalysis,
  StructureEvent,
} from "./structure";
import {
  LiquidityAnalysis,
  LiquidityLevel,
} from "./liquidity";
import {
  DisplacementAnalysis,
  DisplacementEvent,
} from "./displacement";
import {
  FVGAnalysis,
  FVGZone,
} from "./fvg";
import {
  OrderBlockAnalysis,
  OrderBlock,
} from "./orderBlocks";
import {
  PremiumDiscountAnalysis,
} from "./premiumDiscount";
import {
  ConfluenceAnalysis,
} from "./confluence";

export type ValidatorAction =
  | "LONG BUY"
  | "SHORT SELL"
  | "NO VALID ENTRY YET — WAIT.";

export type ValidatorDirection =
  | "BULLISH"
  | "BEARISH"
  | "NEUTRAL";

export type ConfirmationStatus =
  | "CONFIRMED"
  | "PARTIAL"
  | "MISSING"
  | "INVALIDATED";

export interface TradeLevels {
  entry: number | null;
  stopLoss: number | null;
  takeProfit1: number | null;
  takeProfit2: number | null;
  takeProfit3: number | null;
  riskReward: number | null;
}

export interface ValidatorOptions {
  minimumRiskReward?: number;
  entryTolerancePercent?: number;
  stopBufferPercent?: number;
  minimumConfirmations?: number;
  requireLiquiditySweep?: boolean;
  requireDisplacement?: boolean;
  requireStructureShift?: boolean;
  requireImbalance?: boolean;
  requirePremiumDiscountAlignment?: boolean;
  requireMultiTimeframeConfluence?: boolean;
}

export interface ValidationStep {
  name: string;
  status: ConfirmationStatus;
  passed: boolean;
  reason: string;
}

export interface EntryValidationResult {
  valid: boolean;
  action: ValidatorAction;
  direction: ValidatorDirection;
  status: ConfirmationStatus;
  steps: ValidationStep[];
  missingConfirmations: string[];
  reasons: string[];
  invalidation: string | null;
  levels: TradeLevels;
  generatedAt: string;
}

const DEFAULTS: Required<ValidatorOptions> = {
  minimumRiskReward: 3.5,
  entryTolerancePercent: 0.15,
  stopBufferPercent: 0.05,
  minimumConfirmations: 4,
  requireLiquiditySweep: true,
  requireDisplacement: true,
  requireStructureShift: true,
  requireImbalance: true,
  requirePremiumDiscountAlignment: true,
  requireMultiTimeframeConfluence: true,
};

function mergeOptions(
  options: ValidatorOptions = {}
): Required<ValidatorOptions> {
  return {
    ...DEFAULTS,
    ...options,
  };
}

function finite(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value)
  );
}

function last<T>(
  items: T[] | undefined
): T | null {
  return items && items.length
    ? items[items.length - 1]
    : null;
}

function getLatestEvent(
  analysis: StructureAnalysis
): StructureEvent | null {
  return last(
    Array.isArray(analysis.events)
      ? analysis.events
      : []
  );
}

function getLatestDisplacement(
  analysis: DisplacementAnalysis
): DisplacementEvent | null {
  return analysis.latest ?? last(analysis.events);
}

function getActiveFVGs(
  analysis: FVGAnalysis
): FVGZone[] {
  return [
    ...(analysis.activeBullishFVGs ?? []),
    ...(analysis.activeBearishFVGs ?? []),
  ];
}

function getActiveOrderBlocks(
  analysis: OrderBlockAnalysis
): OrderBlock[] {
  return [
    ...(analysis.activeBullishOrderBlocks ?? []),
    ...(analysis.activeBearishOrderBlocks ?? []),
  ];
}

function zoneMidpoint(
  zone: { high: number; low: number }
): number {
  return (zone.high + zone.low) / 2;
}

function percentDistance(
  price: number,
  level: number
): number {
  if (
    !finite(price) ||
    !finite(level) ||
    level === 0
  ) {
    return Infinity;
  }

  return (
    (Math.abs(price - level) /
      Math.abs(level)) *
    100
  );
}

function isNearPrice(
  price: number,
  level: number,
  tolerancePercent: number
): boolean {
  return (
    percentDistance(
      price,
      level
    ) <= tolerancePercent
  );
}

function getAllLiquidityLevels(
  liquidity: LiquidityAnalysis
): LiquidityLevel[] {
  return [
    ...(liquidity.buySide ?? []),
    ...(liquidity.sellSide ?? []),
  ];
}

function getNearestLiquidity(
  levels: LiquidityLevel[],
  currentPrice: number,
  direction: "ABOVE" | "BELOW"
): LiquidityLevel | null {
  const candidates = levels.filter(
    (level) =>
      direction === "ABOVE"
        ? level.price > currentPrice
        : level.price < currentPrice
  );

  if (!candidates.length) {
    return null;
  }

  return candidates.reduce(
    (nearest, level) => {
      const nearestDistance =
        Math.abs(
          nearest.price -
            currentPrice
        );
      const levelDistance =
        Math.abs(
          level.price -
            currentPrice
        );

      return levelDistance <
        nearestDistance
        ? level
        : nearest;
    }
  );
}

function detectLiquiditySweep(
  currentPrice: number,
  liquidity: LiquidityAnalysis
): {
  bullish: boolean;
  bearish: boolean;
  reason: string;
  level: LiquidityLevel | null;
} {
  /*
   * LiquidityAnalysis currently maps liquidity pools
   * but does not expose a dedicated sweep event.
   *
   * Do not infer a sweep from current price alone.
   * A sweep detector will be added to liquidity.ts and
   * consumed here later.
   */
  void currentPrice;
  void liquidity;

  return {
    bullish: false,
    bearish: false,
    reason:
      "No dedicated liquidity-sweep event is available.",
    level: null,
  };
}

function determineDirection(
  structure: StructureAnalysis,
  displacement: DisplacementAnalysis,
  confluence: ConfluenceAnalysis
): ValidatorDirection {
  const structureBias =
    structure.bias;

  if (
    structureBias === "BULLISH" &&
    confluence.direction === "BULLISH"
  ) {
    return "BULLISH";
  }

  if (
    structureBias === "BEARISH" &&
    confluence.direction === "BEARISH"
  ) {
    return "BEARISH";
  }

  const latestDisplacement =
    getLatestDisplacement(
      displacement
    );

  if (
    latestDisplacement?.direction ===
      "BULLISH" &&
    confluence.direction !==
      "BEARISH"
  ) {
    return "BULLISH";
  }

  if (
    latestDisplacement?.direction ===
      "BEARISH" &&
    confluence.direction !==
      "BULLISH"
  ) {
    return "BEARISH";
  }

  if (structureBias === "BULLISH") {
    return "BULLISH";
  }

  if (structureBias === "BEARISH") {
    return "BEARISH";
  }

  return confluence.direction;
}

function hasStructureShift(
  structure: StructureAnalysis,
  direction: ValidatorDirection
): boolean {
  const event =
    getLatestEvent(structure);

  if (!event) {
    return false;
  }

  const eventType =
    String(event.type).toUpperCase();

  if (
    eventType !== "MSS" &&
    eventType !== "CHOCH" &&
    eventType !== "BOS"
  ) {
    return false;
  }

  return (
    event.direction === direction
  );
}

function hasDirectionalDisplacement(
  displacement: DisplacementAnalysis,
  direction: ValidatorDirection
): boolean {
  const latest =
    getLatestDisplacement(
      displacement
    );

  if (!latest) {
    return false;
  }

  return (
    latest.direction ===
      direction &&
    latest.strength !== "WEAK"
  );
}

function hasDirectionalImbalance(
  fvg: FVGAnalysis,
  orderBlocks: OrderBlockAnalysis,
  direction: ValidatorDirection,
  currentPrice: number,
  tolerancePercent: number
): boolean {
  if (direction === "NEUTRAL") {
    return false;
  }

  const fvgs =
    getActiveFVGs(fvg);
  const blocks =
    getActiveOrderBlocks(
      orderBlocks
    );

  const fvgMatch =
    fvgs.some((zone) => {
      const zoneDirection =
        zone.type === "BULLISH"
          ? "BULLISH"
          : "BEARISH";

      const inside =
        currentPrice >= zone.low &&
        currentPrice <= zone.high;

      const near =
        isNearPrice(
          currentPrice,
          zone.low,
          tolerancePercent
        ) ||
        isNearPrice(
          currentPrice,
          zone.high,
          tolerancePercent
        );

      return (
        zoneDirection ===
          direction &&
        (inside || near)
      );
    });

  const blockMatch =
    blocks.some((block) => {
      const blockDirection =
        block.type === "BULLISH"
          ? "BULLISH"
          : "BEARISH";

      const inside =
        currentPrice >= block.low &&
        currentPrice <= block.high;

      const near =
        isNearPrice(
          currentPrice,
          block.low,
          tolerancePercent
        ) ||
        isNearPrice(
          currentPrice,
          block.high,
          tolerancePercent
        );

      return (
        blockDirection ===
          direction &&
        (inside || near)
      );
    });

  return fvgMatch || blockMatch;
}

function hasPremiumDiscountAlignment(
  premiumDiscount: PremiumDiscountAnalysis,
  direction: ValidatorDirection
): boolean {
  if (direction === "BULLISH") {
    return (
      premiumDiscount.currentZone ===
      "DISCOUNT"
    );
  }

  if (direction === "BEARISH") {
    return (
      premiumDiscount.currentZone ===
      "PREMIUM"
    );
  }

  return false;
}

function hasMTFConfluence(
  confluence: ConfluenceAnalysis,
  direction: ValidatorDirection
): boolean {
  if (
    direction === "NEUTRAL" ||
    confluence.direction !== direction
  ) {
    return false;
  }

  const timeframes =
    confluence.timeframeConfluence ?? [];

  if (!timeframes.length) {
    return false;
  }

  const aligned =
    timeframes.filter(
      (timeframe) =>
        timeframe.bias === direction
    ).length;

  return aligned >= 2;
}

function calculateTradeLevels(
  currentPrice: number,
  direction: ValidatorDirection,
  liquidity: LiquidityAnalysis,
  fvg: FVGAnalysis,
  orderBlocks: OrderBlockAnalysis,
  premiumDiscount: PremiumDiscountAnalysis,
  options: Required<ValidatorOptions>
): TradeLevels {
  if (
    !finite(currentPrice) ||
    direction === "NEUTRAL"
  ) {
    return {
      entry: null,
      stopLoss: null,
      takeProfit1: null,
      takeProfit2: null,
      takeProfit3: null,
      riskReward: null,
    };
  }

  const activeFVGs =
    getActiveFVGs(fvg);
  const activeBlocks =
    getActiveOrderBlocks(
      orderBlocks
    );

  const levels =
    getAllLiquidityLevels(
      liquidity
    );

  let entry = currentPrice;
  let stopLoss:
    | number
    | null = null;

  if (direction === "BULLISH") {
    const bullishFVG =
      activeFVGs
        .filter(
          (zone) =>
            zone.type === "BULLISH"
        )
        .sort(
          (a, b) =>
            Math.abs(
              currentPrice -
                zoneMidpoint(a)
            ) -
            Math.abs(
              currentPrice -
                zoneMidpoint(b)
            )
        )[0];

    const bullishOB =
      activeBlocks
        .filter(
          (block) =>
            block.type === "BULLISH"
        )
        .sort(
          (a, b) =>
            Math.abs(
              currentPrice -
                zoneMidpoint(a)
            ) -
            Math.abs(
              currentPrice -
                zoneMidpoint(b)
            )
        )[0];

    if (bullishFVG) {
      entry =
        zoneMidpoint(
          bullishFVG
        );
    } else if (bullishOB) {
      entry =
        zoneMidpoint(
          bullishOB
        );
    }

    const structuralLow =
      bullishOB?.low ??
      bullishFVG?.low ??
      null;

    if (finite(structuralLow)) {
      stopLoss =
        structuralLow *
        (1 -
          options.stopBufferPercent /
            100);
    }

    const target1 =
      getNearestLiquidity(
        levels,
        entry,
        "ABOVE"
      );

    const target2Candidates =
      levels
        .filter(
          (level) =>
            level.price > entry
        )
        .sort(
          (a, b) =>
            a.price - b.price
        );

    const tp1 =
      target1?.price ?? null;

    const tp2 =
      target2Candidates[1]
        ?.price ?? null;

    const range =
      premiumDiscount.dealingRange;

    const tp3 =
      finite(range?.high) &&
      range!.high > entry
        ? range!.high
        : target2Candidates[2]
            ?.price ??
          null;

    return finalizeLevels(
      entry,
      stopLoss,
      tp1,
      tp2,
      tp3,
      direction,
      options.minimumRiskReward
    );
  }

  const bearishFVG =
    activeFVGs
      .filter(
        (zone) =>
          zone.type === "BEARISH"
      )
      .sort(
        (a, b) =>
          Math.abs(
            currentPrice -
              zoneMidpoint(a)
          ) -
          Math.abs(
            currentPrice -
              zoneMidpoint(b)
          )
      )[0];

  const bearishOB =
    activeBlocks
      .filter(
        (block) =>
          block.type === "BEARISH"
      )
      .sort(
        (a, b) =>
          Math.abs(
            currentPrice -
              zoneMidpoint(a)
          ) -
          Math.abs(
            currentPrice -
              zoneMidpoint(b)
          )
      )[0];

  if (bearishFVG) {
    entry =
      zoneMidpoint(
        bearishFVG
      );
  } else if (bearishOB) {
    entry =
      zoneMidpoint(
        bearishOB
      );
  }

  const structuralHigh =
    bearishOB?.high ??
    bearishFVG?.high ??
    null;

  if (finite(structuralHigh)) {
    stopLoss =
      structuralHigh *
      (1 +
        options.stopBufferPercent /
          100);
  }

  const target1 =
    getNearestLiquidity(
      levels,
      entry,
      "BELOW"
    );

  const target2Candidates =
    levels
      .filter(
        (level) =>
          level.price < entry
      )
      .sort(
        (a, b) =>
          b.price - a.price
      );

  const tp1 =
    target1?.price ?? null;

  const tp2 =
    target2Candidates[1]
      ?.price ?? null;

  const range =
    premiumDiscount.dealingRange;

  const tp3 =
    finite(range?.low) &&
    range!.low < entry
      ? range!.low
      : target2Candidates[2]
          ?.price ??
        null;

  return finalizeLevels(
    entry,
    stopLoss,
    tp1,
    tp2,
    tp3,
    direction,
    options.minimumRiskReward
  );
}

function finalizeLevels(
  entry: number,
  stopLoss: number | null,
  tp1: number | null,
  tp2: number | null,
  tp3: number | null,
  direction: ValidatorDirection,
  minimumRiskReward: number
): TradeLevels {
  if (
    !finite(entry) ||
    !finite(stopLoss) ||
    !finite(tp1)
  ) {
    return {
      entry: finite(entry)
        ? entry
        : null,
      stopLoss: finite(stopLoss)
        ? stopLoss
        : null,
      takeProfit1: finite(tp1)
        ? tp1
        : null,
      takeProfit2: finite(tp2)
        ? tp2
        : null,
      takeProfit3: finite(tp3)
        ? tp3
        : null,
      riskReward: null,
    };
  }

  const risk =
    direction === "BULLISH"
      ? entry - stopLoss
      : stopLoss - entry;

  const reward =
    direction === "BULLISH"
      ? tp1 - entry
      : entry - tp1;

  if (
    risk <= 0 ||
    reward <= 0
  ) {
    return {
      entry,
      stopLoss,
      takeProfit1: tp1,
      takeProfit2: tp2,
      takeProfit3: tp3,
      riskReward: null,
    };
  }

  let finalTP1 = tp1;
  let finalTP2 = tp2;
  let finalTP3 = tp3;

  if (
    reward / risk <
    minimumRiskReward
  ) {
    /*
     * Do not manufacture a valid trade by moving TP
     * to an arbitrary price. The target must be backed
     * by actual market/liquidity structure.
     *
     * Leave the existing targets untouched and let the
     * final R:R gate reject the setup if it is below 1:3.5.
     */
    void minimumRiskReward;
  }

  const finalReward =
    direction === "BULLISH"
      ? finalTP1 - entry
      : entry - finalTP1;

  return {
    entry,
    stopLoss,
    takeProfit1: finalTP1,
    takeProfit2: finalTP2,
    takeProfit3: finalTP3,
    riskReward:
      risk > 0 &&
      finalReward > 0
        ? finalReward / risk
        : null,
  };
}

export function validateEntry(
  currentPrice: number,
  structure: StructureAnalysis,
  liquidity: LiquidityAnalysis,
  displacement: DisplacementAnalysis,
  fvg: FVGAnalysis,
  orderBlocks: OrderBlockAnalysis,
  premiumDiscount: PremiumDiscountAnalysis,
  confluence: ConfluenceAnalysis,
  options: ValidatorOptions = {}
): EntryValidationResult {
  const config =
    mergeOptions(options);

  const direction =
    determineDirection(
      structure,
      displacement,
      confluence
    );

  const sweep =
    detectLiquiditySweep(
      currentPrice,
      liquidity
    );

  const structureShift =
    hasStructureShift(
      structure,
      direction
    );

  const directionalDisplacement =
    hasDirectionalDisplacement(
      displacement,
      direction
    );

  const imbalance =
    hasDirectionalImbalance(
      fvg,
      orderBlocks,
      direction,
      currentPrice,
      config.entryTolerancePercent
    );

  const pdAlignment =
    hasPremiumDiscountAlignment(
      premiumDiscount,
      direction
    );

  const mtfAlignment =
    hasMTFConfluence(
      confluence,
      direction
    );

  const steps:
    ValidationStep[] = [
      {
        name:
          "LIQUIDITY SWEEP",
        status:
          direction ===
          "BULLISH"
            ? sweep.bullish
              ? "CONFIRMED"
              : "MISSING"
            : direction ===
                "BEARISH"
              ? sweep.bearish
                ? "CONFIRMED"
                : "MISSING"
              : "MISSING",
        passed:
          direction ===
          "BULLISH"
            ? sweep.bullish
            : direction ===
                "BEARISH"
              ? sweep.bearish
              : false,
        reason:
          sweep.reason,
      },
      {
        name:
          "DISPLACEMENT",
        status:
          directionalDisplacement
            ? "CONFIRMED"
            : "MISSING",
        passed:
          directionalDisplacement,
        reason:
          directionalDisplacement
            ? `Directional ${direction.toLowerCase()} displacement confirmed.`
            : "No strong directional displacement is confirmed.",
      },
      {
        name:
          "MSS / CHoCH / BOS",
        status:
          structureShift
            ? "CONFIRMED"
            : "MISSING",
        passed:
          structureShift,
        reason:
          structureShift
            ? "Directional structure break/shift confirmed."
            : "No confirmed directional structure shift is available.",
      },
      {
        name:
          "FVG / ORDER BLOCK",
        status:
          imbalance
            ? "CONFIRMED"
            : "MISSING",
        passed:
          imbalance,
        reason:
          imbalance
            ? "Directional imbalance or order block is near price."
            : "No usable directional FVG/order block is near current price.",
      },
      {
        name:
          "PREMIUM / DISCOUNT",
        status:
          pdAlignment
            ? "CONFIRMED"
            : "MISSING",
        passed:
          pdAlignment,
        reason:
          pdAlignment
            ? `Price is in ${direction === "BULLISH" ? "discount" : "premium"} for the selected dealing range.`
            : "Premium/discount location does not align with the proposed direction.",
      },
      {
        name:
          "MULTI-TIMEFRAME CONFLUENCE",
        status:
          mtfAlignment
            ? "CONFIRMED"
            : "MISSING",
        passed:
          mtfAlignment,
        reason:
          mtfAlignment
            ? "At least two analyzed timeframes align with the proposed direction."
            : "Multi-timeframe directional alignment is insufficient.",
      },
    ];

  const requiredSteps =
    steps.filter((step) => {
      if (
        step.name ===
          "LIQUIDITY SWEEP" &&
        !config.requireLiquiditySweep
      ) {
        return false;
      }

      if (
        step.name ===
          "DISPLACEMENT" &&
        !config.requireDisplacement
      ) {
        return false;
      }

      if (
        step.name ===
          "MSS / CHoCH / BOS" &&
        !config.requireStructureShift
      ) {
        return false;
      }

      if (
        step.name ===
          "FVG / ORDER BLOCK" &&
        !config.requireImbalance
      ) {
        return false;
      }

      if (
        step.name ===
          "PREMIUM / DISCOUNT" &&
        !config.requirePremiumDiscountAlignment
      ) {
        return false;
      }

      if (
        step.name ===
          "MULTI-TIMEFRAME CONFLUENCE" &&
        !config.requireMultiTimeframeConfluence
      ) {
        return false;
      }

      return true;
    });

  const passedCount =
    requiredSteps.filter(
      (step) => step.passed
    ).length;

  const missingConfirmations =
    requiredSteps
      .filter(
        (step) => !step.passed
      )
      .map(
        (step) => step.name
      );

  const reasons =
    requiredSteps
      .filter(
        (step) => !step.passed
      )
      .map(
        (step) => step.reason
      );

  if (
    direction === "NEUTRAL" ||
    passedCount <
      config.minimumConfirmations ||
    missingConfirmations.length > 0
  ) {
    return {
      valid: false,
      action:
        "NO VALID ENTRY YET — WAIT.",
      direction,
      status: "MISSING",
      steps,
      missingConfirmations,
      reasons:
        reasons.length
          ? reasons
          : [
              "The market has not produced enough objective confirmations.",
            ],
      invalidation: null,
      levels: {
        entry: null,
        stopLoss: null,
        takeProfit1:
          null,
        takeProfit2:
          null,
        takeProfit3:
          null,
        riskReward: null,
      },
      generatedAt:
        new Date().toISOString(),
    };
  }

  const levels =
    calculateTradeLevels(
      currentPrice,
      direction,
      liquidity,
      fvg,
      orderBlocks,
      premiumDiscount,
      config
    );

  if (
    !finite(levels.entry) ||
    !finite(levels.stopLoss) ||
    !finite(
      levels.takeProfit1
    ) ||
    !finite(
      levels.riskReward
    ) ||
    levels.riskReward <
      config.minimumRiskReward
  ) {
    return {
      valid: false,
      action:
        "NO VALID ENTRY YET — WAIT.",
      direction,
      status: "PARTIAL",
      steps,
      missingConfirmations: [
        "R:R >= 1:3.5",
      ],
      reasons: [
        "The proposed setup does not produce a valid minimum 1:3.5 risk-to-reward structure.",
      ],
      invalidation:
        direction === "BULLISH"
          ? "Close below the structural stop/invalidation level."
          : "Close above the structural stop/invalidation level.",
      levels,
      generatedAt:
        new Date().toISOString(),
    };
  }

  const action: ValidatorAction =
    direction === "BULLISH"
      ? "LONG BUY"
      : "SHORT SELL";

  return {
    valid: true,
    action,
    direction,
    status: "CONFIRMED",
    steps,
    missingConfirmations: [],
    reasons: [
      "Liquidity, displacement, structure, location, imbalance and multi-timeframe conditions are aligned.",
      `Validated minimum risk-to-reward: 1:${levels.riskReward.toFixed(2)}.`,
    ],
    invalidation:
      direction === "BULLISH"
        ? `Invalid if price closes below ${levels.stopLoss!.toFixed(2)}.`
        : `Invalid if price closes above ${levels.stopLoss!.toFixed(2)}.`,
    levels,
    generatedAt:
      new Date().toISOString(),
  };
}
