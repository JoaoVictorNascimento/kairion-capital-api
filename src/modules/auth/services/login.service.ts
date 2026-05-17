import bcrypt from "bcryptjs";
import { findUserByEmail } from "../../users/repositories/users.repository.js";
import { InvalidCredentialsError } from "./errors.js";

export async function loginUser(input: {
  email: string;
  password: string;
}) {
  const user = await findUserByEmail(input.email);

  if (!user) {
    throw new InvalidCredentialsError();
  }

  const passwordMatches = await bcrypt.compare(input.password, user.passwordHash);

  if (!passwordMatches) {
    throw new InvalidCredentialsError();
  }

  return user;
}
