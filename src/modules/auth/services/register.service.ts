import bcrypt from "bcryptjs";
import { Prisma } from "../../../generated/prisma/client.js";
import { env } from "../../../lib/env.js";
import { createUser, findUserByEmail } from "../../users/repositories/users.repository.js";
import { EmailAlreadyTakenError } from "./errors.js";

export async function registerUser(input: {
  name: string;
  email: string;
  password: string;
}) {
  const existingUser = await findUserByEmail(input.email);

  if (existingUser) {
    throw new EmailAlreadyTakenError();
  }

  const passwordHash = await bcrypt.hash(input.password, env.BCRYPT_ROUNDS);

  try {
    return await createUser({
      name: input.name,
      email: input.email,
      passwordHash,
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new EmailAlreadyTakenError();
    }
    throw err;
  }
}
