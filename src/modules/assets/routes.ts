import { FastifyInstance } from "fastify";
import { env } from "../../lib/env.js";
import { createAlphaVantageProvider } from "../market-data/providers/alpha-vantage.provider.js";
import {
  listAssetPricesQuerySchema,
  syncAssetPricesQuerySchema,
} from "../market-data/schemas/market-data.schemas.js";
import { listAssetPricesService } from "../market-data/services/list-asset-prices.service.js";
import { MarketDataProviderError } from "../market-data/services/market-data.errors.js";
import { syncAssetPricesService } from "../market-data/services/sync-asset-prices.service.js";
import { metricsQuerySchema } from "../analytics/schemas/analytics.schemas.js";
import { getAssetMetricsService } from "../analytics/services/get-asset-metrics.service.js";
import { InsufficientPriceDataError } from "../analytics/services/errors.js";
import {
  createAssetBodySchema,
  listAssetsQuerySchema,
} from "./schemas/assets.schemas.js";
import { createAsset } from "./services/create-asset.service.js";
import { getAssetById } from "./services/get-asset.service.js";
import { listAssetsService } from "./services/list-assets.service.js";
import { AssetNotFoundError, DuplicateAssetError } from "./services/errors.js";

const marketDataProvider = createAlphaVantageProvider(env.ALPHA_VANTAGE_API_KEY);

export async function assetsRoutes(app: FastifyInstance) {
  app.post(
    "/",
    {
      preHandler: [app.authenticate],
    },
    async (request, reply) => {
      try {
        const body = createAssetBodySchema.parse(request.body);
        const asset = await createAsset(body);

        return reply.status(201).send({ asset });
      } catch (err) {
        if (err instanceof DuplicateAssetError) {
          return reply.status(409).send({ message: err.message });
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
      const query = listAssetsQuerySchema.parse(request.query);
      const assets = await listAssetsService(query);
      return { assets };
    },
  );

  app.post(
    "/:id/sync-prices",
    {
      preHandler: [app.authenticate],
    },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const query = syncAssetPricesQuerySchema.parse(request.query);
        const result = await syncAssetPricesService(id, query, marketDataProvider);
        return reply.status(200).send(result);
      } catch (err) {
        if (err instanceof AssetNotFoundError) {
          return reply.status(404).send({ message: err.message });
        }
        if (err instanceof MarketDataProviderError) {
          return reply.status(err.statusCode).send({
            message: err.message,
            code: err.code,
          });
        }
        throw err;
      }
    },
  );

  app.get(
    "/:id/prices",
    {
      preHandler: [app.authenticate],
    },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const query = listAssetPricesQuerySchema.parse(request.query);
        const result = await listAssetPricesService(id, query);
        return result;
      } catch (err) {
        if (err instanceof AssetNotFoundError) {
          return reply.status(404).send({ message: err.message });
        }
        throw err;
      }
    },
  );

  app.get(
    "/:id/metrics",
    {
      preHandler: [app.authenticate],
    },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const query = metricsQuerySchema.parse(request.query);
        await getAssetById(id);
        return await getAssetMetricsService(id, query);
      } catch (err) {
        if (err instanceof AssetNotFoundError) {
          return reply.status(404).send({ message: err.message });
        }
        if (err instanceof InsufficientPriceDataError) {
          return reply.status(400).send({ message: err.message, code: err.code });
        }
        throw err;
      }
    },
  );

  app.get(
    "/:id",
    {
      preHandler: [app.authenticate],
    },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const asset = await getAssetById(id);
        return { asset };
      } catch (err) {
        if (err instanceof AssetNotFoundError) {
          return reply.status(404).send({ message: err.message });
        }
        throw err;
      }
    },
  );
}
