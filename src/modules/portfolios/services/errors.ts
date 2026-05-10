export class PortfolioNotFoundError extends Error {
  constructor() {
    super("Portfolio not found");
    this.name = "PortfolioNotFoundError";
  }
}

export class DuplicatePortfolioAssetError extends Error {
  constructor() {
    super("Asset already in this portfolio");
    this.name = "DuplicatePortfolioAssetError";
  }
}

export class PortfolioAssetNotFoundError extends Error {
  constructor() {
    super("Asset is not in this portfolio");
    this.name = "PortfolioAssetNotFoundError";
  }
}

export class InvalidAllocationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidAllocationError";
  }
}
