import { env } from "../env.js";

export class QuantixUnavailableError extends Error {
  constructor(reason: string) {
    super(`Quantix service unavailable: ${reason}`);
    this.name = "QuantixUnavailableError";
  }
}

/**
 * Generic HTTP client for the quantix Rust microservice.
 *
 * Throws `QuantixUnavailableError` when `QUANTIX_BASE_URL` is not configured
 * or the service is unreachable (network error, timeout, non-2xx status).
 */
export async function callQuantix<TIn, TOut>(
  path: string,
  input: TIn,
): Promise<TOut> {
  const baseUrl = env.QUANTIX_BASE_URL;
  if (!baseUrl) {
    throw new QuantixUnavailableError("QUANTIX_BASE_URL not configured");
  }

  const url = `${baseUrl}${path}`;
  let res: Response;

  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(env.QUANTIX_TIMEOUT_MS),
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown fetch error";
    throw new QuantixUnavailableError(message);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new QuantixUnavailableError(
      `HTTP ${res.status} from ${path}: ${body}`,
    );
  }

  return (await res.json()) as TOut;
}
