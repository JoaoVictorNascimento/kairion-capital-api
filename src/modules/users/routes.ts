import { FastifyInstance } from "fastify";
import { AppError } from "../../shared/errors/app-error.js";
import { findUserById } from "./repositories/users.repository.js";

class UserNotFoundError extends AppError {
  constructor() {
    super("User not found", "USER_NOT_FOUND", 404);
  }
}

export async function usersRoutes(app: FastifyInstance) {
  app.get("/me", { preHandler: [app.authenticate] }, async (request) => {
    const userId = request.user.sub;
    const user = await findUserById(userId);

    if (!user) {
      throw new UserNotFoundError();
    }

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
      },
    };
  });
}
