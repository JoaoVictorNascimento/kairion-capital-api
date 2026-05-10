import type { z } from "zod";
import { findAssetById } from "../../assets/repositories/assets.repository.js";
import { AssetNotFoundError } from "../../assets/services/errors.js";
import type { CandleInterval } from "../../../generated/prisma/enums.js";
import type { MarketDataProvider } from "../providers/market-data-provider.js";
import { upsertCandles } from "../repositories/candles.repository.js";
import type { syncAssetPricesQuerySchema } from "../schemas/market-data.schemas.js";

export type SyncAssetPricesQuery = z.infer<typeof syncAssetPricesQuerySchema>;

export async function syncAssetPricesService(
  assetId: string,
  query: SyncAssetPricesQuery,
  provider: MarketDataProvider,
): Promise<{ upserted: number; interval: CandleInterval }> {
  const asset = await findAssetById(assetId);
  if (!asset) {
    throw new AssetNotFoundError();
  }

  const interval = query.interval;
  const symbol = asset.symbol.trim().toUpperCase();

  let points;
  if (query.from === undefined && query.to === undefined) {
    points = await provider.getHistoricalPrices({
      symbol,
      interval: "DAY",
    });
  } else {
    const to = query.to ?? new Date();
    const from = query.from ?? new Date(to.getTime() - 365 * 86_400_000);
    points = await provider.getHistoricalPrices({
      symbol,
      interval: "DAY",
      from,
      to,
    });
  }

  const upserted = await upsertCandles(
    assetId,
    interval,
    points.map((p) => ({
      bucketStart: p.bucketStart,
      open: p.open,
      high: p.high,
      low: p.low,
      close: p.close,
      volume: p.volume,
    })),
  );

  return { upserted, interval };
}
