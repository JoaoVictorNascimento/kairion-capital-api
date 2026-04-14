import bcrypt from "bcryptjs";
import { createUser, findUserByEmail } from "../../users/repositories/users.repository.js";

export async function registerUser(input: {
  name: string;
  email: string;
  password: string;
}) {
  const existingUser = await findUserByEmail(input.email);

  if (existingUser) {
    throw new Error("User already exists");
  }

  const passwordHash = await bcrypt.hash(input.password, 10);

  const user = await createUser({
    name: input.name,
    email: input.email,
    passwordHash,
  });

  return user;
}