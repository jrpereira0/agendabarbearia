import { NextResponse } from "next/server";
import type { ApiScope } from "@/lib/api-key-scopes";
import { resolveApiAuth, type ResolvedApiAuth } from "@/lib/api-key-auth";
import {
  protectedAuthRateLimitKey,
  resolveProtectedApiAuth,
  type ProtectedApiAuthContext,
} from "@/lib/protected-api-auth";
import {
  enforcePublicApiRateLimit,
  type PublicApiRateLimitBucket,
} from "@/lib/rate-limit";

type PublicHandler = (context: {
  auth: ResolvedApiAuth;
}) => Promise<NextResponse>;

type ProtectedHandler = (context: {
  auth: ProtectedApiAuthContext;
}) => Promise<NextResponse>;

type PublicGuardOptions = {
  scope: ApiScope;
  rateLimit: PublicApiRateLimitBucket;
  rateLimitKeySuffix?: (auth: ResolvedApiAuth) => string | undefined;
};

type ProtectedGuardOptions = {
  scope: ApiScope;
  rateLimit: PublicApiRateLimitBucket;
  whatsapp?: string | null;
};

export async function withPublicApiRouteGuard(
  request: Request,
  options: PublicGuardOptions,
  handler: PublicHandler
): Promise<NextResponse> {
  const authResult = await resolveApiAuth(request, options.scope);
  if (!authResult.ok) {
    return authResult.response;
  }

  const bucket =
    authResult.auth.type === "api_key" ? "apiKey" : options.rateLimit;

  const keySuffix =
    authResult.auth.type === "api_key"
      ? authResult.auth.keyUuid
      : options.rateLimitKeySuffix?.(authResult.auth);

  const limited = enforcePublicApiRateLimit(request, bucket, keySuffix);
  if (limited) return limited;

  return handler({ auth: authResult.auth });
}

export async function withProtectedApiRouteGuard(
  request: Request,
  options: ProtectedGuardOptions,
  handler: ProtectedHandler
): Promise<NextResponse> {
  const authResult = await resolveProtectedApiAuth(request, options.scope, {
    whatsapp: options.whatsapp,
  });
  if (!authResult.ok) {
    return authResult.response;
  }

  const bucket =
    authResult.auth.type === "api_key" ? "apiKey" : options.rateLimit;

  const limited = enforcePublicApiRateLimit(
    request,
    bucket,
    protectedAuthRateLimitKey(authResult.auth)
  );
  if (limited) return limited;

  return handler({ auth: authResult.auth });
}
