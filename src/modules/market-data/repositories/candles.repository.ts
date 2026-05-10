import { prisma } from "../../../lib/prisma.js";
import type { CandleInterval } from "../../../generated/prisma/enums.js";
import { Prisma } from "../../../generated/prisma/client.js";

export type CandleUpsertRow = {
  bucketStart: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

function toDecimal(value: number): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

export async function upsertCandles(
  assetId: string,
  interval: CandleInterval,
  rows: CandleUpsertRow[],
): Promise<number> {
  if (rows.length === 0) {
    return 0;
  }

  await prisma.$transaction(
    rows.map((row) =>
      prisma.candle.upsert({
        where: {
          assetId_interval_bucketStart: {
            assetId,
            interval,
            bucketStart: row.bucketStart,
          },
        },
        create: {
          assetId,
          interval,
          bucketStart: row.bucketStart,
          open: toDecimal(row.open),
          high: toDecimal(row.high),
          low: toDecimal(row.low),
          close: toDecimal(row.close),
          volume: toDecimal(row.volume),
        },
        update: {
          open: toDecimal(row.open),
          high: toDecimal(row.high),
          low: toDecimal(row.low),
          close: toDecimal(row.close),
          volume: toDecimal(row.volume),
        },
      }),
    ),
  );

  return rows.length;
}

export async function listCandlesByAssetAndRange(params: {
  assetId: string;
  interval: CandleInterval;
  from: Date;
  to: Date;
  skip?: number;
  take?: number;
}) {
  const { assetId, interval, from, to, skip = 0, take = 500 } = params;

  return prisma.candle.findMany({
    where: {
      assetId,
      interval,
      bucketStart: {
        gte: from,
        lte: to,
      },
    },
    orderBy: { bucketStart: "asc" },
    skip,
    take: Math.min(take, 2000),
  });
}

export const ANALYTICS_MAX_CANDLES = 4000;

/**
 * Daily closes in [from, to] (inclusive on bucketStart), ascending, capped for analytics memory.
 */
export async function listDailyClosesInRange(params: {
  assetId: string;
  interval: CandleInterval;
  from: Date;
  to: Date;
}) {
  return prisma.candle.findMany({
    where: {
      assetId: params.assetId,
      interval: params.interval,
      bucketStart: {
        gte: params.from,
        lte: params.to,
      },
    },
    orderBy: { bucketStart: "asc" },
    take: ANALYTICS_MAX_CANDLES,
    select: {
      bucketStart: true,
      close: true,
    },
  });
}
