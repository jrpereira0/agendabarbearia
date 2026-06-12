import type { ActionResult } from "@/lib/require-owner";

export type AdminClientUnavailable = Extract<ActionResult, { ok: false }>;

export function isActionResult(
  value: unknown
): value is AdminClientUnavailable {
  return (
    typeof value === "object" &&
    value !== null &&
    "ok" in value &&
    (value as ActionResult).ok === false
  );
}
