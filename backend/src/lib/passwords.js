import { timingSafeEqual } from "node:crypto";

const ALGORITHM = "PBKDF2";
const DIGEST = "SHA-256";
const ITERATIONS = 100_000;
const KEY_BYTES = 32;
const encoder = new TextEncoder();

async function derive(password, salt, iterations) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), ALGORITHM, false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: ALGORITHM, hash: DIGEST, salt, iterations }, key, KEY_BYTES * 8);
  return new Uint8Array(bits);
}

export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(password, salt, ITERATIONS);
  return `pbkdf2-sha256$${ITERATIONS}$${Buffer.from(salt).toString("base64")}$${Buffer.from(hash).toString("base64")}`;
}

export async function verifyPassword(password, encoded) {
  const [scheme, iterationsText, saltText, hashText] = String(encoded || "").split("$");
  const iterations = Number(iterationsText);
  if (scheme !== "pbkdf2-sha256" || !Number.isInteger(iterations) || iterations < 1 || !saltText || !hashText) return false;
  const expected = Buffer.from(hashText, "base64");
  const actual = Buffer.from(await derive(password, Buffer.from(saltText, "base64"), iterations));
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
