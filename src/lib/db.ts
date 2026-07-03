import { Pool, type QueryResultRow } from "pg";
import { getEnv } from "./env";

/**
 * A single shared connection pool. Cached on globalThis so Next.js dev HMR
 * (which re-evaluates modules) doesn't leak a new pool on every reload.
 */
const globalForPg = globalThis as unknown as { _mfPool?: Pool };

function shouldUseSsl(url: string): boolean {
  // Managed Postgres (Neon, etc.) needs TLS; a local dev DB does not.
  if (/sslmode=disable/.test(url)) return false;
  return !/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(url);
}

export function getPool(): Pool {
  if (!globalForPg._mfPool) {
    const url = getEnv().DATABASE_URL;
    globalForPg._mfPool = new Pool({
      connectionString: url,
      max: 10,
      ssl: shouldUseSsl(url) ? { rejectUnauthorized: false } : undefined,
    });
  }
  return globalForPg._mfPool;
}

/**
 * Run a parameterized query and return the rows. Connections are acquired and
 * released per call, so we never hold one across the slow AI request (plan §5).
 */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  values: unknown[] = [],
): Promise<T[]> {
  const result = await getPool().query<T>(text, values);
  return result.rows;
}
