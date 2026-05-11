import type { ReturnSeriesMetrics } from "../../modules/analytics/metrics.js";
import { metricsFromSimpleDailyReturns } from "../../modules/analytics/metrics.js";
import { callQuantix, QuantixUnavailableError } from "./quantix-client.js";
import { QUANTIX_ENDPOINTS } from "./quantix-protocol.js";
import type { QuantixMetricsInput, QuantixMetricsOutput } from "./quantix-protocol.js";

export type ComputeMetricsResult = {
  metrics: ReturnSeriesMetrics;
  engine: "quantix" | "ts";
};

export async function computeMetrics(
  returns: number[],
  riskFreeAnnual = 0,
): Promise<ComputeMetricsResult> {
  try {
    const metrics = await callQuantix<QuantixMetricsInput, QuantixMetricsOutput>(
      QUANTIX_ENDPOINTS.metrics,
      { returns, riskFreeAnnual },
    );
    return { metrics, engine: "quantix" };
  } catch (err) {
    if (!(err instanceof QuantixUnavailableError)) {
      throw err;
    }
    const metrics = metricsFromSimpleDailyReturns(returns, riskFreeAnnual);
    return { metrics, engine: "ts" };
  }
}
