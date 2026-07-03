import { invalidPromptError } from "./providers/errors";

/**
 * The niche. These presets shape the product: instead of a bare prompt box, the
 * user picks manga-native options and we assemble a proper prompt server-side.
 * The arrays are also imported by the UI to render the controls.
 */
export const MANGA_GENRES = [
  { id: "shonen", label: "Shōnen" },
  { id: "shojo", label: "Shōjo" },
  { id: "seinen", label: "Seinen" },
] as const;
export type MangaGenre = (typeof MANGA_GENRES)[number]["id"];

export const MANGA_FORMATS = [
  { id: "panel", label: "Single panel", width: 1024, height: 1024 },
  { id: "cover", label: "Cover", width: 832, height: 1216 },
  { id: "character", label: "Character sheet", width: 1216, height: 832 },
] as const;
export type MangaFormat = (typeof MANGA_FORMATS)[number]["id"];

export const MANGA_COLORS = [
  { id: "bw", label: "Black & white" },
  { id: "color", label: "Color" },
] as const;
export type MangaColor = (typeof MANGA_COLORS)[number]["id"];

const GENRE_STYLE: Record<MangaGenre, string> = {
  shonen: "shonen manga style, dynamic action lines, bold confident inking, high energy",
  shojo: "shojo manga style, delicate linework, soft screentone shading, romantic mood, sparkles",
  seinen: "seinen manga style, detailed realistic rendering, cinematic lighting, mature tone",
};

const FORMAT_STYLE: Record<MangaFormat, string> = {
  panel: "single manga panel composition",
  cover: "manga volume cover, dramatic hero composition with room for a title",
  character: "manga character reference sheet, full body, neutral background",
};

export type MangaOptions = {
  genre: MangaGenre;
  format: MangaFormat;
  color: MangaColor;
  screentone: boolean;
};

/** Turns the user's scene description + manga options into the final prompt. */
export function buildMangaPrompt(subject: string, o: MangaOptions): string {
  return [
    GENRE_STYLE[o.genre],
    FORMAT_STYLE[o.format],
    o.color === "bw" ? "black and white, ink on paper" : "full color",
    o.screentone ? "screentone shading, halftone dots" : "",
    "clean line art, professional manga illustration",
    subject.trim(),
  ]
    .filter(Boolean)
    .join(", ");
}

// A deliberately tiny illustrative moderation list. Real apps use a proper
// moderation service; this is enough to demonstrate the "invalid prompt" state
// on the free path without a paid provider (plan §11).
const BLOCKED = [/\bnsfw\b/i, /\bgore\b/i, /\bexplicit\b/i];

/** Validates the raw scene text. Throws GenerationError('invalid_prompt') on failure. */
export function validateSubject(subject: string): void {
  const s = subject.trim();
  if (s.length < 3) throw invalidPromptError("Describe your scene in a few words (at least 3 characters).");
  if (s.length > 500) throw invalidPromptError("That prompt is too long (max 500 characters).");
  if (BLOCKED.some((re) => re.test(s))) {
    throw invalidPromptError("This prompt was blocked by the content filter. Try a different scene.");
  }
}
