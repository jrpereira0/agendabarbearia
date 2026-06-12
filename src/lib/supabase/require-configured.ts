import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export function redirectIfSupabaseMissing(
  loginPath = "/admin/login"
): void {
  if (!isSupabaseConfigured()) {
    redirect(loginPath);
  }
}
