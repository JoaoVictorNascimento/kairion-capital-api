import { z } from "zod";

/** Aligns with analytics candle window and `listDailyClosesInRange` cap. */
export const MAX_BACKTEST_RANGE_DAYS = 4000;

export const movingAverageBacktestBodySchema = z
  .object({
    assetId: z.string().min(1),
    from: z.coerce.date(),
    to: z.coerce.date(),
    initialCapital: z.coerce.number().positive(),
    fastPeriod: z.coerce.number().int().min(2),
    slowPeriod: z.coerce.number().int().min(3),
  })
  .refine((b) => b.from.getTime() <= b.to.getTime(), {
    message: "from must be before or equal to to",
    path: ["to"],
  })
  .refine((b) => (b.to.getTime() - b.from.getTime()) / 86_400_000 <= MAX_BACKTEST_RANGE_DAYS, {
    message: `Date range must not exceed ${MAX_BACKTEST_RANGE_DAYS} days`,
    path: ["to"],
  })
  .refine((b) => b.slowPeriod > b.fastPeriod, {
    message: "slowPeriod must be greater than fastPeriod",
    path: ["slowPeriod"],
  });

export type MovingAverageBacktestBody = z.infer<typeof movingAverageBacktestBodySchema>;
