import {
  createPortfolio as createPortfolioRepo,
  listPortfoliosByUserId,
} from "../repositories/portfolios.repository.js";
import type { CreatePortfolioBody } from "../schemas/portfolios.schemas.js";

export async function createPortfolioService(userId: string, body: CreatePortfolioBody) {
  return createPortfolioRepo(userId, {
    name: body.name,
    description: body.description,
  });
}

export async function listPortfoliosService(userId: string) {
  return listPortfoliosByUserId(userId);
}
