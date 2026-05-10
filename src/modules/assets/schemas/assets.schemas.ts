import { z } from "zod";

export const assetTypeSchema = z.enum([
  "STOCK",
  "ETF",
  "CRYPTO",
  "FX",
  "INDEX",
  "FUND",
  "BOND",
  "OTHER",
]);

export const createAssetBodySchema = z.object({
  symbol: z.string().min(1),
  exchange: z.string().min(1),
  name: z.string().min(1),
  type: assetTypeSchema.optional(),
  currency: z.string().min(1),
});

export const listAssetsQuerySchema = z.object({
  q: z.string().min(1).optional(),
  exchange: z.string().min(1).optional(),
  type: assetTypeSchema.optional(),
  skip: z.coerce.number().int().min(0).optional(),
  take: z.coerce.number().int().min(1).max(100).optional(),
});

export type CreateAssetBody = z.infer<typeof createAssetBodySchema>;
export type ListAssetsQuery = z.infer<typeof listAssetsQuerySchema>;
