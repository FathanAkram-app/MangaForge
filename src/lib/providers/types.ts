import type { GenerationParams } from "../generations/types";

export type GenerateInput = {
  /** The final, manga-scaffolded prompt (see manga.ts buildMangaPrompt). */
  prompt: string;
  params: GenerationParams;
  /** Aborted when GENERATION_TIMEOUT_MS elapses → provider throws a timeout. */
  signal: AbortSignal;
};

export type GenerateOutput = {
  bytes: Buffer;
  contentType: string;
  /** File extension incl. dot, e.g. ".png" — used to build the storage key. */
  extension: string;
};

/** A swappable AI image backend. Selected at runtime by IMAGE_PROVIDER. */
export interface ImageProvider {
  readonly name: string;
  generate(input: GenerateInput): Promise<GenerateOutput>;
}
