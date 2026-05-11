import { Prisma } from "../../../generated/prisma/client.js";
import type { BacktestRun } from "../../../generated/prisma/client.js";
import { BacktestStrategy, CandleInterval } from "../../../generated/prisma/enums.js";
import { computeBacktestMa } from "../../../lib/quantix/quantix-backtest-ma.js";
import { findAssetById } from "../../assets/repositories/assets.repository.js";
import { AssetNotFoundError } from "../../assets/services/errors.js";
import { listDailyClosesInRange } from "../../market-data/repositories/candles.repository.js";
import {
  createBacktestRun,
  findBacktestByIdForUser,
  listBacktestsByUserId,
} from "../repositories/backtests.repository.js";
import type { MovingAverageBacktestBody } from "../schemas/backtests.schemas.js";
import { MAX_BACKTEST_RANGE_DAYS } from "../schemas/backtests.schemas.js";
import { ANALYTICS_MAX_CANDLES } from "../../market-data/repositories/candles.repository.js";
import { BacktestNotFoundError, InsufficientHistoryForBacktestError } from "./errors.js";

/** Documented semantics for clients (mirrors analytics `assumptions` pattern). */
export const MOVING_AVERAGE_BACKTEST_ASSUMPTIONS = {
  candleInterval: "DAY" as const,
  executionPrice: "close" as const,
  positionStyle: "long_or_cash" as const,
  signalAppliedTo: "next_bar_simple_return" as const,
  tradingDaysPerYear: 252,
} as const;

function formatBacktestDetail(
  run: BacktestRun,
  asset?: { id: string; symbol: string; name: string; exchange: string },
  engine?: "quantix" | "ts",
) {
  return {
    backtest: {
      id: run.id,
      userId: run.userId,
      assetId: run.assetId,
      ...(asset
        ? {
            asset: {
              id: asset.id,
              symbol: asset.symbol,
              name: asset.name,
              exchange: asset.exchange,
            },
          }
        : {}),
      strategy: run.strategy,
      initialCapital: Number(run.initialCapital),
      periodStart: run.periodStart.toISOString(),
      periodEnd: run.periodEnd.toISOString(),
      fastPeriod: run.fastPeriod,
      slowPeriod: run.slowPeriod,
      summary: run.summary,
      series: run.series,
      createdAt: run.createdAt.toISOString(),
    },
    assumptions: {
      ...MOVING_AVERAGE_BACKTEST_ASSUMPTIONS,
      ...(engine ? { engine } : {}),
    },
    limits: {
      maxRangeDays: MAX_BACKTEST_RANGE_DAYS,
      maxCandlesLoaded: ANALYTICS_MAX_CANDLES,
    },
  };
}

export async function runMovingAverageBacktestService(userId: string, body: MovingAverageBacktestBody) {
  const asset = await findAssetById(body.assetId);
  if (!asset) {
    throw new AssetNotFoundError();
  }

  const rows = await listDailyClosesInRange({
    assetId: body.assetId,
    interval: CandleInterval.DAY,
    from: body.from,
    to: body.to,
  });

  const minRequired = body.slowPeriod + 1;
  if (rows.length < minRequired) {
    throw new InsufficientHistoryForBacktestError(
      `Need at least ${minRequired} daily candles in range; got ${rows.length}`,
    );
  }

  const bucketStarts = rows.map((r) => r.bucketStart);
  const closes = rows.map((r) => Number(r.close));

  let engineResult;
  let engine: "quantix" | "ts";
  try {
    const computed = await computeBacktestMa({
      bucketStarts,
      closes,
      fastPeriod: body.fastPeriod,
      slowPeriod: body.slowPeriod,
      initialCapital: body.initialCapital,
    });
    engineResult = computed.result;
    engine = computed.engine;
  } catch {
    throw new InsufficientHistoryForBacktestError();
  }

  const run = await createBacktestRun({
    userId,
    assetId: body.assetId,
    strategy: BacktestStrategy.MOVING_AVERAGE_CROSSOVER,
    initialCapital: new Prisma.Decimal(body.initialCapital),
    periodStart: body.from,
    periodEnd: body.to,
    fastPeriod: body.fastPeriod,
    slowPeriod: body.slowPeriod,
    summary: engineResult.summary as unknown as Prisma.InputJsonValue,
    series: engineResult.series as unknown as Prisma.InputJsonValue,
  });

  return formatBacktestDetail(run, asset, engine);
}

export async function listBacktestsForUserService(userId: string) {
  const rows = await listBacktestsByUserId(userId);
  return {
    backtests: rows.map((r) => ({
      id: r.id,
      assetId: r.assetId,
      strategy: r.strategy,
      initialCapital: Number(r.initialCapital),
      periodStart: r.periodStart.toISOString(),
      periodEnd: r.periodEnd.toISOString(),
      fastPeriod: r.fastPeriod,
      slowPeriod: r.slowPeriod,
      summary: r.summary,
      createdAt: r.createdAt.toISOString(),
    })),
    assumptions: MOVING_AVERAGE_BACKTEST_ASSUMPTIONS,
    limits: {
      maxRangeDays: MAX_BACKTEST_RANGE_DAYS,
      maxCandlesLoaded: ANALYTICS_MAX_CANDLES,
    },
  };
}

export async function getBacktestByIdService(id: string, userId: string) {
  const run = await findBacktestByIdForUser(id, userId);
  if (!run) {
    throw new BacktestNotFoundError();
  }
  const asset = await findAssetById(run.assetId);
  return formatBacktestDetail(run, asset ?? undefined);
}
