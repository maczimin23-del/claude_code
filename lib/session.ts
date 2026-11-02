import { cookies } from "next/headers";

export const ADMIN_COOKIE_NAME = "jb_admin";
const MAX_AGE_SECONDS = 60 * 60 * 12; // 12h

// Web Crypto (crypto.subtle) is used instead of node:crypto so this same
// code runs unchanged in both server actions (Node runtime) and
// middleware.ts (Edge runtime) — Edge has no access to node:crypto.

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) {
    throw new Error("SESSION_SECRET is missing or too short — set it in your environment.");
  }
  return s;
}

async function hmacHex(payload: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function createAdminSession() {
  const issuedAt = Date.now().toString();
  const token = `${issuedAt}.${await hmacHex(issuedAt)}`;
  const store = await cookies();
  store.set(ADMIN_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: MAX_AGE_SECONDS,
    path: "/",
  });
}

export async function destroyAdminSession() {
  const store = await cookies();
  store.delete(ADMIN_COOKIE_NAME);
}

/** Verifies a raw cookie value. Safe to call from middleware (Edge) or server code (Node). */
export async function verifyAdminToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const [issuedAt, sig] = token.split(".");
  if (!issuedAt || !sig) return false;
  const expected = await hmacHex(issuedAt);
  if (sig.length !== expected.length) return false;
  // constant-time compare without node:crypto
  let diff = 0;
  for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
  if (diff !== 0) return false;
  const age = Date.now() - Number(issuedAt);
  return age >= 0 && age <= MAX_AGE_SECONDS * 1000;
}

export async function hasValidAdminSession(): Promise<boolean> {
  const store = await cookies();
  return verifyAdminToken(store.get(ADMIN_COOKIE_NAME)?.value);
}
