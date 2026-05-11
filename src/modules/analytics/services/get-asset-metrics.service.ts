import { CandleInterval } from "../../../generated/prisma/enums.js";
import { computeMetrics } from "../../../lib/quantix/quantix-metrics.js";
import { listDailyClosesInRange } from "../../market-data/repositories/candles.repository.js";
import { closesToSimpleReturns, TRADING_DAYS_PER_YEAR } from "../metrics.js";
import type { MetricsQuery } from "../schemas/analytics.schemas.js";
import { InsufficientPriceDataError } from "./errors.js";

const RISK_FREE_ANNUAL = 0;

export async function getAssetMetricsService(assetId: string, query: MetricsQuery) {
  const rows = await listDailyClosesInRange({
    assetId,
    interval: CandleInterval.DAY,
    from: query.from,
    to: query.to,
  });

  const closes = rows.map((r) => Number(r.close));
  if (closes.length < 2) {
    throw new InsufficientPriceDataError();
  }

  const returns = closesToSimpleReturns(closes);
  const { metrics, engine } = await computeMetrics(returns, RISK_FREE_ANNUAL);

  return {
    period: {
      from: query.from.toISOString(),
      to: query.to.toISOString(),
      priceObservations: closes.length,
      returnObservations: metrics.returnObservations,
    },
    assumptions: {
      tradingDaysPerYear: TRADING_DAYS_PER_YEAR,
      returnType: "simple" as const,
      riskFreeAnnual: RISK_FREE_ANNUAL,
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
