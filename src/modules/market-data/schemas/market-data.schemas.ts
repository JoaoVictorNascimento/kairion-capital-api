import { z } from "zod";
import { CandleInterval } from "../../../generated/prisma/enums.js";

const candleIntervalSchema = z.enum([CandleInterval.DAY]);

export const syncAssetPricesQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  interval: candleIntervalSchema.default(CandleInterval.DAY),
});

export const listAssetPricesQuerySchema = z
  .object({
    from: z.coerce.date(),
    to: z.coerce.date(),
    interval: candleIntervalSchema.default(CandleInterval.DAY),
    skip: z.coerce.number().int().min(0).default(0),
    take: z.coerce.number().int().min(1).max(2000).default(500),
  })
  .refine((q) => q.from.getTime() <= q.to.getTime(), {
    message: "from must be before or equal to to",
    path: ["to"],
  });
