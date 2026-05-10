export class InsufficientPriceDataError extends Error {
  readonly code = "INSUFFICIENT_PRICE_DATA" as const;

  constructor(message = "Not enough price history for the selected range") {
    super(message);
    this.name = "InsufficientPriceDataError";
  }
}

export class MixedPortfolioAllocationError extends Error {
  readonly code = "MIXED_ALLOCATION_NOT_SUPPORTED" as const;

  constructor() {
    super("Portfolio mixes target weights and quantities; use one allocation mode only");
    this.name = "MixedPortfolioAllocationError";
  }
}

export class CurrencyMismatchError extends Error {
  readonly code = "CURRENCY_MISMATCH" as const;

  constructor() {
    super("Portfolio positions use different currencies; analytics requires a single currency");
    this.name = "CurrencyMismatchError";
  }
}
