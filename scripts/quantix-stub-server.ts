/**
 * Stub HTTP server that mimics the quantix Rust microservice using the
 * existing TypeScript analytics / backtest logic.
 *
 * Usage:
 *   npx tsx scripts/quantix-stub-server.ts          # port 4000
 *   PORT=5000 npx tsx scripts/quantix-stub-server.ts # port 5000
 *
 * Then set QUANTIX_BASE_URL=http://localhost:4000 in the main API's env.
 */

import Fastify from "fastify";
import { metricsFromSimpleDailyReturns } from "../src/modules/analytics/metrics.js";
import { runMovingAverageCrossover } from "../src/modules/backtests/engine/moving-average-crossover.js";
import type { QuantixMetricsInput, QuantixBacktestMaInput } from "../src/lib/quantix/quantix-protocol.js";

const port = Number(process.env["PORT"] ?? 4000);
const host = "0.0.0.0";

const app = Fastify({ logger: true });

app.get("/health", async () => ({ status: "ok" }));

app.post<{ Body: QuantixMetricsInput }>("/metrics", async (request) => {
  const { returns, riskFreeAnnual } = request.body;
  return metricsFromSimpleDailyReturns(returns, riskFreeAnnual);
});

app.post<{ Body: QuantixBacktestMaInput }>("/backtest/moving-average", async (request) => {
  const { closes, dates, fastPeriod, slowPeriod, initialCapital } = request.body;
  const bucketStarts = dates.map((d) => new Date(d));
  return runMovingAverageCrossover({ bucketStarts, closes, fastPeriod, slowPeriod, initialCapital });
});

app.listen({ port, host }, (err) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
});
