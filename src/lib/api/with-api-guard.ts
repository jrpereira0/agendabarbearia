import { NextResponse } from "next/server";
import type { ApiScope } from "@/lib/api-key-scopes";
import { resolveApiAuth, type ResolvedApiAuth } from "@/lib/api-key-auth";
import { enforcePublicApiRateLimit, type PublicApiRateLimitBucket } from "@/lib/rate-limit";

type GuardedHandler = (context: {
  auth: ResolvedApiAuth;
}) => Promise<NextResponse>;

type ApiRouteGuardOptions = {
  scope: ApiScope;
  rateLimit: PublicApiRateLimitBucket;
  rateLimitKeySuffix?: (auth: ResolvedApiAuth) => string | undefined;
};

export async function withApiRouteGuard(
  request: Request,
  options: ApiRouteGuardOptions,
  handler: GuardedHandler
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
