import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { requireOwner } from "@/lib/require-owner";

export const dynamic = "force-dynamic";

/** Spec OpenAPI — só o dono (sessão do painel). */
export async function GET(request: Request) {
  const denied = await requireOwner();
  if (denied && !denied.ok) {
    return NextResponse.json(
      { ok: false, error: denied.error },
      { status: 401 }
    );
  }

  const filePath = path.join(process.cwd(), "docs", "openapi", "v1.yaml");
  let yaml: string;
  try {
    yaml = await readFile(filePath, "utf8");
  } catch {
    return NextResponse.json(
      { ok: false, error: "Documentação indisponível no momento." },
      { status: 503 }
    );
  }

  const download =
    new URL(request.url).searchParams.get("download") === "1";

  return new NextResponse(yaml, {
    headers: {
      "Content-Type": "application/yaml; charset=utf-8",
      "Cache-Control": "private, no-store",
      ...(download
        ? {
            "Content-Disposition":
              'attachment; filename="agenda-barbearia-openapi-v1.yaml"',
          }
        : {}),
    },
  });
}
