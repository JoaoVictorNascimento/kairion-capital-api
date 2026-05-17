import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import jwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";
import authenticatePlugin from "./plugins/authenticate.js";
import errorHandlerPlugin from "./plugins/error-handler.js";

import { corsOrigins, env } from "../lib/env.js";
import { healthRoutes } from "./routes/health.routes.js";
import { authRoutes } from "../modules/auth/routes.js";
import { usersRoutes } from "../modules/users/routes.js";
import { assetsRoutes } from "../modules/assets/routes.js";
import { portfoliosRoutes } from "../modules/portfolios/routes.js";
import { backtestsRoutes } from "../modules/backtests/routes.js";

function buildLoggerOptions() {
  if (env.NODE_ENV === "test") {
    return false;
  }

  const base = {
    level: env.LOG_LEVEL,
    redact: {
      paths: [
        "req.headers.authorization",
        "req.headers.cookie",
        "req.body.password",
        "req.body.passwordHash",
      ],
      censor: "[REDACTED]",
    },
  };

  if (env.NODE_ENV === "development") {
    return {
      ...base,
      transport: {
        target: "pino-pretty",
        options: { colorize: true, translateTime: "SYS:standard", ignore: "pid,hostname" },
      },
    };
  }

  return base;
}

function resolveCorsOrigin(): boolean | string[] {
  if (corsOrigins.length === 0 || corsOrigins.includes("*")) {
    return true;
  }
  return corsOrigins;
}

export async function buildApp() {
  const app = Fastify({
    logger: buildLoggerOptions(),
  });

  await app.register(helmet, {
    contentSecurityPolicy: false,
  });

  await app.register(cors, {
    origin: resolveCorsOrigin(),
    credentials: true,
  });

  await app.register(rateLimit, {
    max: 300,
    timeWindow: "1 minute",
  });

  await app.register(jwt, {
    secret: env.JWT_SECRET,
    sign: { expiresIn: env.JWT_EXPIRES_IN },
  });

  await app.register(authenticatePlugin);
  await app.register(errorHandlerPlugin);

  await app.register(healthRoutes, { prefix: "/health" });
  await app.register(authRoutes, { prefix: "/auth" });
  await app.register(usersRoutes, { prefix: "/users" });
  await app.register(assetsRoutes, { prefix: "/assets" });
  await app.register(portfoliosRoutes, { prefix: "/portfolios" });
  await app.register(backtestsRoutes, { prefix: "/backtests" });

  return app;
}