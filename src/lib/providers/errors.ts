/**
 * The three failure states the brief requires, plus a catch-all. Detected in
 * the provider/worker and written to the row's `error_code` so the UI can show
 * a distinct, actionable card for each (plan §6).
 */
export type GenerationErrorCode = "timeout" | "invalid_prompt" | "bad_response" | "unknown";

export class GenerationError extends Error {
  constructor(
    readonly code: GenerationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "GenerationError";
  }
}

export const timeoutError = (message = "The image service did not respond in time.") =>
  new GenerationError("timeout", message);

export const invalidPromptError = (message: string) => new GenerationError("invalid_prompt", message);

export const badResponseError = (message: string) => new GenerationError("bad_response", message);
