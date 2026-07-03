import { after, NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { buildMangaPrompt, MANGA_FORMATS, validateSubject } from "@/lib/manga";
import { createGeneration, findByIdempotencyKey, getGeneration, listGenerations } from "@/lib/generations/repo";
import { toDTO, type CharacterRef, type GenerationParams } from "@/lib/generations/types";
import { GenerationError } from "@/lib/providers/errors";
import { getOrCreateSessionId } from "@/lib/session";
import { runGeneration } from "@/lib/generations/worker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60; // seconds — must exceed GENERATION_TIMEOUT_MS so after() can finish

const CreateSchema = z.object({
  subject: z.string(),
  genre: z.enum(["shonen", "shojo", "seinen"]),
  format: z.enum(["panel", "cover", "character"]),
  color: z.enum(["bw", "color"]),
  screentone: z.boolean().default(false),
  seed: z.number().int().nonnegative().optional(),
  parentId: z.string().min(1).optional(),
  characterId: z.string().min(1).optional(),
  idempotencyKey: z.string().min(1).optional(),
});

function randomSeed(): number {
  return Math.floor(Math.random() * 2_147_483_647);
}

/** Create a generation: validate, insert a queued row, schedule the job, return 202. */
export async function POST(request: NextRequest) {
  const sessionId = await getOrCreateSessionId();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request.", issues: parsed.error.issues }, { status: 400 });
  }
  const input = parsed.data;

  // Validate up front so an invalid prompt fails cleanly without an API call.
  try {
    validateSubject(input.subject);
  } catch (err) {
    const message = err instanceof GenerationError ? err.message : "Invalid prompt.";
    return NextResponse.json({ error: message, code: "invalid_prompt" }, { status: 422 });
  }

  // Idempotency: a retried/double-clicked submit returns the existing row.
  if (input.idempotencyKey) {
    const existing = await findByIdempotencyKey(sessionId, input.idempotencyKey);
    if (existing) return NextResponse.json(toDTO(existing), { status: 200 });
  }

  // "Consistent character": inherit the saved character's seed (best-effort).
  let characterRef: CharacterRef | undefined;
  if (input.characterId) {
    const character = await getGeneration(input.characterId, sessionId);
    if (character?.isCharacter) {
      characterRef = { fromId: character.id, seed: character.params.seed };
    }
  }

  const format = MANGA_FORMATS.find((f) => f.id === input.format) ?? MANGA_FORMATS[0];
  const seed = input.seed ?? characterRef?.seed ?? randomSeed();

  const params: GenerationParams = {
    subject: input.subject.trim(),
    genre: input.genre,
    format: input.format,
    color: input.color,
    screentone: input.screentone,
    seed,
    width: format.width,
    height: format.height,
    characterRef,
  };
  const prompt = buildMangaPrompt(input.subject, {
    genre: input.genre,
    format: input.format,
    color: input.color,
    screentone: input.screentone,
  });

  const generation = await createGeneration({
    sessionId,
    prompt,
    params,
    parentId: input.parentId ?? characterRef?.fromId ?? null,
    idempotencyKey: input.idempotencyKey ?? null,
  });

  // Run the 10–30s job AFTER responding. On a self-hosted Node server this is
  // tracked and drained on graceful shutdown (plan §4).
  after(async () => {
    await runGeneration(generation.id, sessionId);
  });

  return NextResponse.json(toDTO(generation), { status: 202 });
}

/** List this visitor's gallery, newest first. */
export async function GET() {
  const sessionId = await getOrCreateSessionId();
  const items = await listGenerations(sessionId);
  return NextResponse.json({ items: items.map(toDTO) });
}
