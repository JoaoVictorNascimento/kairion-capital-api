import { z } from "zod";

/** Matches analytics candle `take` cap (~11 years of weekdays). */
const MAX_RANGE_DAYS = 4000;

export const metricsQuerySchema = z
  .object({
    from: z.coerce.date(),
    to: z.coerce.date(),
  })
  .refine((q) => q.from.getTime() <= q.to.getTime(), {
    message: "from must be before or equal to to",
    path: ["to"],
  })
  .refine((q) => (q.to.getTime() - q.from.getTime()) / 86_400_000 <= MAX_RANGE_DAYS, {
    message: `Date range must not exceed ${MAX_RANGE_DAYS} days`,
    path: ["to"],
  });

export type MetricsQuery = z.infer<typeof metricsQuerySchema>;
