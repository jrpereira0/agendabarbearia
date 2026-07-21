import { NextResponse } from "next/server";
import { apiForbiddenResponse } from "@/lib/api-key-auth";
import type { ProtectedApiAuthContext } from "@/lib/protected-api-auth";

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
