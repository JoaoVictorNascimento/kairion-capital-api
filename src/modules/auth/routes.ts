import { FastifyInstance } from "fastify";
import { registerBodySchema, loginBodySchema } from "./schemas/auth.schemas.js";
import { registerUser } from "./services/register.service.js";
import { loginUser } from "./services/login.service.js";

export async function authRoutes(app: FastifyInstance) {
  app.post("/register", async (request, reply) => {
    const body = registerBodySchema.parse(request.body);

    const user = await registerUser(body);

    const token = await reply.jwtSign({
      sub: user.id,
      email: user.email,
    });

    return reply.status(201).send({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
      token,
    });
  });

  app.post("/login", async (request, reply) => {
    const body = loginBodySchema.parse(request.body);

    const user = await loginUser(body);

    const token = await reply.jwtSign({
      sub: user.id,
      email: user.email,
    });

    return reply.send({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
      token,
    });
  });
}