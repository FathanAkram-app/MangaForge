-- MangaForge — gallery schema. One table is enough (see plan.md §4).
--
-- Apply locally:   psql "$DATABASE_URL" -f db/schema.sql
-- On Neon:         paste into the SQL editor, or run the same psql command.
--
-- Design notes:
--   * The row is the single source of truth for a generation's lifecycle, so a
--     browser refresh mid-generation "just works" and concurrent users stay isolated.
--   * status + error_code make the three required failure states first-class,
--     not a generic error string.
--   * params is JSONB so we can add manga knobs (genre, seed, size, character_ref)
--     without migrations.

-- gen_random_uuid() is built into PostgreSQL 13+ (no pgcrypto extension needed).

CREATE TABLE IF NOT EXISTS generations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      TEXT NOT NULL,                       -- signed httpOnly cookie → per-visitor gallery
  parent_id       UUID REFERENCES generations(id),     -- set when this row is a remix of another
  prompt          TEXT NOT NULL,                        -- the final prompt sent to the model
  params          JSONB NOT NULL DEFAULT '{}'::jsonb,   -- { model, seed, width, height, genre, color, character_ref, ... }
  status          TEXT NOT NULL DEFAULT 'queued'
                    CHECK (status IN ('queued','running','succeeded','failed')),
  image_key       TEXT,                                 -- storage key; NULL until succeeded
  error_code      TEXT
                    CHECK (error_code IN ('timeout','invalid_prompt','bad_response','unknown')),
  error_message   TEXT,                                 -- human-readable detail for the UI
  idempotency_key TEXT,                                 -- dedupe double-submits
  is_character    BOOLEAN NOT NULL DEFAULT false,        -- user saved this result as a reusable character
  character_label TEXT,                                 -- optional name for the saved character
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Gallery listing: newest-first, scoped to a visitor.
CREATE INDEX IF NOT EXISTS generations_session_created_idx
  ON generations (session_id, created_at DESC);

-- Idempotency: a retried/double-clicked submit returns the existing row
-- instead of creating a duplicate generation (and burning an API call).
CREATE UNIQUE INDEX IF NOT EXISTS generations_idempotency_idx
  ON generations (session_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
