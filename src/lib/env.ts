import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(3333),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(1),
  /** API key for https://www.alphavantage.co (market data sync). */
  ALPHA_VANTAGE_API_KEY: z.string().min(1),
  /** Base URL of the quantix Rust microservice (optional; disables when empty). */
  QUANTIX_BASE_URL: z.string().url().optional(),
  /** Timeout in ms for quantix HTTP calls. */
  QUANTIX_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
});

export const env = envSchema.parse(process.env);