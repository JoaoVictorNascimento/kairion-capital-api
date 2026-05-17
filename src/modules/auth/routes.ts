import { FastifyInstance, FastifyReply } from "fastify";
import { loginBodySchema, registerBodySchema } from "./schemas/auth.schemas.js";
import { loginUser } from "./services/login.service.js";
import { registerUser } from "./services/register.service.js";

type SignableUser = { id: string; name: string; email: string };

async function signTokenFor(reply: FastifyReply, user: SignableUser) {
  const token = await reply.jwtSign({ sub: user.id, email: user.email });
  return {
    user: { id: user.id, name: user.name, email: user.email },
    token,
  };
}

export async function authRoutes(app: FastifyInstance) {
  app.post("/register", async (request, reply) => {
    const body = registerBodySchema.parse(request.body);
    const user = await registerUser(body);
    return reply.status(201).send(await signTokenFor(reply, user));
  });

  app.post("/login", async (request, reply) => {
    const body = loginBodySchema.parse(request.body);
    const user = await loginUser(body);
    return reply.send(await signTokenFor(reply, user));
  });
}
