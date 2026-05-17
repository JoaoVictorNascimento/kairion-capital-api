import { randomUUID } from "node:crypto";
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

/**
 * Chunk size for the bulk upsert. Postgres caps a single statement at
 * ~65k parameters; with 8 params per row we stay well below that limit.
 */
const UPSERT_CHUNK_SIZE = 500;

/**
 * Bulk upsert candles using a single `INSERT ... ON CONFLICT DO UPDATE`
 * per chunk. Much faster than N round-trips of `prisma.candle.upsert`.
 */
export async function upsertCandles(
  assetId: string,
  interval: CandleInterval,
  rows: CandleUpsertRow[],
): Promise<number> {
  if (rows.length === 0) {
    return 0;
  }

  for (let i = 0; i < rows.length; i += UPSERT_CHUNK_SIZE) {
    const chunk = rows.slice(i, i + UPSERT_CHUNK_SIZE);
    const values = Prisma.join(
      chunk.map(
        (row) => Prisma.sql`(
          ${randomUUID()},
          ${assetId},
          ${interval}::"CandleInterval",
          ${row.bucketStart},
          ${new Prisma.Decimal(row.open)},
          ${new Prisma.Decimal(row.high)},
          ${new Prisma.Decimal(row.low)},
          ${new Prisma.Decimal(row.close)},
          ${new Prisma.Decimal(row.volume)},
          NOW()
        )`,
      ),
    );

    await prisma.$executeRaw`
      INSERT INTO "Candle" (
        "id", "assetId", "interval", "bucketStart",
        "open", "high", "low", "close", "volume", "createdAt"
      )
      VALUES ${values}
      ON CONFLICT ("assetId", "interval", "bucketStart")
      DO UPDATE SET
        "open"   = EXCLUDED."open",
        "high"   = EXCLUDED."high",
        "low"    = EXCLUDED."low",
        "close"  = EXCLUDED."close",
        "volume" = EXCLUDED."volume"
    `;
  }

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

export type DailyClose = {
  bucketStart: Date;
  close: Prisma.Decimal;
};

export type DailyClosesResult = {
  rows: DailyClose[];
  truncated: boolean;
};

/**
 * Daily closes in [from, to] (inclusive on bucketStart), ascending, capped for analytics memory.
 * Returns `truncated: true` if the underlying series exceeded {@link ANALYTICS_MAX_CANDLES}.
 */
export async function listDailyClosesInRange(params: {
  assetId: string;
  interval: CandleInterval;
  from: Date;
  to: Date;
}): Promise<DailyClosesResult> {
  const rows = await prisma.candle.findMany({
    where: {
      assetId: params.assetId,
      interval: params.interval,
      bucketStart: {
        gte: params.from,
        lte: params.to,
      },
    },
    orderBy: { bucketStart: "asc" },
    take: ANALYTICS_MAX_CANDLES + 1,
    select: {
      bucketStart: true,
      close: true,
    },
  });

  if (rows.length > ANALYTICS_MAX_CANDLES) {
    return { rows: rows.slice(0, ANALYTICS_MAX_CANDLES), truncated: true };
  }
  return { rows, truncated: false };
}
