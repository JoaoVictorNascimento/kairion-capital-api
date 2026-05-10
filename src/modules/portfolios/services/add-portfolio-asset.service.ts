import { Prisma } from "../../../generated/prisma/client.js";
import { findAssetById } from "../../assets/repositories/assets.repository.js";
import { AssetNotFoundError } from "../../assets/services/errors.js";
import {
  addPortfolioAsset as addPortfolioAssetRepo,
  findPortfolioRowForUser,
} from "../repositories/portfolios.repository.js";
import type { AddPortfolioAssetBody } from "../schemas/portfolios.schemas.js";
import {
  DuplicatePortfolioAssetError,
  PortfolioNotFoundError,
} from "./errors.js";

export async function addPortfolioAssetService(
  portfolioId: string,
  userId: string,
  body: AddPortfolioAssetBody,
) {
  const owned = await findPortfolioRowForUser(portfolioId, userId);
  if (!owned) {
    throw new PortfolioNotFoundError();
  }

  const asset = await findAssetById(body.assetId);
  if (!asset) {
    throw new AssetNotFoundError();
  }

  const targetWeight =
    body.targetWeight !== undefined ? new Prisma.Decimal(body.targetWeight) : null;
  const quantity = body.quantity !== undefined ? new Prisma.Decimal(body.quantity) : null;

  try {
    const row = await addPortfolioAssetRepo({
      portfolioId,
      assetId: body.assetId,
      targetWeight,
      quantity,
    });
    return {
      position: {
        id: row.id,
        assetId: row.assetId,
        targetWeight: row.targetWeight !== null ? Number(row.targetWeight) : null,
        quantity: row.quantity !== null ? Number(row.quantity) : null,
        asset: {
          id: row.asset.id,
          symbol: row.asset.symbol,
          name: row.asset.name,
          exchange: row.asset.exchange,
          type: row.asset.type,
          currency: row.asset.currency,
        },
      },
    };
  } catch (err: unknown) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new DuplicatePortfolioAssetError();
    }
    throw err;
  }
}
