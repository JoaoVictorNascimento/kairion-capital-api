import { AppError } from "../../../shared/errors/app-error.js";

export class EmailAlreadyTakenError extends AppError {
  constructor() {
    super("Email already in use", "EMAIL_ALREADY_TAKEN", 409);
  }
}

export class InvalidCredentialsError extends AppError {
  constructor() {
    super("Invalid credentials", "INVALID_CREDENTIALS", 401);
  }
}
