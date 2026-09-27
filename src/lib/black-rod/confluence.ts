import {
  StructureAnalysis,
  StructureEvent,
} from "./structure";
import { LiquidityAnalysis } from "./liquidity";
import {
  DisplacementAnalysis,
  DisplacementEvent,
} from "./displacement";
import { FVGAnalysis, FVGZone } from "./fvg";
import {
  OrderBlockAnalysis,
  OrderBlock,
} from "./orderBlocks";
import { PremiumDiscountAnalysis } from "./premiumDiscount";

export type ConfluenceDirection =
  | "BULLISH"
  | "BEARISH"
  | "NEUTRAL";

export type ConfluenceStrength =
  | "VERY_STRONG"
  | "STRONG"
  | "MODERATE"
  | "WEAK"
  | "NONE";

export type ConfluenceFactorType =
  | "STRUCTURE"
  | "LIQUIDITY"
  | "DISPLACEMENT"
  | "FVG"
  | "ORDER_BLOCK"
  | "PREMIUM_DISCOUNT"
  | "MULTI_TIMEFRAME";

export interface ConfluenceFactor {
  type: ConfluenceFactorType;
  direction: ConfluenceDirection;
  weight: number;
  score: number;
  confirmed: boolean;
  reason: string;
}

export interface TimeframeConfluence {
  timeframe: string;
  bias: ConfluenceDirection;
  strength: ConfluenceStrength;
  score: number;
  confirmed: boolean;
}

export interface ConfluenceAnalysis {
  direction: ConfluenceDirection;
  strength: ConfluenceStrength;
  bullishScore: number;
  bearishScore: number;
  neutralScore: number;
  factors: ConfluenceFactor[];
  timeframeConfluence: TimeframeConfluence[];
  confirmedFactors: number;
  totalFactors: number;
  summary: string;
}

export interface ConfluenceOptions {
  structureWeight?: number;
  liquidityWeight?: number;
  displacementWeight?: number;
  fvgWeight?: number;
  orderBlockWeight?: number;
  premiumDiscountWeight?: number;
  multiTimeframeWeight?: number;
  strongThreshold?: number;
  moderateThreshold?: number;
  weakThreshold?: number;
  minimumDirectionalEdge?: number;
}

const DEFAULTS: Required<ConfluenceOptions> = {
  structureWeight: 3,
  liquidityWeight: 2,
  displacementWeight: 2,
  fvgWeight: 2,
  orderBlockWeight: 2,
  premiumDiscountWeight: 2,
  multiTimeframeWeight: 3,
  strongThreshold: 8,
  moderateThreshold: 5,
  weakThreshold: 2,
  minimumDirectionalEdge: 2,
};

function mergeOptions(
  options: ConfluenceOptions = {}
): Required<ConfluenceOptions> {
  return { ...DEFAULTS, ...options };
}

function getStructureBias(
  analysis: StructureAnalysis
): ConfluenceDirection {
  if (analysis.bias === "BULLISH") return "BULLISH";
  if (analysis.bias === "BEARISH") return "BEARISH";
  return "NEUTRAL";
}

function getLatestStructureEvent(
  analysis: StructureAnalysis
): StructureEvent | null {
  if (analysis.latestEvent) {
    return analysis.latestEvent;
  }

  return analysis.events.length
    ? analysis.events[analysis.events.length - 1]
    : null;
}

function getLatestDisplacement(
  analysis: DisplacementAnalysis
): DisplacementEvent | null {
  if (analysis.latest) {
    return analysis.latest;
  }

  return analysis.events.length
    ? analysis.events[analysis.events.length - 1]
    : null;
}

function getActiveFVGs(
  analysis: FVGAnalysis
): FVGZone[] {
  return [
    ...analysis.activeBullishFVGs,
    ...analysis.activeBearishFVGs,
  ];
}

function getActiveOrderBlocks(
  analysis: OrderBlockAnalysis
): OrderBlock[] {
  return [
    ...analysis.activeBullishOrderBlocks,
    ...analysis.activeBearishOrderBlocks,
  ];
}

function calculateStructureFactor(
  analysis: StructureAnalysis,
  weight: number
): ConfluenceFactor {
  const bias = getStructureBias(analysis);
  const latestEvent = getLatestStructureEvent(analysis);

  const eventDirection =
    latestEvent?.direction === "BULLISH"
      ? "BULLISH"
      : latestEvent?.direction === "BEARISH"
        ? "BEARISH"
        : "NEUTRAL";

  const direction =
    eventDirection !== "NEUTRAL"
      ? eventDirection
      : bias;

  const confirmed = direction !== "NEUTRAL";
  const eventName = latestEvent?.type
    ? String(latestEvent.type)
    : "structure";

  return {
    type: "STRUCTURE",
    direction,
    weight,
    score: confirmed ? weight : 0,
    confirmed,
    reason: confirmed
      ? `${eventName} / structure bias is ${direction.toLowerCase()}.`
      : "No directional market structure is confirmed.",
  };
}

function calculateLiquidityFactor(
  analysis: LiquidityAnalysis,
  weight: number
): ConfluenceFactor {
  const bslCount = analysis.buySide.length;
  const sslCount = analysis.sellSide.length;

  // Liquidity levels alone are not directional confirmation.
  // A sweep detector can be added later without changing this interface.
  return {
    type: "LIQUIDITY",
    direction: "NEUTRAL",
    weight,
    score: 0,
    confirmed: false,
    reason: `Liquidity map contains ${bslCount} BSL and ${sslCount} SSL levels; no directional sweep is confirmed.`,
  };
}

function calculateDisplacementFactor(
  analysis: DisplacementAnalysis,
  weight: number
): ConfluenceFactor {
  const latest = getLatestDisplacement(analysis);

  if (!latest) {
    return {
      type: "DISPLACEMENT",
      direction: "NEUTRAL",
      weight,
      score: 0,
      confirmed: false,
      reason: "No displacement event is confirmed.",
    };
  }

  const direction =
    latest.direction === "BULLISH"
      ? "BULLISH"
      : "BEARISH";

  const strength = String(latest.strength).toUpperCase();
  const confirmed =
    strength === "MODERATE" ||
    strength === "STRONG";

  return {
    type: "DISPLACEMENT",
    direction,
    weight,
    score: confirmed ? weight : 0,
    confirmed,
    reason: confirmed
      ? `${strength.toLowerCase()} ${direction.toLowerCase()} displacement is confirmed.`
      : "Displacement exists but is too weak for directional confluence.",
  };
}

function calculateFVGFactor(
  analysis: FVGAnalysis,
  weight: number
): ConfluenceFactor {
  const active = getActiveFVGs(analysis);

  if (!active.length) {
    return {
      type: "FVG",
      direction: "NEUTRAL",
      weight,
      score: 0,
      confirmed: false,
      reason: "No active FVG is available.",
    };
  }

  const bullish = active.filter(
    (zone) => zone.type === "BULLISH"
  ).length;

  const bearish = active.filter(
    (zone) => zone.type === "BEARISH"
  ).length;

  if (bullish > bearish) {
    return {
      type: "FVG",
      direction: "BULLISH",
      weight,
      score: weight,
      confirmed: true,
      reason: `${bullish} active bullish FVG(s) versus ${bearish} bearish FVG(s).`,
    };
  }

  if (bearish > bullish) {
    return {
      type: "FVG",
      direction: "BEARISH",
      weight,
      score: weight,
      confirmed: true,
      reason: `${bearish} active bearish FVG(s) versus ${bullish} bullish FVG(s).`,
    };
  }

  return {
    type: "FVG",
    direction: "NEUTRAL",
    weight,
    score: 0,
    confirmed: false,
    reason: "Active bullish and bearish FVG counts are balanced.",
  };
}

function calculateOrderBlockFactor(
  analysis: OrderBlockAnalysis,
  weight: number
): ConfluenceFactor {
  const active = getActiveOrderBlocks(analysis);

  if (!active.length) {
    return {
      type: "ORDER_BLOCK",
      direction: "NEUTRAL",
      weight,
      score: 0,
      confirmed: false,
      reason: "No active order block is available.",
    };
  }

  const bullish = active.filter(
    (block) => block.type === "BULLISH"
  ).length;

  const bearish = active.filter(
    (block) => block.type === "BEARISH"
  ).length;

  if (bullish > bearish) {
    return {
      type: "ORDER_BLOCK",
      direction: "BULLISH",
      weight,
      score: weight,
      confirmed: true,
      reason: `${bullish} active bullish order block(s) versus ${bearish} bearish.`,
    };
  }

  if (bearish > bullish) {
    return {
      type: "ORDER_BLOCK",
      direction: "BEARISH",
      weight,
      score: weight,
      confirmed: true,
      reason: `${bearish} active bearish order block(s) versus ${bullish} bullish.`,
    };
  }

  return {
    type: "ORDER_BLOCK",
    direction: "NEUTRAL",
    weight,
    score: 0,
    confirmed: false,
    reason: "Active bullish and bearish order blocks are balanced.",
  };
}

function calculatePremiumDiscountFactor(
  analysis: PremiumDiscountAnalysis,
  weight: number
): ConfluenceFactor {
  const zone = analysis.currentZone;

  if (zone === "DISCOUNT") {
    return {
      type: "PREMIUM_DISCOUNT",
      direction: "BULLISH",
      weight,
      score: weight,
      confirmed: true,
      reason:
        "Price is trading in the discount half of the dealing range.",
    };
  }

  if (zone === "PREMIUM") {
    return {
      type: "PREMIUM_DISCOUNT",
      direction: "BEARISH",
      weight,
      score: weight,
      confirmed: true,
      reason:
        "Price is trading in the premium half of the dealing range.",
    };
  }

  return {
    type: "PREMIUM_DISCOUNT",
    direction: "NEUTRAL",
    weight,
    score: 0,
    confirmed: false,
    reason:
      "Price is at/near equilibrium and has no premium/discount directional advantage.",
  };
}

function calculateMTFFactor(
  timeframes: TimeframeConfluence[],
  weight: number
): ConfluenceFactor {
  if (!timeframes.length) {
    return {
      type: "MULTI_TIMEFRAME",
      direction: "NEUTRAL",
      weight,
      score: 0,
      confirmed: false,
      reason: "No higher-timeframe confluence was supplied.",
    };
  }

  const bullish = timeframes.filter(
    (item) => item.bias === "BULLISH"
  ).length;

  const bearish = timeframes.filter(
    (item) => item.bias === "BEARISH"
  ).length;

  if (bullish > bearish) {
    return {
      type: "MULTI_TIMEFRAME",
      direction: "BULLISH",
      weight,
      score: weight,
      confirmed: bullish >= 2,
      reason: `${bullish} timeframe(s) are bullish versus ${bearish} bearish.`,
    };
  }

  if (bearish > bullish) {
    return {
      type: "MULTI_TIMEFRAME",
      direction: "BEARISH",
      weight,
      score: weight,
      confirmed: bearish >= 2,
      reason: `${bearish} timeframe(s) are bearish versus ${bullish} bullish.`,
    };
  }

  return {
    type: "MULTI_TIMEFRAME",
    direction: "NEUTRAL",
    weight,
    score: 0,
    confirmed: false,
    reason: "Higher-timeframe directional evidence is balanced.",
  };
}

function getStrength(
  score: number,
  options: Required<ConfluenceOptions>
): ConfluenceStrength {
  if (score >= options.strongThreshold + 3) {
    return "VERY_STRONG";
  }

  if (score >= options.strongThreshold) {
    return "STRONG";
  }

  if (score >= options.moderateThreshold) {
    return "MODERATE";
  }

  if (score >= options.weakThreshold) {
    return "WEAK";
  }

  return "NONE";
}

function resolveDirection(
  bullishScore: number,
  bearishScore: number,
  minimumEdge: number
): ConfluenceDirection {
  if (bullishScore - bearishScore >= minimumEdge) {
    return "BULLISH";
  }

  if (bearishScore - bullishScore >= minimumEdge) {
    return "BEARISH";
  }

  return "NEUTRAL";
}

function buildTimeframeConfluenceInternal(
  structure: StructureAnalysis,
  timeframe: string,
  options: Required<ConfluenceOptions>
): TimeframeConfluence {
  const bias = getStructureBias(structure);
  const score =
    bias === "NEUTRAL"
      ? 0
      : options.structureWeight;

  return {
    timeframe,
    bias,
    strength: getStrength(score, options),
    score,
    confirmed: bias !== "NEUTRAL",
  };
}

export function analyzeConfluence(
  structure: StructureAnalysis,
  liquidity: LiquidityAnalysis,
  displacement: DisplacementAnalysis,
  fvg: FVGAnalysis,
  orderBlocks: OrderBlockAnalysis,
  premiumDiscount: PremiumDiscountAnalysis,
  timeframeConfluence:
    | TimeframeConfluence[]
    | undefined = undefined,
  options: ConfluenceOptions = {}
): ConfluenceAnalysis {
  const config = mergeOptions(options);
  const mtf = timeframeConfluence ?? [];

  const factors: ConfluenceFactor[] = [
    calculateStructureFactor(
      structure,
      config.structureWeight
    ),
    calculateLiquidityFactor(
      liquidity,
      config.liquidityWeight
    ),
    calculateDisplacementFactor(
      displacement,
      config.displacementWeight
    ),
    calculateFVGFactor(
      fvg,
      config.fvgWeight
    ),
    calculateOrderBlockFactor(
      orderBlocks,
      config.orderBlockWeight
    ),
    calculatePremiumDiscountFactor(
      premiumDiscount,
      config.premiumDiscountWeight
    ),
    calculateMTFFactor(
      mtf,
      config.multiTimeframeWeight
    ),
  ];

  const bullishScore = factors.reduce(
    (total, factor) =>
      total +
      (factor.direction === "BULLISH"
        ? factor.score
        : 0),
    0
  );

  const bearishScore = factors.reduce(
    (total, factor) =>
      total +
      (factor.direction === "BEARISH"
        ? factor.score
        : 0),
    0
  );

  const neutralScore = factors.reduce(
    (total, factor) =>
      total +
      (factor.direction === "NEUTRAL"
        ? factor.weight
        : 0),
    0
  );

  const direction = resolveDirection(
    bullishScore,
    bearishScore,
    config.minimumDirectionalEdge
  );

  const directionalScore =
    direction === "BULLISH"
      ? bullishScore
      : direction === "BEARISH"
        ? bearishScore
        : 0;

  const strength = getStrength(
    directionalScore,
    config
  );

  const confirmedFactors =
    factors.filter(
      (factor) => factor.confirmed
    ).length;

  const summary =
    direction === "NEUTRAL"
      ? "No sufficient directional confluence is confirmed."
      : `${direction} confluence is ${strength.toLowerCase()} with ${direction === "BULLISH" ? bullishScore : bearishScore} weighted points.`;

  return {
    direction,
    strength,
    bullishScore,
    bearishScore,
    neutralScore,
    factors,
    timeframeConfluence: mtf,
    confirmedFactors,
    totalFactors: factors.length,
    summary,
  };
}

export function buildTimeframeConfluence(
  structure: StructureAnalysis,
  timeframe: string,
  options: ConfluenceOptions = {}
): TimeframeConfluence {
  return buildTimeframeConfluenceInternal(
    structure,
    timeframe,
    mergeOptions(options)
  );
}

export function combineTimeframeConfluence(
  analyses: Array<{
    timeframe: string;
    structure: StructureAnalysis;
  }>,
  options: ConfluenceOptions = {}
): TimeframeConfluence[] {
  const config = mergeOptions(options);

  return analyses.map((item) =>
    buildTimeframeConfluenceInternal(
      item.structure,
      item.timeframe,
      config
    )
  );
}

export function getConfluenceDirection(
  analysis: ConfluenceAnalysis
): ConfluenceDirection {
  return analysis.direction;
}

export function getConfluenceStrength(
  analysis: ConfluenceAnalysis
): ConfluenceStrength {
  return analysis.strength;
}
