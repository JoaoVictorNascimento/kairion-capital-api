import { z } from "zod";

export const createPortfolioBodySchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
});

export const addPortfolioAssetBodySchema = z
  .object({
    assetId: z.string().min(1),
    /** Target weight as a fraction in (0, 1], e.g. 0.25 = 25%. Mutually exclusive with `quantity`. */
    targetWeight: z.number().positive().max(1).optional(),
    /** Units of the asset. Mutually exclusive with `targetWeight`. */
    quantity: z.number().positive().optional(),
  })
  .refine(
    (body) =>
      (body.targetWeight !== undefined ? 1 : 0) + (body.quantity !== undefined ? 1 : 0) === 1,
    {
      message: "Provide exactly one of targetWeight or quantity",
      path: ["targetWeight"],
    },
  );

export type CreatePortfolioBody = z.infer<typeof createPortfolioBodySchema>;
export type AddPortfolioAssetBody = z.infer<typeof addPortfolioAssetBodySchema>;
