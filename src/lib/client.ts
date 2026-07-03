import type { GenerationDTO } from "./generations/types";
import type { MangaColor, MangaFormat, MangaGenre } from "./manga";

/**
 * Thin, typed wrappers around the backend API for the browser. Kept separate
 * from the UI so the fetch/shape logic is easy to read and reuse.
 */

export type CreateInput = {
  subject: string;
  genre: MangaGenre;
  format: MangaFormat;
  color: MangaColor;
  screentone: boolean;
  seed?: number;
  parentId?: string;
  characterId?: string;
  idempotencyKey: string;
};

/** Thrown when the backend rejects a create request (e.g. an invalid prompt). */
export class CreateError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = "CreateError";
  }
}

export async function fetchGallery(): Promise<GenerationDTO[]> {
  const res = await fetch("/api/generations", { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load gallery.");
  const data = (await res.json()) as { items: GenerationDTO[] };
  return data.items;
}

export async function createGeneration(input: CreateInput): Promise<GenerationDTO> {
  const res = await fetch("/api/generations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = (await res.json().catch(() => ({}))) as GenerationDTO & { error?: string; code?: string };
  if (!res.ok) {
    throw new CreateError(data.error ?? "Could not start the generation.", data.code ?? "unknown");
  }
  return data;
}

export async function pollGeneration(id: string): Promise<GenerationDTO> {
  const res = await fetch(`/api/generations/${id}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to poll generation.");
  return (await res.json()) as GenerationDTO;
}

export async function saveAsCharacter(id: string, characterLabel: string): Promise<GenerationDTO> {
  const res = await fetch(`/api/generations/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ characterLabel }),
  });
  if (!res.ok) throw new Error("Failed to save character.");
  return (await res.json()) as GenerationDTO;
}

/** Retry a failed generation in place — re-runs the same row (no duplicate). */
export async function retryGeneration(id: string): Promise<GenerationDTO> {
  const res = await fetch(`/api/generations/${id}`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to retry generation.");
  return (await res.json()) as GenerationDTO;
}
