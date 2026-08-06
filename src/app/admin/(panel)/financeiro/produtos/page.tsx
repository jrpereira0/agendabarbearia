import { redirect } from "next/navigation";

type PageProps = {
  searchParams: Promise<{ from?: string; to?: string }>;
};

/** Mantém o link antigo; a métrica vive em Métricas. */
export default async function FinanceProductsRedirectPage({
  searchParams,
}: PageProps) {
  const { from, to } = await searchParams;
  const params = new URLSearchParams({ metric: "produtos" });
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  redirect(`/admin/metricas?${params.toString()}`);
}
