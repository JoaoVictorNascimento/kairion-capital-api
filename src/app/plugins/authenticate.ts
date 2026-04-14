import fp from "fastify-plugin";
import { FastifyReply, FastifyRequest } from "fastify";

async function authenticatePlugin(app: any) {
  app.decorate(
    "authenticate",
    async function (request: FastifyRequest, reply: FastifyReply) {
      await request.jwtVerify();
    },
  );
}

export default fp(authenticatePlugin);