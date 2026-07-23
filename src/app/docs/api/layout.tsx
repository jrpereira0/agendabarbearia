import type { Metadata } from "next";
import "@/styles/api-docs-theme.css";

export const metadata: Metadata = {
  title: "Documentação da API",
  robots: { index: false, follow: false },
};

/** Layout isolado — sem sidebar do painel admin. */
export default function ApiDocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
