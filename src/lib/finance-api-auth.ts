import { NextResponse } from "next/server";
import type { ApiScope } from "@/lib/api-key-scopes";
import {
  apiForbiddenResponse,
  apiUnauthorizedResponse,
} from "@/lib/api-key-auth";
import {
  resolveProtectedApiAuth,
  type ProtectedApiAuthContext,
} from "@/lib/protected-api-auth";

export async function resolveFinanceApiAuth(
  request: Request,
  requiredScope: ApiScope,
  options: { ownerOnly?: boolean } = {}
): Promise<
  | { ok: true; auth: ProtectedApiAuthContext }
  | { ok: false; response: NextResponse }
> {
  const authResult = await resolveProtectedApiAuth(request, requiredScope);
  if (!authResult.ok) {
    return authResult;
  }

  if (options.ownerOnly) {
    if (authResult.auth.type === "admin" && authResult.auth.role !== "owner") {
      return { ok: false, response: apiForbiddenResponse() };
    }
  }

  return authResult;
}

export function financeForbiddenForBarberWrite(
  auth: ProtectedApiAuthContext
): NextResponse | null {
  if (auth.type === "admin" && auth.role !== "owner") {
    return apiForbiddenResponse();
  }
  return null;
}

export function apiErrorResponse(
  error: string,
  status: number
): NextResponse {
  return NextResponse.json({ ok: false, error }, { status });
}

export function apiSuccessResponse<T extends Record<string, unknown>>(
  data: T,
  status = 200
): NextResponse {
  return NextResponse.json({ ok: true, ...data }, { status });
}
