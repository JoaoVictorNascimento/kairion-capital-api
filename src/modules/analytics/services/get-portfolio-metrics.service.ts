import { CandleInterval } from "../../../generated/prisma/enums.js";
import { computeMetrics } from "../../../lib/quantix/quantix-metrics.js";
import { listDailyClosesInRange } from "../../market-data/repositories/candles.repository.js";
import { findPortfolioByIdForUser } from "../../portfolios/repositories/portfolios.repository.js";
import { PortfolioNotFoundError } from "../../portfolios/services/errors.js";
import { TRADING_DAYS_PER_YEAR } from "../metrics.js";
import type { MetricsQuery } from "../schemas/analytics.schemas.js";
import {
  CurrencyMismatchError,
  InsufficientPriceDataError,
  MixedPortfolioAllocationError,
} from "./errors.js";

const RISK_FREE_ANNUAL = 0;
const WEIGHT_SUM_EPS = 1e-6;

function intersectionCloseMatrix(
  perAsset: { assetId: string; points: Map<number, number> }[],
): number[][] | null {
  if (perAsset.length === 0) {
    return null;
  }
  let common: Set<number> | undefined;
  for (const { points } of perAsset) {
    const keys = new Set(points.keys());
    if (common === undefined) {
      common = keys;
    } else {
      common = new Set([...common].filter((k: number) => keys.has(k)));
    }
  }
  if (!common || common.size < 2) {
    return null;
  }
  const times = [...common].sort((a, b) => a - b);
  return perAsset.map(({ points }) => times.map((t) => points.get(t)!));
}

export async function getPortfolioMetricsService(portfolioId: string, userId: string, query: MetricsQuery) {
  const portfolio = await findPortfolioByIdForUser(portfolioId, userId);
  if (!portfolio) {
    throw new PortfolioNotFoundError();
  }

  const positions = portfolio.assets;
  if (positions.length === 0) {
    throw new InsufficientPriceDataError("Portfolio has no positions");
  }

  const hasWeight = positions.some((p) => p.targetWeight !== null);
  const hasQty = positions.some((p) => p.quantity !== null);
  if (hasWeight && hasQty) {
    throw new MixedPortfolioAllocationError();
  }

  const currencies = new Set(positions.map((p) => p.asset.currency));
  if (currencies.size > 1) {
    throw new CurrencyMismatchError();
  }

  const perAsset: { assetId: string; points: Map<number, number> }[] = [];
  for (const p of positions) {
    const rows = await listDailyClosesInRange({
      assetId: p.assetId,
      interval: CandleInterval.DAY,
      from: query.from,
      to: query.to,
    });
    const points = new Map<number, number>();
    for (const row of rows) {
      points.set(row.bucketStart.getTime(), Number(row.close));
    }
    perAsset.push({ assetId: p.assetId, points });
  }

  const matrix = intersectionCloseMatrix(perAsset);
  if (!matrix) {
    throw new InsufficientPriceDataError("Not enough overlapping daily prices for all positions");
  }

  const k = matrix[0]!.length;
  const m = matrix.length;
  let portfolioReturns: number[];

  if (hasWeight) {
    const rawW = positions.map((p) => Number(p.targetWeight));
    const sumW = rawW.reduce((a, b) => a + b, 0);
    if (sumW <= 0) {
      throw new InsufficientPriceDataError("Invalid target weights");
    }
    const w = rawW.map((x) => x / sumW);
    const weightsNormalized = Math.abs(sumW - 1) > WEIGHT_SUM_EPS;

    portfolioReturns = [];
    for (let t = 0; t < k - 1; t++) {
      let rp = 0;
      for (let i = 0; i < m; i++) {
        const c0 = matrix[i]![t]!;
        const c1 = matrix[i]![t + 1]!;
        rp += w[i]! * (c1 / c0 - 1);
      }
      portfolioReturns.push(rp);
    }

    const { metrics, engine } = await computeMetrics(portfolioReturns, RISK_FREE_ANNUAL);

    return {
      period: {
        from: query.from.toISOString(),
        to: query.to.toISOString(),
        alignedPriceObservations: k,
        returnObservations: metrics.returnObservations,
      },
      assumptions: {
        tradingDaysPerYear: TRADING_DAYS_PER_YEAR,
        returnType: "simple" as const,
        riskFreeAnnual: RISK_FREE_ANNUAL,
        allocationMode: "targetWeight" as const,
        weightsNormalized,
        engine,
      },
      metrics: {
        cumulativeReturn: metrics.cumulativeReturn,
        volatilityDaily: metrics.volatilityDaily,
        volatilityAnnualized: metrics.volatilityAnnualized,
        sharpe: metrics.sharpe,
        sortino: metrics.sortino,
        maxDrawdown: metrics.maxDrawdown,
        maxDrawdownDurationPeriods: metrics.maxDrawdownDurationPeriods,
      },
    };
  }

  const quantities = positions.map((p) => Number(p.quantity));
  portfolioReturns = [];
  for (let t = 0; t < k - 1; t++) {
    let v0 = 0;
    let v1 = 0;
    for (let i = 0; i < m; i++) {
      v0 += quantities[i]! * matrix[i]![t]!;
      v1 += quantities[i]! * matrix[i]![t + 1]!;
    }
    if (v0 === 0) {
      throw new InsufficientPriceDataError("Portfolio value is zero on an aligned date");
    }
    portfolioReturns.push(v1 / v0 - 1);
  }

  const { metrics, engine } = await computeMetrics(portfolioReturns, RISK_FREE_ANNUAL);

  return {
    period: {
      from: query.from.toISOString(),
      to: query.to.toISOString(),
      alignedPriceObservations: k,
      returnObservations: metrics.returnObservations,
    },
    assumptions: {
      tradingDaysPerYear: TRADING_DAYS_PER_YEAR,
      returnType: "simple" as const,
      riskFreeAnnual: RISK_FREE_ANNUAL,
      allocationMode: "quantity" as const,
      engine,
    },
    metrics: {
      cumulativeReturn: metrics.cumulativeReturn,
      volatilityDaily: metrics.volatilityDaily,
      volatilityAnnualized: metrics.volatilityAnnualized,
      sharpe: metrics.sharpe,
      sortino: metrics.sortino,
      maxDrawdown: metrics.maxDrawdown,
      maxDrawdownDurationPeriods: metrics.maxDrawdownDurationPeriods,
    },
  };
}
