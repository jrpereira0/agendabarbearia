import { createAdminClient } from "@/lib/supabase/admin";

export type CustomerLookupResult =
  | { found: true; firstName: string; lastName: string }
  | { found: false };

export async function lookupCustomerByWhatsapp(
  whatsapp: string
): Promise<CustomerLookupResult> {
  const admin = createAdminClient();
  if (!admin) return { found: false };

  const { data, error } = await admin
    .from("customers")
    .select("first_name, last_name")
    .eq("whatsapp", whatsapp)
    .maybeSingle();

  if (error || !data) {
    return { found: false };
  }

  return {
    found: true,
    firstName: data.first_name,
    lastName: data.last_name,
  };
}
