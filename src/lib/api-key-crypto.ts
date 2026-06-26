import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);

export const API_KEY_BRAND = "dbc_live";
const KEY_ID_BYTES = 6;
const SECRET_BYTES = 32;
const SCRYPT_KEY_LEN = 64;

const TOKEN_PATTERN = /^dbc_live_([a-z0-9]{12})_([A-Za-z0-9_-]{43,})$/;

export type GeneratedApiKey = {
  keyId: string;
  keyPrefix: string;
  secret: string;
  fullKey: string;
};

export function generateKeyId(): string {
  return randomBytes(KEY_ID_BYTES).toString("hex");
}

export function generateSecret(): string {
  return randomBytes(SECRET_BYTES)
    .toString("base64url")
    .slice(0, 43);
}

export function buildKeyPrefix(keyId: string): string {
  return `${API_KEY_BRAND}_${keyId}`;
}

export function buildFullApiKey(keyId: string, secret: string): string {
  return `${buildKeyPrefix(keyId)}_${secret}`;
}

export function generateApiKeyMaterial(): GeneratedApiKey {
  const keyId = generateKeyId();
  const secret = generateSecret();
  const keyPrefix = buildKeyPrefix(keyId);
  return {
    keyId,
    keyPrefix,
    secret,
    fullKey: buildFullApiKey(keyId, secret),
  };
}

export function parseBearerApiKey(
  authorization: string | null
): { keyPrefix: string; secret: string } | null {
  if (!authorization?.startsWith("Bearer ")) return null;
  const token = authorization.slice("Bearer ".length).trim();
  if (!token) return null;

  const match = TOKEN_PATTERN.exec(token);
  if (!match) return null;

  const [, keyId, secret] = match;
  return {
    keyPrefix: buildKeyPrefix(keyId),
    secret,
  };
}

export async function hashApiKeySecret(secret: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = (await scryptAsync(secret, salt, SCRYPT_KEY_LEN)) as Buffer;
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

export async function verifyApiKeySecret(
  secret: string,
  stored: string
): Promise<boolean> {
  const parts = stored.split(":");
  if (parts.length !== 2) return false;

  const [saltHex, hashHex] = parts;
  if (!/^[0-9a-f]+$/i.test(saltHex) || !/^[0-9a-f]+$/i.test(hashHex)) {
    return false;
  }

  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(hashHex, "hex");
  if (expected.length !== SCRYPT_KEY_LEN) return false;

  const actual = (await scryptAsync(secret, salt, SCRYPT_KEY_LEN)) as Buffer;
  if (actual.length !== expected.length) return false;

  return timingSafeEqual(actual, expected);
}
