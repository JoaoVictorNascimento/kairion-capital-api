import { findPortfolioByIdForUser } from "../repositories/portfolios.repository.js";
import { PortfolioNotFoundError } from "./errors.js";

function serializePortfolioWithAssets(portfolio: NonNullable<Awaited<ReturnType<typeof findPortfolioByIdForUser>>>) {
  return {
    id: portfolio.id,
    userId: portfolio.userId,
    name: portfolio.name,
    description: portfolio.description,
    createdAt: portfolio.createdAt,
    updatedAt: portfolio.updatedAt,
    assets: portfolio.assets.map((row) => ({
      id: row.id,
      assetId: row.assetId,
      targetWeight: row.targetWeight !== null ? Number(row.targetWeight) : null,
      quantity: row.quantity !== null ? Number(row.quantity) : null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      asset: {
        id: row.asset.id,
        symbol: row.asset.symbol,
        name: row.asset.name,
        exchange: row.asset.exchange,
        type: row.asset.type,
        currency: row.asset.currency,
      },
    })),
  };
}

export async function getPortfolioByIdService(portfolioId: string, userId: string) {
  const portfolio = await findPortfolioByIdForUser(portfolioId, userId);
  if (!portfolio) {
    throw new PortfolioNotFoundError();
  }
  return { portfolio: serializePortfolioWithAssets(portfolio) };
}
