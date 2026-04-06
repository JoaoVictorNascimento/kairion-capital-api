import { FastifyInstance } from "fastify";

export async function healthRoutes(app: FastifyInstance) {
  app.get("/", async () => {
    return {
      status: "ok",
      service: "kairion-capital-api",
      timestamp: new Date().toISOString(),
    };
  });
}