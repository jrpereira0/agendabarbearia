"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { loginUrl } from "@/lib/login-path";

export async function login(formData: FormData) {
  if (!isSupabaseConfigured()) {
    redirect(loginUrl("config"));
  }

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    redirect(loginUrl("campos"));
  }

  const supabase = await createClient();
  if (!supabase) redirect(loginUrl("config"));

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    redirect(loginUrl("credenciais"));
  }

  redirect("/admin");
}
