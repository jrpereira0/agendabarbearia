"use server";

import { redirect } from "next/navigation";
import { LOGIN_PATH } from "@/lib/login-path";
import { requireServerClient } from "@/lib/supabase/server";

export async function signOut() {
  const supabase = await requireServerClient();
  await supabase.auth.signOut();
  redirect(LOGIN_PATH);
}
