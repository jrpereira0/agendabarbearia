import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { normalizeWhatsapp } from "@/lib/whatsapp";

export const CLIENT_SESSION_COOKIE = "agenda_client_session";
const SESSION_TTL_MS = 4 * 60 * 60 * 1000; // 4 horas

export type ClientSessionPayload = {
  whatsapp: string;
  exp: number;
};

function getSessionSecret(): string | null {
  const secret = process.env.CLIENT_SESSION_SECRET?.trim();
  if (secret && secret.length >= 32) return secret;

  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (serviceRole && serviceRole.length >= 32) {
    return createHmac("sha256", "agenda-client-session")
      .update(serviceRole)
      .digest("hex");
  }

  return null;
}

function signPayload(payload: string): string {
  const secret = getSessionSecret();
  if (!secret) {
    throw new Error("CLIENT_SESSION_SECRET indisponível.");
  }
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createClientSessionToken(whatsapp: string): string | null {
  const normalized = normalizeWhatsapp(whatsapp);
  if (!normalized) return null;

  const payload: ClientSessionPayload = {
    whatsapp: normalized,
    exp: Date.now() + SESSION_TTL_MS,
  };

  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${signPayload(encoded)}`;
}

export function verifyClientSessionToken(
  token: string | undefined | null
): ClientSessionPayload | null {
  if (!token) return null;

  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [encoded, signature] = parts;
  if (!encoded || !signature) return null;

  let expected: string;
  try {
    expected = signPayload(encoded);
  } catch {
    return null;
  }

  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8")
    ) as ClientSessionPayload;

    if (
      typeof payload.whatsapp !== "string" ||
      typeof payload.exp !== "number" ||
      !normalizeWhatsapp(payload.whatsapp)
    ) {
      return null;
    }

    if (payload.exp <= Date.now()) return null;

    return {
      whatsapp: normalizeWhatsapp(payload.whatsapp)!,
      exp: payload.exp,
    };
  } catch {
    return null;
  }
}

export function getClientSessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  };
}

export async function readClientSessionFromCookies(): Promise<ClientSessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(CLIENT_SESSION_COOKIE)?.value;
  return verifyClientSessionToken(token);
}

export function readClientSessionFromRequest(
  request: Request
): ClientSessionPayload | null {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return null;

  const match = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${CLIENT_SESSION_COOKIE}=`));

  if (!match) return null;

  const token = decodeURIComponent(match.slice(CLIENT_SESSION_COOKIE.length + 1));
  return verifyClientSessionToken(token);
}

export function createCsrfToken(): string {
  return randomBytes(16).toString("base64url");
}
