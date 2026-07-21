import { redirect } from "next/navigation";
import { LOGIN_PATH } from "@/lib/login-path";

export const dynamic = "force-dynamic";

/** A raiz redireciona para o login do painel. */
export default function HomePage() {
  redirect(LOGIN_PATH);
}
