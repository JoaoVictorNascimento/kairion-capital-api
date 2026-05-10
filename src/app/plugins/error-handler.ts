import fp from "fastify-plugin";
import { z } from "zod";

export default fp(async (app) => {
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof z.ZodError) {
      return reply.status(400).send({
        message: "Validation error",
        issues: error.issues,
      });
    }

    return reply.send(error);
  });
});

