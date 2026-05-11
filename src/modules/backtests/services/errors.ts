export class InsufficientHistoryForBacktestError extends Error {
  readonly code = "INSUFFICIENT_HISTORY_FOR_BACKTEST" as const;

  constructor(message = "Not enough daily candles for this period and MA periods") {
    super(message);
    this.name = "InsufficientHistoryForBacktestError";
  }
}

export class BacktestNotFoundError extends Error {
  constructor() {
    super("Backtest not found");
    this.name = "BacktestNotFoundError";
  }
}
