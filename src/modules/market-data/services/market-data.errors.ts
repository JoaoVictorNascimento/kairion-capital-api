import { AppError } from "../../../shared/errors/app-error.js";

export class MarketDataProviderError extends AppError {
  constructor(message: string, code: string, statusCode = 502) {
    super(message, code, statusCode);
  }
}

/** Provider returned HTTP 429 or documented rate-limit notice. */
export class MarketDataRateLimitedError extends MarketDataProviderError {
  constructor(message = "Market data provider rate limit exceeded") {
    super(message, "MARKET_DATA_RATE_LIMITED", 429);
  }
}

/** Symbol unknown or empty series from provider. */
export class MarketDataSymbolNotFoundError extends MarketDataProviderError {
  constructor(symbol: string) {
    super(`Market data not found for symbol: ${symbol}`, "MARKET_DATA_SYMBOL_NOT_FOUND", 404);
  }
}

/** Response body could not be parsed or was unexpected. */
export class MarketDataProviderResponseError extends MarketDataProviderError {
  constructor(message: string) {
    super(message, "MARKET_DATA_PROVIDER_RESPONSE", 502);
  }
}
