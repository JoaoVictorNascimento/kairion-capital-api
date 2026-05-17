import { FastifyInstance } from "fastify";
import { metricsQuerySchema } from "../analytics/schemas/analytics.schemas.js";
import { getPortfolioMetricsService } from "../analytics/services/get-portfolio-metrics.service.js";
import {
  addPortfolioAssetBodySchema,
  createPortfolioBodySchema,
} from "./schemas/portfolios.schemas.js";
import { addPortfolioAssetService } from "./services/add-portfolio-asset.service.js";
import {
  createPortfolioService,
  listPortfoliosService,
} from "./services/create-portfolio.service.js";
import { getPortfolioByIdService } from "./services/get-portfolio.service.js";
import { removePortfolioAssetService } from "./services/remove-portfolio-asset.service.js";

export async function portfoliosRoutes(app: FastifyInstance) {
  app.post("/", { preHandler: [app.authenticate] }, async (request, reply) => {
    const userId = request.user.sub;
    const body = createPortfolioBodySchema.parse(request.body);
    const portfolio = await createPortfolioService(userId, body);
    return reply.status(201).send({ portfolio });
  });

  app.get("/", { preHandler: [app.authenticate] }, async (request) => {
    const userId = request.user.sub;
    const portfolios = await listPortfoliosService(userId);
    return { portfolios };
  });

  app.post("/:id/assets", { preHandler: [app.authenticate] }, async (request, reply) => {
    const userId = request.user.sub;
    const { id } = request.params as { id: string };
    const body = addPortfolioAssetBodySchema.parse(request.body);
    const result = await addPortfolioAssetService(id, userId, body);
    return reply.status(201).send(result);
  });

  app.delete(
    "/:id/assets/:assetId",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const userId = request.user.sub;
      const { id, assetId } = request.params as { id: string; assetId: string };
      await removePortfolioAssetService(id, assetId, userId);
      return reply.status(204).send();
    },
  );

  app.get("/:id/metrics", { preHandler: [app.authenticate] }, async (request) => {
    const userId = request.user.sub;
    const { id } = request.params as { id: string };
    const query = metricsQuerySchema.parse(request.query);
    return getPortfolioMetricsService(id, userId, query);
  });

  app.get("/:id", { preHandler: [app.authenticate] }, async (request) => {
    const userId = request.user.sub;
    const { id } = request.params as { id: string };
    return getPortfolioByIdService(id, userId);
  });
}
