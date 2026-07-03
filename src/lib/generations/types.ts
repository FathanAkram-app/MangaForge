import type { MangaColor, MangaFormat, MangaGenre } from "../manga";
import type { GenerationErrorCode } from "../providers/errors";

export type { GenerationErrorCode } from "../providers/errors";

export type GenerationStatus = "queued" | "running" | "succeeded" | "failed";

/** Lineage of a "consistent character" reuse — carries the saved seed. */
export type CharacterRef = { fromId: string; seed: number };

/** Everything needed to reproduce a generation, stored as JSONB in `params`. */
export type GenerationParams = {
  subject: string; // the raw user text (used to pre-fill the composer on remix)
  genre: MangaGenre;
  format: MangaFormat;
  color: MangaColor;
  screentone: boolean;
  seed: number;
  width?: number;
  height?: number;
  model?: string;
  characterRef?: CharacterRef;
};

/** A row of the `generations` table. */
export type Generation = {
  id: string;
  sessionId: string;
  parentId: string | null;
  prompt: string;
  params: GenerationParams;
  status: GenerationStatus;
  imageKey: string | null;
  errorCode: GenerationErrorCode | null;
  errorMessage: string | null;
  isCharacter: boolean;
  characterLabel: string | null;
  createdAt: string;
  updatedAt: string;
};

/** What the client sees: no storage key / session id; a ready-to-use image URL. */
export type GenerationDTO = {
  id: string;
  parentId: string | null;
  prompt: string;
  params: GenerationParams;
  status: GenerationStatus;
  errorCode: GenerationErrorCode | null;
  errorMessage: string | null;
  isCharacter: boolean;
  characterLabel: string | null;
  createdAt: string;
  updatedAt: string;
  imageUrl: string | null;
};

export function toDTO(g: Generation): GenerationDTO {
  return {
    id: g.id,
    parentId: g.parentId,
    prompt: g.prompt,
    params: g.params,
    status: g.status,
    errorCode: g.errorCode,
    errorMessage: g.errorMessage,
    isCharacter: g.isCharacter,
    characterLabel: g.characterLabel,
    createdAt: g.createdAt,
    updatedAt: g.updatedAt,
    imageUrl: g.status === "succeeded" ? `/api/images/${g.id}` : null,
  };
}
