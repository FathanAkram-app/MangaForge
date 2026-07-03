import { getEnv } from "../env";
import { badResponseError, invalidPromptError, timeoutError } from "./errors";
import type { GenerateInput, GenerateOutput, ImageProvider } from "./types";

/** Magic-byte signatures so we only accept a body that is actually an image. */
const SIGNATURES: { magic: number[]; contentType: string; extension: string }[] = [
  { magic: [0xff, 0xd8, 0xff], contentType: "image/jpeg", extension: ".jpg" },
  { magic: [0x89, 0x50, 0x4e, 0x47], contentType: "image/png", extension: ".png" },
  { magic: [0x52, 0x49, 0x46, 0x46], contentType: "image/webp", extension: ".webp" }, // "RIFF"
];

function sniff(buf: Buffer) {
  return SIGNATURES.find((s) => s.magic.every((byte, i) => buf[i] === byte)) ?? null;
}

/**
 * Pollinations.ai — keyless GET that returns raw image bytes. It has no SLA and
 * frequently returns an HTML error page or an empty body under load, which is
 * exactly why it exercises our real error handling (plan §2.2 / §6).
 */
export class PollinationsProvider implements ImageProvider {
  readonly name = "pollinations";

  async generate({ prompt, params, signal }: GenerateInput): Promise<GenerateOutput> {
    const env = getEnv();
    const url = new URL(`${env.POLLINATIONS_BASE_URL}/prompt/${encodeURIComponent(prompt)}`);
    url.searchParams.set("model", params.model ?? "flux");
    url.searchParams.set("width", String(params.width ?? 1024));
    url.searchParams.set("height", String(params.height ?? 1024));
    if (params.seed !== undefined) url.searchParams.set("seed", String(params.seed));
    url.searchParams.set("nologo", "true");
    url.searchParams.set("safe", "true");

    let res: Response;
    try {
      res = await fetch(url, {
        signal,
        headers: env.POLLINATIONS_TOKEN ? { Authorization: `Bearer ${env.POLLINATIONS_TOKEN}` } : undefined,
      });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") throw timeoutError();
      throw badResponseError(`Could not reach the image service: ${(err as Error).message}`);
    }

    if (!res.ok) {
      if (res.status === 400 || res.status === 422) {
        throw invalidPromptError("The image service rejected this prompt.");
      }
      throw badResponseError(`Image service returned HTTP ${res.status}.`);
    }

    const contentType = res.headers.get("content-type") ?? "";
    const bytes = Buffer.from(await res.arrayBuffer());

    // A healthy response is image/*; under load Pollinations returns HTML/empty.
    if (!contentType.startsWith("image/") || bytes.length === 0) {
      throw badResponseError(`Expected an image but got "${contentType || "an empty response"}".`);
    }
    const kind = sniff(bytes);
    if (!kind) throw badResponseError("The response body was not a decodable image.");

    return { bytes, contentType: kind.contentType, extension: kind.extension };
  }
}
