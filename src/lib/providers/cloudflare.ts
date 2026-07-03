import { getEnv } from "../env";
import { badResponseError, invalidPromptError, timeoutError } from "./errors";
import type { GenerateInput, GenerateOutput, ImageProvider } from "./types";

type CloudflareResult = {
  success?: boolean;
  result?: { image?: string };
  errors?: { message?: string }[];
};

/**
 * Cloudflare Workers AI (FLUX.1 [schnell]) — the reliable free fallback
 * (~230 images/day). Returns base64 JSON, which we decode to PNG bytes.
 */
export class CloudflareProvider implements ImageProvider {
  readonly name = "cloudflare";

  async generate({ prompt, params, signal }: GenerateInput): Promise<GenerateOutput> {
    const env = getEnv();
    if (!env.CLOUDFLARE_ACCOUNT_ID || !env.CLOUDFLARE_API_TOKEN) {
      throw badResponseError("Cloudflare provider is not configured (missing account id / token).");
    }
    const model = params.model ?? "@cf/black-forest-labs/flux-1-schnell";
    const url = `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/ai/run/${model}`;

    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        signal,
        headers: {
          Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt, seed: params.seed }),
      });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") throw timeoutError();
      throw badResponseError(`Could not reach Cloudflare: ${(err as Error).message}`);
    }

    if (!res.ok) {
      if (res.status === 400) throw invalidPromptError("The model rejected this prompt.");
      throw badResponseError(`Cloudflare returned HTTP ${res.status}.`);
    }

    let json: CloudflareResult;
    try {
      json = (await res.json()) as CloudflareResult;
    } catch {
      throw badResponseError("Cloudflare response was not valid JSON.");
    }
    if (!json.success || !json.result?.image) {
      throw badResponseError(`Cloudflare response had no image (${json.errors?.[0]?.message ?? "unknown"}).`);
    }

    const bytes = Buffer.from(json.result.image, "base64");
    if (bytes.length === 0) throw badResponseError("Cloudflare returned an empty image.");
    return { bytes, contentType: "image/png", extension: ".png" };
  }
}
