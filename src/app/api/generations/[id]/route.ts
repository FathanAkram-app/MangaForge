import { NextResponse } from "next/server";
import { getGeneration, saveAsCharacter } from "@/lib/generations/repo";
import { toDTO } from "@/lib/generations/types";
import { getOrCreateSessionId } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Poll one generation (the client calls this every ~1.5s until terminal). */
export async function GET(_request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const sessionId = await getOrCreateSessionId();
  const g = await getGeneration(id, sessionId);
  if (!g) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json(toDTO(g));
}

/** Save a succeeded generation as a reusable character (label required). */
export async function PATCH(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const sessionId = await getOrCreateSessionId();

  const body = (await request.json().catch(() => null)) as { characterLabel?: unknown } | null;
  const label = typeof body?.characterLabel === "string" ? body.characterLabel.trim() : "";
  if (!label) return NextResponse.json({ error: "characterLabel is required." }, { status: 400 });

  const updated = await saveAsCharacter(id, sessionId, label);
  if (!updated) return NextResponse.json({ error: "Not found or not ready." }, { status: 404 });
  return NextResponse.json(toDTO(updated));
}
