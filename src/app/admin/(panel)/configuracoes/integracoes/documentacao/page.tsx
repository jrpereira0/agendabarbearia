import { redirect } from "next/navigation";
import { assertOwnerSettingsPage } from "@/lib/require-owner";

/** Mantém o link antigo; a docs vive em tela própria. */
export default async function ApiDocumentationRedirectPage() {
  await assertOwnerSettingsPage();
  redirect("/docs/api");
}
