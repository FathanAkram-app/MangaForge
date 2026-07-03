import { query } from "../db";
import type { GenerationErrorCode } from "../providers/errors";
import type { Generation, GenerationParams, GenerationStatus } from "./types";

/** Raw DB shape (snake_case). pg parses JSONB and timestamptz for us. */
type Row = {
  id: string;
  session_id: string;
  parent_id: string | null;
  prompt: string;
  params: GenerationParams;
  status: GenerationStatus;
  image_key: string | null;
  error_code: GenerationErrorCode | null;
  error_message: string | null;
  is_character: boolean;
  character_label: string | null;
  created_at: Date;
  updated_at: Date;
};

function mapRow(r: Row): Generation {
  return {
    id: r.id,
    sessionId: r.session_id,
    parentId: r.parent_id,
    prompt: r.prompt,
    params: r.params,
    status: r.status,
    imageKey: r.image_key,
    errorCode: r.error_code,
    errorMessage: r.error_message,
    isCharacter: r.is_character,
    characterLabel: r.character_label,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  };
}

export async function createGeneration(input: {
  sessionId: string;
  prompt: string;
  params: GenerationParams;
  parentId?: string | null;
  idempotencyKey?: string | null;
}): Promise<Generation> {
  const rows = await query<Row>(
    `INSERT INTO generations (session_id, parent_id, prompt, params, idempotency_key, status)
     VALUES ($1, $2, $3, $4::jsonb, $5, 'queued')
     RETURNING *`,
    [input.sessionId, input.parentId ?? null, input.prompt, JSON.stringify(input.params), input.idempotencyKey ?? null],
  );
  return mapRow(rows[0]);
}

export async function findByIdempotencyKey(sessionId: string, key: string): Promise<Generation | null> {
  const rows = await query<Row>(
    `SELECT * FROM generations WHERE session_id = $1 AND idempotency_key = $2 LIMIT 1`,
    [sessionId, key],
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function getGeneration(id: string, sessionId: string): Promise<Generation | null> {
  const rows = await query<Row>(
    `SELECT * FROM generations WHERE id = $1 AND session_id = $2 LIMIT 1`,
    [id, sessionId],
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function listGenerations(sessionId: string, limit = 60): Promise<Generation[]> {
  const rows = await query<Row>(
    `SELECT * FROM generations WHERE session_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [sessionId, limit],
  );
  return rows.map(mapRow);
}

export async function markRunning(id: string): Promise<void> {
  await query(`UPDATE generations SET status = 'running', updated_at = now() WHERE id = $1 AND status = 'queued'`, [id]);
}

export async function markSucceeded(id: string, imageKey: string): Promise<void> {
  await query(
    `UPDATE generations SET status = 'succeeded', image_key = $2, updated_at = now() WHERE id = $1`,
    [id, imageKey],
  );
}

export async function markFailed(id: string, code: GenerationErrorCode, message: string): Promise<void> {
  await query(
    `UPDATE generations SET status = 'failed', error_code = $2, error_message = $3, updated_at = now() WHERE id = $1`,
    [id, code, message],
  );
}

export async function saveAsCharacter(id: string, sessionId: string, label: string): Promise<Generation | null> {
  const rows = await query<Row>(
    `UPDATE generations SET is_character = true, character_label = $3, updated_at = now()
     WHERE id = $1 AND session_id = $2 AND status = 'succeeded'
     RETURNING *`,
    [id, sessionId, label],
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

/**
 * Reset a FAILED generation back to 'queued' so it can be re-run in place
 * (no new row). Returns null if the row isn't found or isn't retryable.
 */
export async function resetForRetry(id: string, sessionId: string): Promise<Generation | null> {
  const rows = await query<Row>(
    `UPDATE generations
       SET status = 'queued', error_code = NULL, error_message = NULL, image_key = NULL, updated_at = now()
     WHERE id = $1 AND session_id = $2 AND status = 'failed'
     RETURNING *`,
    [id, sessionId],
  );
  return rows[0] ? mapRow(rows[0]) : null;
}
