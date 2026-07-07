import { BRAND_NAME } from "@/lib/brand";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

const DEFAULT_SEO = {
  name: BRAND_NAME,
  description: `Agende seu horário na ${BRAND_NAME}.`,
};

export async function getShopSeo() {
  if (!isSupabaseConfigured()) {
    return DEFAULT_SEO;
  }

  try {
    const supabase = await createClient();
    if (!supabase) return DEFAULT_SEO;

    const { data } = await supabase
      .from("shop_settings")
      .select("shop_name, bio")
      .single();

    const name = data?.shop_name?.trim() || DEFAULT_SEO.name;
    const bio = data?.bio?.trim() ?? "";

    return {
      name,
      description: bio || `Agende seu horário na ${name}.`,
    };
  } catch {
    return DEFAULT_SEO;
  }
}
