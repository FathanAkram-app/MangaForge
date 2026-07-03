import { cookies } from "next/headers";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { getEnv } from "./env";

/**
 * Anonymous per-visitor identity. We store a random id in a signed, httpOnly
 * cookie so each browser gets its own private gallery — no accounts needed
 * (plan §11). Next does NOT sign cookies for us, so we HMAC the value ourselves
 * and reject any tampered cookie.
 */
const COOKIE_NAME = "mf_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 365; // 1 year

function sign(value: string): string {
  const mac = createHmac("sha256", getEnv().SESSION_SECRET).update(value).digest("base64url");
  return `${value}.${mac}`;
}

function verify(signed: string | undefined): string | null {
  if (!signed) return null;
  const dot = signed.lastIndexOf(".");
  if (dot <= 0) return null;
  const value = signed.slice(0, dot);
  const expected = sign(value);
  const a = Buffer.from(signed);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  return timingSafeEqual(a, b) ? value : null;
}

/**
 * Returns the caller's session id, creating and setting the cookie on first
 * visit. Must be called from a Route Handler (it may set a cookie).
 */
export async function getOrCreateSessionId(): Promise<string> {
  const store = await cookies();
  const existing = verify(store.get(COOKIE_NAME)?.value);
  if (existing) return existing;

  const id = randomUUID();
  store.set(COOKIE_NAME, sign(id), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: MAX_AGE_SECONDS,
    path: "/",
  });
  return id;
}
