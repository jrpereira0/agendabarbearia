import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabasePublicEnv } from "@/lib/supabase/env";
import { LOGIN_PATH } from "@/lib/login-path";

function isLoginPage(pathname: string): boolean {
  return pathname === LOGIN_PATH;
}

// Mantém a sessão do Supabase atualizada e protege as rotas /admin.
export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAdminRoute = pathname.startsWith("/admin");
  const loginPage = isLoginPage(pathname);

  try {
    const env = getSupabasePublicEnv();

    if (!env) {
      if (isAdminRoute && !loginPage) {
        return NextResponse.redirect(new URL(LOGIN_PATH, request.url));
      }
      return NextResponse.next({ request });
    }

    let supabaseResponse = NextResponse.next({ request });

    const supabase = createServerClient(env.url, env.anonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    });

    // Importante: não remover. Renova o token da sessão quando expira.
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (isAdminRoute && !loginPage && !user) {
      return NextResponse.redirect(new URL(LOGIN_PATH, request.url));
    }

    if (loginPage && user) {
      return NextResponse.redirect(new URL("/admin", request.url));
    }

    return supabaseResponse;
  } catch {
    if (isAdminRoute && !loginPage) {
      return NextResponse.redirect(new URL(LOGIN_PATH, request.url));
    }
    return NextResponse.next({ request });
  }
}
