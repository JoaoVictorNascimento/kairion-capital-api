import fp from "fastify-plugin";
import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

async function authenticatePlugin(app: FastifyInstance) {
  app.decorate("authenticate", async function (request: FastifyRequest, _reply: FastifyReply) {
    await request.jwtVerify();
  });
}

export default fp(authenticatePlugin);
