import fp from "fastify-plugin";
import { z } from "zod";
import { AppError } from "../../shared/errors/app-error.js";

export default fp(async (app) => {
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof z.ZodError) {
      return reply.status(400).send({
        message: "Validation error",
        code: "VALIDATION_ERROR",
        issues: error.issues,
      });
    }

    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        message: error.message,
        code: error.code,
      });
    }

    request.log.error({ err: error }, "Unhandled error");

    const fastifyError = error as { statusCode?: number; message?: string };
    const statusCode = fastifyError.statusCode ?? 500;
    return reply.status(statusCode).send({
      message: statusCode >= 500 ? "Internal server error" : fastifyError.message ?? "Error",
      code: "INTERNAL_ERROR",
    });
  });
});
