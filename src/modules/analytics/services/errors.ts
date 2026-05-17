import { AppError } from "../../../shared/errors/app-error.js";

export class InsufficientPriceDataError extends AppError {
  constructor(message = "Not enough price history for the selected range") {
    super(message, "INSUFFICIENT_PRICE_DATA", 400);
  }
}

export class MixedPortfolioAllocationError extends AppError {
  constructor() {
    super(
      "Portfolio mixes target weights and quantities; use one allocation mode only",
      "MIXED_ALLOCATION_NOT_SUPPORTED",
      400,
    );
  }
}

export class CurrencyMismatchError extends AppError {
  constructor() {
    super(
      "Portfolio positions use different currencies; analytics requires a single currency",
      "CURRENCY_MISMATCH",
      422,
    );
  }
}
