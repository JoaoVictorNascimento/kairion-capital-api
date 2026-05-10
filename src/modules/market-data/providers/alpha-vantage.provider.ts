import type {
  HistoricalPriceParams,
  MarketDataCandlePoint,
  MarketDataProvider,
  MarketDataQuote,
  MarketDataSearchHit,
} from "./market-data-provider.js";
import {
  MarketDataProviderError,
  MarketDataProviderResponseError,
  MarketDataRateLimitedError,
  MarketDataSymbolNotFoundError,
} from "../services/market-data.errors.js";

const BASE_URL = "https://www.alphavantage.co/query";

function assertNotRateLimited(data: Record<string, unknown>) {
  const note = data.Note;
  if (typeof note === "string" && /call frequency|rate limit|API key frequency/i.test(note)) {
    throw new MarketDataRateLimitedError(note.trim());
  }
  const info = data.Information;
  if (typeof info === "string" && /frequency|rate limit|API key/i.test(info)) {
    throw new MarketDataRateLimitedError(info.trim());
  }
}

function assertNoErrorMessage(data: Record<string, unknown>) {
  const err = data["Error Message"];
  if (typeof err === "string") {
    throw new MarketDataProviderResponseError(err);
  }
}

async function fetchJson(url: string): Promise<Record<string, unknown>> {
  let response: Response;
  try {
    response = await fetch(url);
  } catch {
    throw new MarketDataProviderError("Network error calling market data provider", "MARKET_DATA_NETWORK", 502);
  }

  if (response.status === 429) {
    throw new MarketDataRateLimitedError();
  }

  if (!response.ok) {
    throw new MarketDataProviderError(
      `Market data provider HTTP ${response.status}`,
      "MARKET_DATA_HTTP",
      502,
    );
  }

  const data: unknown = await response.json();
  if (!data || typeof data !== "object") {
    throw new MarketDataProviderResponseError("Invalid JSON from market data provider");
  }
  return data as Record<string, unknown>;
}

function pickOutputSize(from?: Date, to?: Date): "compact" | "full" {
  if (!from) {
    return "compact";
  }
  const end = to ?? new Date();
  const ms = end.getTime() - from.getTime();
  const approxDays = ms / 86_400_000;
  return approxDays > 120 ? "full" : "compact";
}

function parseDailySeries(data: Record<string, unknown>): MarketDataCandlePoint[] {
  const series = data["Time Series (Daily)"];
  if (!series || typeof series !== "object") {
    return [];
  }

  const out: MarketDataCandlePoint[] = [];

  for (const [dateStr, row] of Object.entries(series)) {
    if (!row || typeof row !== "object") {
      continue;
    }
    const o = row as Record<string, string>;
    const open = Number(o["1. open"]);
    const high = Number(o["2. high"]);
    const low = Number(o["3. low"]);
    const close = Number(o["4. close"]);
    const volume = Number(o["5. volume"] ?? 0);

    if ([open, high, low, close].some((n) => Number.isNaN(n))) {
      continue;
    }

    const bucketStart = new Date(`${dateStr}T00:00:00.000Z`);
    out.push({
      bucketStart,
      open,
      high,
      low,
      close,
      volume: Number.isNaN(volume) ? 0 : volume,
    });
  }

  out.sort((a, b) => a.bucketStart.getTime() - b.bucketStart.getTime());
  return out;
}

/**
 * Alpha Vantage implementation ({@link https://www.alphavantage.co/documentation/}).
 */
export function createAlphaVantageProvider(apiKey: string): MarketDataProvider {
  const key = apiKey.trim();

  return {
    async searchAssets(query: string): Promise<MarketDataSearchHit[]> {
      const q = query.trim();
      if (!q) {
        return [];
      }

      const url = `${BASE_URL}?${new URLSearchParams({
        function: "SYMBOL_SEARCH",
        keywords: q,
        apikey: key,
      })}`;

      const data = await fetchJson(url);
      assertNotRateLimited(data);
      assertNoErrorMessage(data);

      const raw = data.bestMatches;
      if (!Array.isArray(raw)) {
        return [];
      }

      return raw
        .map((item): MarketDataSearchHit | null => {
          if (!item || typeof item !== "object") {
            return null;
          }
          const row = item as Record<string, string>;
          const symbol = row["1. symbol"];
          const name = row["2. name"];
          if (!symbol || !name) {
            return null;
          }
          return {
            symbol,
            name,
            type: row["3. type"],
            region: row["4. region"],
          };
        })
        .filter((x): x is MarketDataSearchHit => x !== null);
    },

    async getQuote(symbol: string): Promise<MarketDataQuote | null> {
      const sym = symbol.trim().toUpperCase();
      const url = `${BASE_URL}?${new URLSearchParams({
        function: "GLOBAL_QUOTE",
        symbol: sym,
        apikey: key,
      })}`;

      const data = await fetchJson(url);
      assertNotRateLimited(data);
      assertNoErrorMessage(data);

      const gq = data["Global Quote"];
      if (!gq || typeof gq !== "object") {
        return null;
      }
      const row = gq as Record<string, string>;
      const priceStr = row["05. price"];
      if (!priceStr) {
        return null;
      }
      const price = Number(priceStr);
      if (Number.isNaN(price)) {
        return null;
      }

      const change = row["09. change"];
      const changePercent = row["10. change percent"];

      return {
        symbol: row["01. symbol"] ?? sym,
        price,
        change: change !== undefined ? Number(change) : undefined,
        changePercent: changePercent,
      };
    },

    async getHistoricalPrices(params: HistoricalPriceParams): Promise<MarketDataCandlePoint[]> {
      if (params.interval !== "DAY") {
        throw new MarketDataProviderResponseError("Alpha Vantage provider supports only daily interval");
      }

      const sym = params.symbol.trim().toUpperCase();
      const outputsize = pickOutputSize(params.from, params.to);

      const url = `${BASE_URL}?${new URLSearchParams({
        function: "TIME_SERIES_DAILY",
        symbol: sym,
        outputsize,
        apikey: key,
      })}`;

      const data = await fetchJson(url);
      assertNotRateLimited(data);
      assertNoErrorMessage(data);

      let series = parseDailySeries(data);
      if (series.length === 0) {
        throw new MarketDataSymbolNotFoundError(sym);
      }

      const fromMs = params.from?.getTime();
      const toMs = params.to?.getTime();

      if (fromMs !== undefined) {
        series = series.filter((c) => c.bucketStart.getTime() >= fromMs);
      }
      if (toMs !== undefined) {
        series = series.filter((c) => c.bucketStart.getTime() <= toMs);
      }

      return series;
    },
  };
}
