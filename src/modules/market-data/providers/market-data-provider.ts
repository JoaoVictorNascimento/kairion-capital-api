/**
 * External market data source (REST API, etc.). Implementations must not depend on Prisma.
 */
export type MarketDataSearchHit = {
  symbol: string;
  name: string;
  type?: string;
  region?: string;
};

export type MarketDataQuote = {
  symbol: string;
  price: number;
  change?: number;
  changePercent?: string;
};

export type MarketDataInterval = "DAY";

export type HistoricalPriceParams = {
  symbol: string;
  interval: MarketDataInterval;
  /** Inclusive lower bound (UTC date / instant). */
  from?: Date;
  /** Inclusive upper bound (UTC date / instant). */
  to?: Date;
};

export type MarketDataCandlePoint = {
  bucketStart: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export interface MarketDataProvider {
  /** Resolve tickers/names matching a user search string. */
  searchAssets(query: string): Promise<MarketDataSearchHit[]>;

  /** Best-effort last trade or reference price for a single symbol. */
  getQuote(symbol: string): Promise<MarketDataQuote | null>;

  /** Daily (or other) bars; implementations may ignore bounds and let the caller filter. */
  getHistoricalPrices(params: HistoricalPriceParams): Promise<MarketDataCandlePoint[]>;
}
