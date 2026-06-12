import { NextResponse } from "next/server";

const UNAVAILABLE = NextResponse.json(
  { error: "Sistema indisponível no momento. Tente de novo em instantes." },
  { status: 503 }
);

export async function safeApiRoute(
  handler: () => Promise<NextResponse>
): Promise<NextResponse> {
  try {
    return await handler();
  } catch {
    return UNAVAILABLE;
  }
}
