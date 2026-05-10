import {
  findPortfolioRowForUser,
  removePortfolioAsset as removePortfolioAssetRepo,
} from "../repositories/portfolios.repository.js";
import { PortfolioAssetNotFoundError, PortfolioNotFoundError } from "./errors.js";

export async function removePortfolioAssetService(portfolioId: string, assetId: string, userId: string) {
  const owned = await findPortfolioRowForUser(portfolioId, userId);
  if (!owned) {
    throw new PortfolioNotFoundError();
  }

  const removed = await removePortfolioAssetRepo(portfolioId, assetId);
  if (removed === 0) {
    throw new PortfolioAssetNotFoundError();
  }
}
