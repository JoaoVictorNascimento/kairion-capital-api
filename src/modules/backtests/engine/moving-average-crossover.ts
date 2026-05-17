import { InvalidPriceSeriesError } from "../services/errors.js";

/**
 * Long/cash moving-average crossover on daily closes.
 *
 * - Signal at bar `t` uses SMA(fast) vs SMA(slow) at close `t` (requires `t >= slowPeriod - 1`).
 * - Position `pos[t]` is applied to the **next** simple return `P[t+1]/P[t]-1` (no lookahead on same bar).
 * - Before warmup, `pos[t] = 0` (cash, zero strategy return).
 * - Buy-and-hold invests full capital from bar `slowPeriod - 1` onward (aligned start with comparable window).
 * - Tie-breaker: when `SMA_fast === SMA_slow`, position is **cash** (`pos[t] = 0`). The
 *   strategy only enters when fast strictly crosses above slow.
 * - All closes must be finite and strictly positive — otherwise an
 *   {@link InvalidPriceSeriesError} is thrown before any computation begins.
 */

export type MovingAverageCrossoverParams = {
  bucketStarts: Date[];
  closes: number[];
  fastPeriod: number;
  slowPeriod: number;
  initialCapital: number;
};

export type BacktestSeriesPoint = {
  bucketStart: string;
  strategyEquity: number;
  buyHoldEquity: number;
};

export type BacktestSummary = {
  warmupBars: number;
  firstSignalBarIndex: number;
  priceObservations: number;
  curvePoints: number;
  strategyTotalReturn: number;
  buyHoldTotalReturn: number;
  finalEquityStrategy: number;
  finalEquityBuyHold: number;
};

export type MovingAverageCrossoverResult = {
  summary: BacktestSummary;
  series: BacktestSeriesPoint[];
};

/** Rolling SMA; NaN where undefined (index < period - 1). */
export function rollingSma(values: number[], period: number): number[] {
  const n = values.length;
  const out = new Array<number>(n).fill(Number.NaN);
  let sum = 0;
  for (let i = 0; i < n; i++) {
    sum += values[i]!;
    if (i >= period) {
      sum -= values[i - period]!;
    }
    if (i >= period - 1) {
      out[i] = sum / period;
    }
  }
  return out;
}

export function runMovingAverageCrossover(params: MovingAverageCrossoverParams): MovingAverageCrossoverResult {
  const { bucketStarts, closes, fastPeriod, slowPeriod, initialCapital } = params;
  const n = closes.length;

  if (bucketStarts.length !== n) {
    throw new Error("bucketStarts and closes length mismatch");
  }
  if (n < slowPeriod + 1) {
    throw new Error("Not enough price observations for slow MA and one forward return");
  }
  for (let i = 0; i < n; i++) {
    const c = closes[i]!;
    if (!Number.isFinite(c) || c <= 0) {
      throw new InvalidPriceSeriesError(
        `Invalid close at index ${i}: must be a finite positive number (got ${c})`,
      );
    }
  }
  if (!Number.isFinite(initialCapital) || initialCapital <= 0) {
    throw new InvalidPriceSeriesError("initialCapital must be a positive finite number");
  }

  const smaFast = rollingSma(closes, fastPeriod);
  const smaSlow = rollingSma(closes, slowPeriod);

  const pos: number[] = new Array(n).fill(0);
  const firstSignalIdx = slowPeriod - 1;
  for (let i = firstSignalIdx; i < n; i++) {
    const f = smaFast[i]!;
    const s = smaSlow[i]!;
    pos[i] = f > s ? 1 : 0;
  }

  const equityStrategy: number[] = new Array(n).fill(initialCapital);
  for (let i = 1; i < n; i++) {
    const prev = closes[i - 1]!;
    const r = closes[i]! / prev - 1;
    const stratR = pos[i - 1]! * r;
    equityStrategy[i] = equityStrategy[i - 1]! * (1 + stratR);
  }

  const equityBuyHold: number[] = new Array(n).fill(Number.NaN);
  equityBuyHold[firstSignalIdx] = initialCapital;
  for (let i = firstSignalIdx + 1; i < n; i++) {
    const prev = closes[i - 1]!;
    equityBuyHold[i] = equityBuyHold[i - 1]! * (closes[i]! / prev);
  }

  const last = n - 1;
  const finalStrat = equityStrategy[last]!;
  const finalBh = equityBuyHold[last]!;
  const strategyTotalReturn = finalStrat / initialCapital - 1;
  const buyHoldTotalReturn = finalBh / initialCapital - 1;

  const series: BacktestSeriesPoint[] = [];
  for (let i = firstSignalIdx; i < n; i++) {
    series.push({
      bucketStart: bucketStarts[i]!.toISOString(),
      strategyEquity: equityStrategy[i]!,
      buyHoldEquity: equityBuyHold[i]!,
    });
  }

  const summary: BacktestSummary = {
    warmupBars: slowPeriod,
    firstSignalBarIndex: firstSignalIdx,
    priceObservations: n,
    curvePoints: series.length,
    strategyTotalReturn,
    buyHoldTotalReturn,
    finalEquityStrategy: finalStrat,
    finalEquityBuyHold: finalBh,
  };

  return { summary, series };
}
