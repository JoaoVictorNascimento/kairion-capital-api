import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import sensible from "@fastify/sensible";
import authenticatePlugin from "./plugins/authenticate.js";

import { env } from "../lib/env.js";
import { healthRoutes } from "./routes/health.routes.js";
import { authRoutes } from "../modules/auth/routes.js";
import { usersRoutes } from "../modules/users/routes.js";

export async function buildApp() {
  const app = Fastify({
    logger: true,
  });

  await app.register(cors, {
    origin: true,
  });

  await app.register(sensible);

  await app.register(jwt, {
    secret: env.JWT_SECRET,
  });

  await app.register(authenticatePlugin);

  await app.register(healthRoutes, { prefix: "/health" });
  await app.register(authRoutes, { prefix: "/auth" });
  await app.register(usersRoutes, { prefix: "/users" });

  return app;
}