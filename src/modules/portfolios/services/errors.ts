import { AppError } from "../../../shared/errors/app-error.js";

export class PortfolioNotFoundError extends AppError {
  constructor() {
    super("Portfolio not found", "PORTFOLIO_NOT_FOUND", 404);
  }
}

export class DuplicatePortfolioAssetError extends AppError {
  constructor() {
    super("Asset already in this portfolio", "DUPLICATE_PORTFOLIO_ASSET", 409);
  }
}

export class PortfolioAssetNotFoundError extends AppError {
  constructor() {
    super("Asset is not in this portfolio", "PORTFOLIO_ASSET_NOT_FOUND", 404);
  }
}

export class InvalidAllocationError extends AppError {
  constructor(message = "Portfolio allocation is invalid") {
    super(message, "INVALID_ALLOCATION", 400);
  }
}
