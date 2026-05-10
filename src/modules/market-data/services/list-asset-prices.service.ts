import type { z } from "zod";
import { findAssetById } from "../../assets/repositories/assets.repository.js";
import { AssetNotFoundError } from "../../assets/services/errors.js";
import { listCandlesByAssetAndRange } from "../repositories/candles.repository.js";
import type { listAssetPricesQuerySchema } from "../schemas/market-data.schemas.js";

export type ListAssetPricesQuery = z.infer<typeof listAssetPricesQuerySchema>;

export async function listAssetPricesService(assetId: string, query: ListAssetPricesQuery) {
  const asset = await findAssetById(assetId);
  if (!asset) {
    throw new AssetNotFoundError();
  }

  const rows = await listCandlesByAssetAndRange({
    assetId,
    interval: query.interval,
    from: query.from,
    to: query.to,
    skip: query.skip,
    take: query.take,
  });

  return {
    candles: rows.map((c) => ({
      id: c.id,
      assetId: c.assetId,
      interval: c.interval,
      bucketStart: c.bucketStart.toISOString(),
      open: Number(c.open),
      high: Number(c.high),
      low: Number(c.low),
      close: Number(c.close),
      volume: Number(c.volume),
    })),
  };
}
