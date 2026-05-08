import type { AssetType } from "../../../generated/prisma/enums.js";
import { listAssets } from "../repositories/assets.repository.js";

export async function listAssetsService(params: {
  q?: string;
  exchange?: string;
  type?: AssetType;
  skip?: number;
  take?: number;
}) {
  const q = params.q?.trim();
  const exchange = params.exchange?.trim();

  return listAssets({
    ...params,
    q: q && q.length > 0 ? q : undefined,
    exchange: exchange && exchange.length > 0 ? exchange : undefined,
  });
}

