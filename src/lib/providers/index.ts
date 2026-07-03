import { getEnv } from "../env";
import { CloudflareProvider } from "./cloudflare";
import { PollinationsProvider } from "./pollinations";
import type { ImageProvider } from "./types";

export type { GenerateInput, GenerateOutput, ImageProvider } from "./types";

let cached: ImageProvider | null = null;

/** Picks the AI backend from IMAGE_PROVIDER (pollinations default, cloudflare fallback). */
export function getProvider(): ImageProvider {
  if (!cached) {
    cached = getEnv().IMAGE_PROVIDER === "cloudflare" ? new CloudflareProvider() : new PollinationsProvider();
  }
  return cached;
}
