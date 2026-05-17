import { AppError } from "../../../shared/errors/app-error.js";

export class InsufficientHistoryForBacktestError extends AppError {
  constructor(message = "Not enough daily candles for this period and MA periods") {
    super(message, "INSUFFICIENT_HISTORY_FOR_BACKTEST", 400);
  }
}

export class BacktestNotFoundError extends AppError {
  constructor() {
    super("Backtest not found", "BACKTEST_NOT_FOUND", 404);
  }
}

export class InvalidPriceSeriesError extends AppError {
  constructor(message = "Price series contains non-positive or non-finite values") {
    super(message, "INVALID_PRICE_SERIES", 400);
  }
}
