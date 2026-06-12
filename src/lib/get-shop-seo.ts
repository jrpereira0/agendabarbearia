import { createClient } from "@/lib/supabase/server";

export async function getShopSeo() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("shop_settings")
    .select("shop_name, bio")
    .single();

  const name = data?.shop_name?.trim() || "Barbearia";
  const bio = data?.bio?.trim() ?? "";

  return {
    name,
    description: bio || `Agende seu horário na ${name}.`,
  };
}
