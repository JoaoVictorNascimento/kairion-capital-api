/**
 * Base class for all domain errors. The global error handler maps these to
 * HTTP responses automatically: `{ statusCode, code, message }`.
 *
 * Use this instead of `throw new Error(...)` so the response never falls
 * through to Fastify's default 500 handler.
 */
export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(message: string, code: string, statusCode = 500) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
  }
}
