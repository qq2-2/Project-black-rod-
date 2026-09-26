import { StructureAnalysis } from "./structure";
import { LiquidityAnalysis } from "./liquidity";
import { DisplacementAnalysis } from "./displacement";
import { FVGAnalysis } from "./fvg";
import { OrderBlockAnalysis } from "./orderBlocks";
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
  score: number;
  weight: number;
  reason: string;
  confirmed: boolean;
}

export interface TimeframeConfluence {
  timeframe: string;
  direction: ConfluenceDirection;
  score: number;
  structureBias: string | null;
  latestStructureEvent: string | null;
  latestDisplacement: string | null;
  activeFVGCount: number;
  activeOrderBlockCount: number;
}

export interface ConfluenceAnalysis {
  direction: ConfluenceDirection;
  strength: ConfluenceStrength;
  bullishScore: number;
  bearishScore: number;
  neutralScore: number;
  totalScore: number;
  factors: ConfluenceFactor[];
  bullishFactors: ConfluenceFactor[];
  bearishFactors: ConfluenceFactor[];
  timeframeConfluence: TimeframeConfluence[];
  hasLiquidityConfluence: boolean;
  hasStructureConfluence: boolean;
  hasDisplacementConfluence: boolean;
  hasFVGConfluence: boolean;
  hasOrderBlockConfluence: boolean;
  hasPremiumDiscountConfluence: boolean;
  hasMTFConfluence: boolean;
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

const DEFAULT_OPTIONS: Required<ConfluenceOptions> = {
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

function isObject(
  value: unknown
): value is Record<string, any> {
  return (
    typeof value === "object" &&
    value !== null
  );
}

function getArray(
  value: unknown,
  key: string
): any[] {
  if (!isObject(value)) {
    return [];
  }

  return Array.isArray(value[key])
    ? value[key]
    : [];
}

function getString(
  value: unknown,
  key: string
): string | null {
  if (!isObject(value)) {
    return null;
  }

  const result = value[key];

  return typeof result === "string"
    ? result
    : null;
}

function normalizeDirection(
  value: unknown
): ConfluenceDirection {
  if (
    typeof value !== "string"
  ) {
    return "NEUTRAL";
  }

  const normalized =
    value.toUpperCase();

  if (
    normalized === "BULLISH" ||
    normalized === "BEARISH"
  ) {
    return normalized;
  }

  return "NEUTRAL";
}

function getStructureBias(
  analysis: StructureAnalysis | null
): ConfluenceDirection {
  if (!analysis) {
    return "NEUTRAL";
  }

  return normalizeDirection(
    getString(
      analysis,
      "bias"
    )
  );
}

function getLatestStructureEvent(
  analysis: StructureAnalysis | null
): string | null {
  if (!analysis) {
    return null;
  }

  const latestEvent =
    (isObject(analysis) &&
      analysis.latestEvent) ||
    null;

  if (
    isObject(latestEvent) &&
    typeof latestEvent.type ===
      "string"
  ) {
    return latestEvent.type;
  }

  const events =
    getArray(
      analysis,
      "events"
    );

  if (!events.length) {
    return null;
  }

  const latest =
    events[events.length - 1];

  if (
    isObject(latest) &&
    typeof latest.type ===
      "string"
  ) {
    return latest.type;
  }

  return null;
}

function getLatestDisplacementDirection(
  analysis: DisplacementAnalysis | null
): ConfluenceDirection {
  if (!analysis) {
    return "NEUTRAL";
  }

  const latest =
    isObject(analysis)
      ? analysis.latest
      : null;

  if (isObject(latest)) {
    return normalizeDirection(
      latest.direction
    );
  }

  const events =
    getArray(
      analysis,
      "events"
    );

  if (!events.length) {
    return "NEUTRAL";
  }

  const latestEvent =
    events[events.length - 1];

  if (
    isObject(latestEvent)
  ) {
    return normalizeDirection(
      latestEvent.direction
    );
  }

  return "NEUTRAL";
}

function getActiveFVGs(
  analysis: FVGAnalysis | null
): any[] {
  if (!analysis) {
    return [];
  }

  const active =
    getArray(
      analysis,
      "activeFVGs"
    );

  if (active.length) {
    return active;
  }

  const fvgs =
    getArray(
      analysis,
      "fvgs"
    );

  return fvgs.filter(
    (fvg) =>
      isObject(fvg) &&
      (
        fvg.status ===
          "ACTIVE" ||
        fvg.status ===
          "PARTIALLY_MITIGATED"
      )
  );
}

function getActiveOrderBlocks(
  analysis: OrderBlockAnalysis | null
): any[] {
  if (!analysis) {
    return [];
  }

  const active =
    getArray(
      analysis,
      "activeOrderBlocks"
    );

  if (active.length) {
    return active;
  }

  const orderBlocks =
    getArray(
      analysis,
      "orderBlocks"
    );

  return orderBlocks.filter(
    (orderBlock) =>
      isObject(orderBlock) &&
      orderBlock.status ===
        "ACTIVE"
  );
}

function getLiquidityLevels(
  analysis: LiquidityAnalysis | null
): any[] {
  if (!analysis) {
    return [];
  }

  return getArray(
    analysis,
    "levels"
  );
}

function countDirectionalLiquidity(
  analysis: LiquidityAnalysis | null,
  direction: ConfluenceDirection
): number {
  const levels =
    getLiquidityLevels(
      analysis
    );

  if (
    direction ===
    "BULLISH"
  ) {
    return levels.filter(
      (level) =>
        isObject(level) &&
        level.type === "SSL"
    ).length;
  }

  if (
    direction ===
    "BEARISH"
  ) {
    return levels.filter(
      (level) =>
        isObject(level) &&
        level.type === "BSL"
    ).length;
  }

  return 0;
}

function createFactor(
  type: ConfluenceFactorType,
  direction: ConfluenceDirection,
  score: number,
  weight: number,
  reason: string
): ConfluenceFactor {
  return {
    type,
    direction,
    score,
    weight,
    reason,
    confirmed:
      direction !== "NEUTRAL" &&
      score > 0,
  };
}

function calculateStructureFactor(
  analysis: StructureAnalysis | null,
  weight: number
): ConfluenceFactor {
  const direction =
    getStructureBias(
      analysis
    );

  const event =
    getLatestStructureEvent(
      analysis
    );

  if (
    direction === "BULLISH"
  ) {
    return createFactor(
      "STRUCTURE",
      direction,
      weight,
      weight,
      event
        ? `Bullish market structure with latest ${event}.`
        : "Bullish market structure."
    );
  }

  if (
    direction === "BEARISH"
  ) {
    return createFactor(
      "STRUCTURE",
      direction,
      weight,
      weight,
      event
        ? `Bearish market structure with latest ${event}.`
        : "Bearish market structure."
    );
  }

  return createFactor(
    "STRUCTURE",
    "NEUTRAL",
    0,
    weight,
    "No confirmed directional structure."
  );
}

function calculateLiquidityFactor(
  analysis: LiquidityAnalysis | null,
  weight: number
): ConfluenceFactor {
  const bullishLiquidity =
    countDirectionalLiquidity(
      analysis,
      "BULLISH"
    );

  const bearishLiquidity =
    countDirectionalLiquidity(
      analysis,
      "BEARISH"
    );

  if (
    bullishLiquidity === 0 &&
    bearishLiquidity === 0
  ) {
    return createFactor(
      "LIQUIDITY",
      "NEUTRAL",
      0,
      weight,
      "No directional liquidity concentration was detected."
    );
  }

  if (
    bullishLiquidity >
    bearishLiquidity
  ) {
    return createFactor(
      "LIQUIDITY",
      "BULLISH",
      weight,
      weight,
      `SSL-side liquidity is more concentrated (${bullishLiquidity} relevant levels vs ${bearishLiquidity} BSL-side levels).`
    );
  }

  if (
    bearishLiquidity >
    bullishLiquidity
  ) {
    return createFactor(
      "LIQUIDITY",
      "BEARISH",
      weight,
      weight,
      `BSL-side liquidity is more concentrated (${bearishLiquidity} relevant levels vs ${bullishLiquidity} SSL-side levels).`
    );
  }

  return createFactor(
    "LIQUIDITY",
    "NEUTRAL",
    0,
    weight,
    "BSL and SSL liquidity are relatively balanced."
  );
}

function calculateDisplacementFactor(
  analysis: DisplacementAnalysis | null,
  weight: number
): ConfluenceFactor {
  const direction =
    getLatestDisplacementDirection(
      analysis
    );

  if (
    direction === "BULLISH"
  ) {
    return createFactor(
      "DISPLACEMENT",
      direction,
      weight,
      weight,
      "Latest confirmed displacement is bullish."
    );
  }

  if (
    direction === "BEARISH"
  ) {
    return createFactor(
      "DISPLACEMENT",
      direction,
      weight,
      weight,
      "Latest confirmed displacement is bearish."
    );
  }

  return createFactor(
    "DISPLACEMENT",
    "NEUTRAL",
    0,
    weight,
    "No confirmed directional displacement."
  );
}

function calculateFVGFactor(
  analysis: FVGAnalysis | null,
  currentPrice: number | null,
  weight: number
): ConfluenceFactor {
  const activeFVGs =
    getActiveFVGs(
      analysis
    );

  if (!activeFVGs.length) {
    return createFactor(
      "FVG",
      "NEUTRAL",
      0,
      weight,
      "No active FVG was detected."
    );
  }

  let bullish = 0;
  let bearish = 0;

  for (
    const fvg of activeFVGs
  ) {
    if (!isObject(fvg)) {
      continue;
    }

    if (
      fvg.type ===
      "BULLISH"
    ) {
      bullish += 1;
    }

    if (
      fvg.type ===
      "BEARISH"
    ) {
      bearish += 1;
    }
  }

  if (
    bullish === 0 &&
    bearish === 0
  ) {
    return createFactor(
      "FVG",
      "NEUTRAL",
      0,
      weight,
      "Active FVGs exist but no directional classification was available."
    );
  }

  if (
    bullish >
    bearish
  ) {
    return createFactor(
      "FVG",
      "BULLISH",
      weight,
      weight,
      `${bullish} active bullish FVG(s) detected${currentPrice !== null ? " around the current market context" : ""}.`
    );
  }

  if (
    bearish >
    bullish
  ) {
    return createFactor(
      "FVG",
      "BEARISH",
      weight,
      weight,
      `${bearish} active bearish FVG(s) detected${currentPrice !== null ? " around the current market context" : ""}.`
    );
  }

  return createFactor(
    "FVG",
    "NEUTRAL",
    0,
    weight,
    "Bullish and bearish FVGs are balanced."
  );
}

function calculateOrderBlockFactor(
  analysis: OrderBlockAnalysis | null,
  weight: number
): ConfluenceFactor {
  const active =
    getActiveOrderBlocks(
      analysis
    );

  let bullish = 0;
  let bearish = 0;

  for (
    const orderBlock of active
  ) {
    if (!isObject(orderBlock)) {
      continue;
    }

    if (
      orderBlock.type ===
      "BULLISH"
    ) {
      bullish += 1;
    }

    if (
      orderBlock.type ===
      "BEARISH"
    ) {
      bearish += 1;
    }
  }

  if (
    bullish === 0 &&
    bearish === 0
  ) {
    return createFactor(
      "ORDER_BLOCK",
      "NEUTRAL",
      0,
      weight,
      "No active order block was detected."
    );
  }

  if (
    bullish >
    bearish
  ) {
    return createFactor(
      "ORDER_BLOCK",
      "BULLISH",
      weight,
      weight,
      `${bullish} active bullish order block(s) versus ${bearish} bearish order block(s).`
    );
  }

  if (
    bearish >
    bullish
  ) {
    return createFactor(
      "ORDER_BLOCK",
      "BEARISH",
      weight,
      weight,
      `${bearish} active bearish order block(s) versus ${bullish} bullish order block(s).`
    );
  }

  return createFactor(
    "ORDER_BLOCK",
    "NEUTRAL",
    0,
    weight,
    "Bullish and bearish order blocks are balanced."
  );
}

function calculatePremiumDiscountFactor(
  analysis: PremiumDiscountAnalysis | null,
  weight: number
): ConfluenceFactor {
  if (!analysis) {
    return createFactor(
      "PREMIUM_DISCOUNT",
      "NEUTRAL",
      0,
      weight,
      "Premium/discount analysis is unavailable."
    );
  }

  if (
    analysis.currentZone ===
    "DISCOUNT"
  ) {
    return createFactor(
      "PREMIUM_DISCOUNT",
      "BULLISH",
      weight,
      weight,
      "Current price is in the discount portion of the dealing range."
    );
  }

  if (
    analysis.currentZone ===
    "PREMIUM"
  ) {
    return createFactor(
      "PREMIUM_DISCOUNT",
      "BEARISH",
      weight,
      weight,
      "Current price is in the premium portion of the dealing range."
    );
  }

  return createFactor(
    "PREMIUM_DISCOUNT",
    "NEUTRAL",
    0,
    weight,
    "Current price is near equilibrium."
  );
}

function calculateMTFFactor(
  timeframeConfluence: TimeframeConfluence[],
  weight: number
): ConfluenceFactor {
  const bullish =
    timeframeConfluence.filter(
      (item) =>
        item.direction ===
        "BULLISH"
    ).length;

  const bearish =
    timeframeConfluence.filter(
      (item) =>
        item.direction ===
        "BEARISH"
    ).length;

  if (
    bullish === 0 &&
    bearish === 0
  ) {
    return createFactor(
      "MULTI_TIMEFRAME",
      "NEUTRAL",
      0,
      weight,
      "No directional multi-timeframe alignment."
    );
  }

  if (
    bullish >
    bearish
  ) {
    return createFactor(
      "MULTI_TIMEFRAME",
      "BULLISH",
      weight,
      weight,
      `${bullish} timeframe(s) show bullish directional alignment versus ${bearish} bearish timeframe(s).`
    );
  }

  if (
    bearish >
    bullish
  ) {
    return createFactor(
      "MULTI_TIMEFRAME",
      "BEARISH",
      weight,
      weight,
      `${bearish} timeframe(s) show bearish directional alignment versus ${bullish} bullish timeframe(s).`
    );
  }

  return createFactor(
    "MULTI_TIMEFRAME",
    "NEUTRAL",
    0,
    weight,
    "Multi-timeframe directions are mixed."
  );
}

function determineStrength(
  score: number,
  options: Required<ConfluenceOptions>
): ConfluenceStrength {
  const absoluteScore =
    Math.abs(score);

  if (
    absoluteScore >=
    options.strongThreshold
  ) {
    return "STRONG";
  }

  if (
    absoluteScore >=
    options.moderateThreshold
  ) {
    return "MODERATE";
  }

  if (
    absoluteScore >=
    options.weakThreshold
  ) {
    return "WEAK";
  }

  return "NONE";
}

function buildSummary(
  direction: ConfluenceDirection,
  strength: ConfluenceStrength,
  bullishScore: number,
  bearishScore: number,
  factors: ConfluenceFactor[]
): string {
  if (
    direction === "NEUTRAL"
  ) {
    return "Confluence is mixed or insufficient for a directional conclusion.";
  }

  const confirmed =
    factors.filter(
      (factor) =>
        factor.confirmed &&
        factor.direction ===
          direction
    );

  const factorNames =
    confirmed
      .map(
        (factor) =>
          factor.type
      )
      .join(", ");

  return `${direction} confluence is ${strength.toLowerCase()} with ${factorNames || "limited confirmed factors"}. Bullish score: ${bullishScore}. Bearish score: ${bearishScore}.`;
}

function buildTimeframeConfluence(
  timeframeAnalyses: Array<{
    timeframe: string;
    structure: StructureAnalysis | null;
    displacement: DisplacementAnalysis | null;
    fvg: FVGAnalysis | null;
    orderBlocks: OrderBlockAnalysis | null;
  }>
): TimeframeConfluence[] {
  return timeframeAnalyses.map(
    (item) => {
      const structureBias =
        getStructureBias(
          item.structure
        );

      const displacementDirection =
        getLatestDisplacementDirection(
          item.displacement
        );

      const fvgCount =
        getActiveFVGs(
          item.fvg
        ).length;

      const orderBlockCount =
        getActiveOrderBlocks(
          item.orderBlocks
        ).length;

      let score = 0;

      if (
        structureBias !==
        "NEUTRAL"
      ) {
        score += 2;
      }

      if (
        displacementDirection ===
        structureBias &&
        structureBias !==
          "NEUTRAL"
      ) {
        score += 1;
      }

      const direction =
        structureBias !==
        "NEUTRAL"
          ? structureBias
          : displacementDirection;

      return {
        timeframe:
          item.timeframe,

        direction,

        score,

        structureBias:
          structureBias !==
          "NEUTRAL"
            ? structureBias
            : null,

        latestStructureEvent:
          getLatestStructureEvent(
            item.structure
          ),

        latestDisplacement:
          displacementDirection !==
          "NEUTRAL"
            ? displacementDirection
            : null,

        activeFVGCount:
          fvgCount,

        activeOrderBlockCount:
          orderBlockCount,
      };
    }
  );
}

export function analyzeConfluence(
  input: {
    currentPrice?: number;
    structure?: StructureAnalysis | null;
    liquidity?: LiquidityAnalysis | null;
    displacement?: DisplacementAnalysis | null;
    fvg?: FVGAnalysis | null;
    orderBlocks?: OrderBlockAnalysis | null;
    premiumDiscount?: PremiumDiscountAnalysis | null;

    timeframeAnalyses?: Array<{
      timeframe: string;
      structure: StructureAnalysis | null;
      displacement: DisplacementAnalysis | null;
      fvg: FVGAnalysis | null;
      orderBlocks: OrderBlockAnalysis | null;
    }>;
  },
  options: ConfluenceOptions = {}
): ConfluenceAnalysis {
  const config:
    Required<ConfluenceOptions> =
    {
      ...DEFAULT_OPTIONS,
      ...options,
    };

  const factors: ConfluenceFactor[] =
    [
      calculateStructureFactor(
        input.structure ??
          null,
        config.structureWeight
      ),

      calculateLiquidityFactor(
        input.liquidity ??
          null,
        config.liquidityWeight
      ),

      calculateDisplacementFactor(
        input.displacement ??
          null,
        config.displacementWeight
      ),

      calculateFVGFactor(
        input.fvg ?? null,
        Number.isFinite(
          input.currentPrice
        )
          ? (input.currentPrice as number)
          : null,
        config.fvgWeight
      ),

      calculateOrderBlockFactor(
        input.orderBlocks ??
          null,
        config.orderBlockWeight
      ),

      calculatePremiumDiscountFactor(
        input.premiumDiscount ??
          null,
        config.premiumDiscountWeight
      ),
    ];

  const timeframeConfluence =
    buildTimeframeConfluence(
      input.timeframeAnalyses ??
        []
    );

  factors.push(
    calculateMTFFactor(
      timeframeConfluence,
      config.multiTimeframeWeight
    )
  );

  let bullishScore = 0;
  let bearishScore = 0;

  for (
    const factor of factors
  ) {
    if (
      factor.direction ===
      "BULLISH"
    ) {
      bullishScore +=
        factor.score;
    }

    if (
      factor.direction ===
      "BEARISH"
    ) {
      bearishScore +=
        factor.score;
    }
  }

  const totalScore =
    Math.max(
      bullishScore,
      bearishScore
    );

  const scoreDifference =
    Math.abs(
      bullishScore -
        bearishScore
    );

  let direction:
    ConfluenceDirection =
    "NEUTRAL";

  if (
    scoreDifference >=
      config.minimumDirectionalEdge &&
    bullishScore >
      bearishScore
  ) {
    direction = "BULLISH";
  } else if (
    scoreDifference >=
      config.minimumDirectionalEdge &&
    bearishScore >
      bullishScore
  ) {
    direction = "BEARISH";
  }

  const strength =
    determineStrength(
      totalScore,
      config
    );

  const bullishFactors =
    factors.filter(
      (factor) =>
        factor.direction ===
        "BULLISH"
    );

  const bearishFactors =
    factors.filter(
      (factor) =>
        factor.direction ===
        "BEARISH"
    );

  return {
    direction,

    strength,

    bullishScore,

    bearishScore,

    neutralScore:
      factors
        .filter(
          (factor) =>
            factor.direction ===
            "NEUTRAL"
        )
        .length,

    totalScore,

    factors,

    bullishFactors,

    bearishFactors,

    timeframeConfluence,

    hasLiquidityConfluence:
      factors.some(
        (factor) =>
          factor.type ===
            "LIQUIDITY" &&
          factor.confirmed
      ),

    hasStructureConfluence:
      factors.some(
        (factor) =>
          factor.type ===
            "STRUCTURE" &&
          factor.confirmed
      ),

    hasDisplacementConfluence:
      factors.some(
        (factor) =>
          factor.type ===
            "DISPLACEMENT" &&
          factor.confirmed
      ),

    hasFVGConfluence:
      factors.some(
        (factor) =>
          factor.type ===
            "FVG" &&
          factor.confirmed
      ),

    hasOrderBlockConfluence:
      factors.some(
        (factor) =>
          factor.type ===
            "ORDER_BLOCK" &&
          factor.confirmed
      ),

    hasPremiumDiscountConfluence:
      factors.some(
        (factor) =>
          factor.type ===
            "PREMIUM_DISCOUNT" &&
          factor.confirmed
      ),

    hasMTFConfluence:
      factors.some(
        (factor) =>
          factor.type ===
            "MULTI_TIMEFRAME" &&
          factor.confirmed
      ),

    summary:
      buildSummary(
        direction,
        strength,
        bullishScore,
        bearishScore,
        factors
      ),
  };
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

export function hasStrongConfluence(
  analysis: ConfluenceAnalysis
): boolean {
  return (
    analysis.strength ===
      "STRONG" ||
    analysis.strength ===
      "VERY_STRONG"
  );
}

export function getBullishConfluenceFactors(
  analysis: ConfluenceAnalysis
): ConfluenceFactor[] {
  return analysis.bullishFactors;
}

export function getBearishConfluenceFactors(
  analysis: ConfluenceAnalysis
): ConfluenceFactor[] {
  return analysis.bearishFactors;
}
