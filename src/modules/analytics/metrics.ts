/** Trading days per year for annualization (documented API assumption). */
export const TRADING_DAYS_PER_YEAR = 252;

export type ReturnSeriesMetrics = {
  cumulativeReturn: number;
  volatilityDaily: number | null;
  volatilityAnnualized: number | null;
  sharpe: number | null;
  sortino: number | null;
  maxDrawdown: number;
  maxDrawdownDurationPeriods: number | null;
  /** Number of daily simple returns used (len(prices) - 1 when derived from closes). */
  returnObservations: number;
};

function mean(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Sample standard deviation with Bessel correction (divide by n-1). */
function sampleStdDev(values: number[]): number | null {
  const n = values.length;
  if (n < 2) {
    return null;
  }
  const m = mean(values);
  const sq = values.reduce((acc, x) => acc + (x - m) ** 2, 0);
  return Math.sqrt(sq / (n - 1));
}

/**
 * Simple daily returns from ascending close prices: r_t = P_t / P_{t-1} - 1.
 */
export function closesToSimpleReturns(closes: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    const prev = closes[i - 1]!;
    if (prev === 0 || !Number.isFinite(prev)) {
      throw new Error("Invalid close price (zero or non-finite)");
    }
    out.push(closes[i]! / prev - 1);
  }
  return out;
}

/**
 * Cumulative simple return over the window: ∏(1 + r_i) - 1.
 */
export function cumulativeReturnFromSimpleReturns(returns: number[]): number {
  let w = 1;
  for (const r of returns) {
    w *= 1 + r;
  }
  return w - 1;
}

/**
 * Wealth path W[0]=1, W[k]=W[k-1]*(1+r[k-1]) for k>=1; length returns.length + 1.
 */
export function wealthPathFromReturns(returns: number[]): number[] {
  const w: number[] = [1];
  for (const r of returns) {
    w.push(w[w.length - 1]! * (1 + r));
  }
  return w;
}

/**
 * Max drawdown on normalized wealth: min_t W_t / max_{s<=t} W_s - 1 (<= 0).
 */
export function maxDrawdownFromWealth(wealth: number[]): number {
  if (wealth.length === 0) {
    return 0;
  }
  let peak = wealth[0]!;
  let minDd = 0;
  for (let t = 0; t < wealth.length; t++) {
    const wt = wealth[t]!;
    if (wt > peak) {
      peak = wt;
    }
    const dd = wt / peak - 1;
    if (dd < minDd) {
      minDd = dd;
    }
  }
  return minDd;
}

/**
 * Drawdown depth at each wealth index (same length as wealth).
 */
function drawdownSeries(wealth: number[]): number[] {
  const dd: number[] = [];
  let peak = wealth[0]!;
  for (let t = 0; t < wealth.length; t++) {
    const wt = wealth[t]!;
    if (wt > peak) {
      peak = wt;
    }
    dd.push(wt / peak - 1);
  }
  return dd;
}

/**
 * Period count from the running peak at the worst drawdown trough to that trough (inclusive span minus 1 = steps).
 * Uses first trough index if multiple minima tie.
 */
export function computeMaxDrawdownDurationPeriods(wealth: number[]): number | null {
  if (wealth.length < 2) {
    return null;
  }
  const dd = drawdownSeries(wealth);
  let troughIdx = 0;
  let minVal = dd[0]!;
  for (let i = 1; i < dd.length; i++) {
    if (dd[i]! < minVal) {
      minVal = dd[i]!;
      troughIdx = i;
    }
  }
  let peakIdx = 0;
  let peakW = wealth[0]!;
  for (let s = 0; s <= troughIdx; s++) {
    if (wealth[s]! >= peakW) {
      peakW = wealth[s]!;
      peakIdx = s;
    }
  }
  return troughIdx - peakIdx;
}

/**
 * Downside deviation for Sortino: sqrt( (1/n) * sum( min(0, r - MAR)^2 ) ) over all n returns.
 */
function downsideDeviation(returns: number[], marDaily: number): number | null {
  const n = returns.length;
  if (n === 0) {
    return null;
  }
  let sumSq = 0;
  for (const r of returns) {
    const shortfall = Math.min(0, r - marDaily);
    sumSq += shortfall ** 2;
  }
  const v = sumSq / n;
  if (v === 0) {
    return null;
  }
  return Math.sqrt(v);
}

/**
 * Full metrics from a series of **simple daily** returns (already aligned).
 * @param riskFreeAnnual annual risk-free rate as decimal (e.g. 0.02 for 2%); daily = annual/252.
 */
export function metricsFromSimpleDailyReturns(
  returns: number[],
  riskFreeAnnual = 0,
): ReturnSeriesMetrics {
  const n = returns.length;
  const rfDaily = riskFreeAnnual / TRADING_DAYS_PER_YEAR;

  if (n === 0) {
    return {
      cumulativeReturn: 0,
      volatilityDaily: null,
      volatilityAnnualized: null,
      sharpe: null,
      sortino: null,
      maxDrawdown: 0,
      maxDrawdownDurationPeriods: null,
      returnObservations: 0,
    };
  }

  const cumulativeReturn = cumulativeReturnFromSimpleReturns(returns);
  const sigmaDaily = sampleStdDev(returns);
  const volatilityDaily = sigmaDaily;
  const volatilityAnnualized =
    sigmaDaily !== null ? sigmaDaily * Math.sqrt(TRADING_DAYS_PER_YEAR) : null;

  const excess = returns.map((r) => r - rfDaily);
  const excessMean = mean(excess);

  let sharpe: number | null = null;
  if (sigmaDaily !== null && sigmaDaily > 0) {
    sharpe = (excessMean / sigmaDaily) * Math.sqrt(TRADING_DAYS_PER_YEAR);
  }

  const downDev = downsideDeviation(returns, rfDaily);
  let sortino: number | null = null;
  if (downDev !== null && downDev > 0) {
    sortino = (excessMean / downDev) * Math.sqrt(TRADING_DAYS_PER_YEAR);
  }

  const wealth = wealthPathFromReturns(returns);
  const maxDrawdown = maxDrawdownFromWealth(wealth);
  const maxDrawdownDurationPeriods =
    maxDrawdown < 0 ? computeMaxDrawdownDurationPeriods(wealth) : null;

  return {
    cumulativeReturn,
    volatilityDaily,
    volatilityAnnualized,
    sharpe,
    sortino,
    maxDrawdown,
    maxDrawdownDurationPeriods,
    returnObservations: n,
  };
}
