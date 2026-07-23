import { NextRequest } from "next/server";
import { safeApiRoute } from "@/lib/api/safe-route";
import { handleAvailabilityGet } from "@/lib/api/handle-availability-get";

/**
 * GET /api/v1/appointments/availability — horários livres.
 * Público. Scope opcional: availability:read.
 */
export async function GET(request: NextRequest) {
  return safeApiRoute(() => handleAvailabilityGet(request));
}
