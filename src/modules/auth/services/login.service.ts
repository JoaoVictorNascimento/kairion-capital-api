import bcrypt from "bcryptjs";
import { findUserByEmail } from "../../users/repositories/users.repository.js";

export async function loginUser(input: {
  email: string;
  password: string;
}) {
  const user = await findUserByEmail(input.email);

  if (!user) {
    throw new Error("Invalid credentials");
  }

  const passwordMatches = await bcrypt.compare(input.password, user.passwordHash);

  if (!passwordMatches) {
    throw new Error("Invalid credentials");
  }

  return user;
}