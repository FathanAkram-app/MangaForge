// One-shot, idempotent database migration: applies db/schema.sql to DATABASE_URL.
//
// Wired to run automatically before the server starts (the npm "prestart" hook),
// so a fresh deploy provisions its own schema with no manual step — and it's safe
// to re-run because every statement uses IF NOT EXISTS. Also runnable by hand:
//   npm run db:migrate

import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// @next/env and pg are CommonJS; require() avoids ESM/CJS interop surprises.
const require = createRequire(import.meta.url);
const { loadEnvConfig } = require("@next/env");
const { Client } = require("pg");

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// Load .env* the same way Next does — so this works locally (.env.local) and in
// production, where real environment variables take precedence over any file.
loadEnvConfig(root);

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("[migrate] DATABASE_URL is not set — cannot migrate.");
  process.exit(1);
}

// Managed Postgres (Railway, Neon) needs TLS; a local dev DB does not.
function needsSsl(url) {
  if (/sslmode=disable/.test(url)) return false;
  return !/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(url);
}

const sql = await readFile(join(root, "db", "schema.sql"), "utf8");

const client = new Client({
  connectionString,
  ssl: needsSsl(connectionString) ? { rejectUnauthorized: false } : undefined,
});

try {
  await client.connect();
  await client.query(sql);
  console.log("[migrate] schema applied ✓");
} catch (err) {
  console.error("[migrate] failed:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  await client.end();
}
