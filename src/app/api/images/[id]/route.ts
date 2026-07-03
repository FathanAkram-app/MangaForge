import { getGeneration } from "@/lib/generations/repo";
import { getStorage } from "@/lib/storage";
import { getOrCreateSessionId } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Serve the stored image bytes for one generation. Scoped to the caller's
 * session so images stay private, and it hides whether storage is disk or R2.
 */
export async function GET(_request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const sessionId = await getOrCreateSessionId();

  const g = await getGeneration(id, sessionId);
  if (!g || !g.imageKey) return new Response("Not found", { status: 404 });

  const stored = await getStorage().get(g.imageKey);
  if (!stored) return new Response("Not found", { status: 404 });

  // Buffer is a Uint8Array, but its ArrayBufferLike generic doesn't satisfy the
  // Response BodyInit type under TS 5.7; normalize to a plain Uint8Array.
  return new Response(Uint8Array.from(stored.bytes), {
    status: 200,
    headers: {
      "Content-Type": stored.contentType,
      // Bytes for a given id never change, so allow long private caching.
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
