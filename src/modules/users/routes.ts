import { FastifyInstance } from "fastify";
import { findUserById } from "./repositories/users.repository.js";

export async function usersRoutes(app: FastifyInstance) {
  app.get(
    "/me",
    {
      preHandler: [app.authenticate],
    },
    async (request, reply) => {
      const userId = request.user.sub;

      const user = await findUserById(userId);

      if (!user) {
        return reply.status(404).send({
          message: "User not found",
        });
      }

      return {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          createdAt: user.createdAt,
        },
      };
    },
  );
}