import type { MovingAverageCrossoverResult } from "../../modules/backtests/engine/moving-average-crossover.js";
import { runMovingAverageCrossover } from "../../modules/backtests/engine/moving-average-crossover.js";
import { callQuantix, QuantixUnavailableError } from "./quantix-client.js";
import { QUANTIX_ENDPOINTS } from "./quantix-protocol.js";
import type { QuantixBacktestMaInput, QuantixBacktestMaOutput } from "./quantix-protocol.js";

export type ComputeBacktestMaResult = {
  result: MovingAverageCrossoverResult;
  engine: "quantix" | "ts";
};

export type BacktestMaParams = {
  bucketStarts: Date[];
  closes: number[];
  fastPeriod: number;
  slowPeriod: number;
  initialCapital: number;
};

export async function computeBacktestMa(
  params: BacktestMaParams,
): Promise<ComputeBacktestMaResult> {
  try {
    const result = await callQuantix<QuantixBacktestMaInput, QuantixBacktestMaOutput>(
      QUANTIX_ENDPOINTS.backtestMa,
      {
        closes: params.closes,
        dates: params.bucketStarts.map((d) => d.toISOString()),
        fastPeriod: params.fastPeriod,
        slowPeriod: params.slowPeriod,
        initialCapital: params.initialCapital,
      },
    );
    return { result, engine: "quantix" };
  } catch (err) {
    if (!(err instanceof QuantixUnavailableError)) {
      throw err;
    }
    const result = runMovingAverageCrossover(params);
    return { result, engine: "ts" };
  }
}
