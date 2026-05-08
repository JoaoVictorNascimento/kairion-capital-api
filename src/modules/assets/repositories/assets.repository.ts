import { prisma } from "../../../lib/prisma.js";
import type { AssetType } from "../../../generated/prisma/enums.js";

export async function createAsset(data: {
  symbol: string;
  exchange: string;
  name: string;
  type?: AssetType;
  currency: string;
}) {
  return prisma.asset.create({ data });
}

export async function listAssets(params: {
  q?: string;
  exchange?: string;
  type?: AssetType;
  skip?: number;
  take?: number;
}) {
  const { q, exchange, type, skip = 0, take = 50 } = params;

  return prisma.asset.findMany({
    where: {
      ...(exchange ? { exchange } : {}),
      ...(type ? { type } : {}),
      ...(q
        ? {
            OR: [
              { symbol: { contains: q, mode: "insensitive" } },
              { name: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [{ exchange: "asc" }, { symbol: "asc" }],
    skip,
    take,
  });
}

export async function findAssetById(id: string) {
  return prisma.asset.findUnique({ where: { id } });
}

export async function findAssetBySymbolExchange(symbol: string, exchange: string) {
  return prisma.asset.findUnique({
    where: { symbol_exchange: { symbol, exchange } },
  });
}
