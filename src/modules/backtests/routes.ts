import { FastifyInstance } from "fastify";
import { movingAverageBacktestBodySchema } from "./schemas/backtests.schemas.js";
import {
  getBacktestByIdService,
  listBacktestsForUserService,
  runMovingAverageBacktestService,
} from "./services/backtests.service.js";

export async function backtestsRoutes(app: FastifyInstance) {
  app.post("/moving-average", { preHandler: [app.authenticate] }, async (request, reply) => {
    const userId = request.user.sub;
    const body = movingAverageBacktestBodySchema.parse(request.body);
    const result = await runMovingAverageBacktestService(userId, body);
    return reply.status(201).send(result);
  });

  app.get("/", { preHandler: [app.authenticate] }, async (request) => {
    const userId = request.user.sub;
    return listBacktestsForUserService(userId);
  });

  app.get("/:id", { preHandler: [app.authenticate] }, async (request) => {
    const userId = request.user.sub;
    const { id } = request.params as { id: string };
    return getBacktestByIdService(id, userId);
  });
}
