import { FastifyInstance } from "fastify";
import {
  createAssetBodySchema,
  listAssetsQuerySchema,
} from "./schemas/assets.schemas.js";
import { createAsset } from "./services/create-asset.service.js";
import { getAssetById } from "./services/get-asset.service.js";
import { listAssetsService } from "./services/list-assets.service.js";
import { AssetNotFoundError, DuplicateAssetError } from "./services/errors.js";

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

