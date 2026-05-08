import { Prisma } from "../../../generated/prisma/client.js";
import type { AssetType } from "../../../generated/prisma/enums.js";
import { createAsset as createAssetRepo } from "../repositories/assets.repository.js";
import { DuplicateAssetError } from "./errors.js";

export async function createAsset(input: {
  symbol: string;
  exchange: string;
  name: string;
  type?: AssetType;
  currency: string;
}) {
  const symbol = input.symbol.trim().toUpperCase();
  const exchange = input.exchange.trim();

  try {
    return await createAssetRepo({
      ...input,
      symbol,
      exchange,
    });
  } catch (err: unknown) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2002") {
        throw new DuplicateAssetError();
      }
    }
    throw err;
  }
}

