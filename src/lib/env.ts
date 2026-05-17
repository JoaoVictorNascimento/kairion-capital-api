import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(3333),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(1),
  /** JWT lifetime accepted by `@fastify/jwt` (e.g. `15m`, `7d`, `3600`). */
  JWT_EXPIRES_IN: z.string().min(1).default("7d"),
  /**
   * Comma-separated list of allowed CORS origins. `*` keeps the door open
   * (only sensible in dev). Empty list defaults to "no cross-origin".
   */
  CORS_ORIGINS: z.string().default("*"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  /** API key for https://www.alphavantage.co (market data sync). */
  ALPHA_VANTAGE_API_KEY: z.string().min(1),
  /** Base URL of the quantix Rust microservice (optional; disables when empty). */
  QUANTIX_BASE_URL: z.string().url().optional(),
  /** Timeout in ms for quantix HTTP calls. */
  QUANTIX_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
  /** bcrypt rounds for password hashing (10–14 sensato; 12 default). */
  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(12),
});

export const env = envSchema.parse(process.env);

/** Parsed list of CORS origins. `["*"]` means "any origin". */
export const corsOrigins: string[] = env.CORS_ORIGINS.split(",")
  .map((o) => o.trim())
  .filter((o) => o.length > 0);