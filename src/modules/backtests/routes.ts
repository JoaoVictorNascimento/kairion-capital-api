import { FastifyInstance } from "fastify";
import { movingAverageBacktestBodySchema } from "./schemas/backtests.schemas.js";
import {
  getBacktestByIdService,
  listBacktestsForUserService,
  runMovingAverageBacktestService,
} from "./services/backtests.service.js";
import { BacktestNotFoundError, InsufficientHistoryForBacktestError } from "./services/errors.js";
import { AssetNotFoundError } from "../assets/services/errors.js";

export async function backtestsRoutes(app: FastifyInstance) {
  app.post(
    "/moving-average",
    {
      preHandler: [app.authenticate],
    },
    async (request, reply) => {
      try {
        const userId = request.user.sub;
        const body = movingAverageBacktestBodySchema.parse(request.body);
        const result = await runMovingAverageBacktestService(userId, body);
        return reply.status(201).send(result);
      } catch (err) {
        if (err instanceof AssetNotFoundError) {
          return reply.status(404).send({ message: err.message });
        }
        if (err instanceof InsufficientHistoryForBacktestError) {
          return reply.status(400).send({ message: err.message, code: err.code });
        }
        throw err;
      }
    },
  );

  app.get(
    "/",
    {
      preHandler: [app.authenticate],
    },
    async (request) => {
      const userId = request.user.sub;
      return listBacktestsForUserService(userId);
    },
  );

  app.get(
    "/:id",
    {
      preHandler: [app.authenticate],
    },
    async (request, reply) => {
      try {
        const userId = request.user.sub;
        const { id } = request.params as { id: string };
        return await getBacktestByIdService(id, userId);
      } catch (err) {
        if (err instanceof BacktestNotFoundError) {
          return reply.status(404).send({ message: err.message });
        }
        throw err;
      }
    },
  );
}
