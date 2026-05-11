import type { ReturnSeriesMetrics } from "../../modules/analytics/metrics.js";
import type { MovingAverageCrossoverResult } from "../../modules/backtests/engine/moving-average-crossover.js";

export const QUANTIX_ENDPOINTS = {
  metrics: "/metrics",
  backtestMa: "/backtest/moving-average",
  health: "/health",
} as const;

export type QuantixMetricsInput = {
  returns: number[];
  riskFreeAnnual: number;
};

export type QuantixMetricsOutput = ReturnSeriesMetrics;

export type QuantixBacktestMaInput = {
  closes: number[];
  dates: string[];
  fastPeriod: number;
  slowPeriod: number;
  initialCapital: number;
};

export type QuantixBacktestMaOutput = MovingAverageCrossoverResult;
