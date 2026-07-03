import pLimit, { type LimitFunction } from "p-limit";
import { getEnv } from "../env";
import { getProvider } from "../providers";
import { GenerationError } from "../providers/errors";
import { getStorage } from "../storage";
import { getGeneration, markFailed, markRunning, markSucceeded } from "./repo";

/**
 * Module-level semaphore bounding simultaneous AI calls in this Node process.
 * Created lazily so `next build` never reads env. Extra jobs wait here while
 * their rows stay 'queued', so status reflects reality under load (plan §5).
 */
let limit: LimitFunction | null = null;
function getLimiter(): LimitFunction {
  if (!limit) limit = pLimit(getEnv().MAX_CONCURRENT_GENERATIONS);
  return limit;
}

/**
 * Runs one generation to completion, writing the outcome to its row. Designed
 * to be called fire-and-forget from a Route Handler via `after()`: it owns its
 * error handling and never throws. Each of the three failure states is mapped
 * to a typed error_code the UI can render distinctly.
 */
export async function runGeneration(id: string, sessionId: string): Promise<void> {
  await getLimiter()(async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), getEnv().GENERATION_TIMEOUT_MS);
    try {
      const g = await getGeneration(id, sessionId);
      if (!g || g.status !== "queued") return; // already handled, cancelled, or gone
      await markRunning(id);

      const { bytes, contentType, extension } = await getProvider().generate({
        prompt: g.prompt,
        params: g.params,
        signal: controller.signal,
      });

      const key = `generations/${id}${extension}`;
      await getStorage().put(key, bytes, contentType);
      await markSucceeded(id, key);
    } catch (err) {
      const code = err instanceof GenerationError ? err.code : "unknown";
      const message = err instanceof Error ? err.message : "Unknown error.";
      // Never let a failure escape the after() callback.
      await markFailed(id, code, message).catch(() => {});
    } finally {
      clearTimeout(timer);
    }
  });
}
