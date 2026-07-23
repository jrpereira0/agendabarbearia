import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/require-owner";

export const dynamic = "force-dynamic";

/** Compatibilidade: YAML agora em /docs/api/openapi */
export async function GET(request: Request) {
  const denied = await requireOwner();
  if (denied && !denied.ok) {
    return NextResponse.json(
      { ok: false, error: denied.error },
      { status: 401 }
    );
  }

  const url = new URL(request.url);
  const target = new URL("/docs/api/openapi", url.origin);
  target.search = url.search;
  return NextResponse.redirect(target, 308);
}
