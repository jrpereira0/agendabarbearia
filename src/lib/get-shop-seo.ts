import { BRAND_ICON_PATH, BRAND_NAME } from "@/lib/brand";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

const SHARE_DESCRIPTION_MAX = 140;

const DEFAULT_SEO = {
  name: BRAND_NAME,
  description: `Agende seu horário na ${BRAND_NAME}.`,
  shareDescription:
    "Agende online: escolha o barbeiro, o serviço e o horário.",
  logoUrl: BRAND_ICON_PATH,
};

function truncateShareText(value: string, max = SHARE_DESCRIPTION_MAX): string {
  const text = value.replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1).replace(/\s+\S*$/, "").trimEnd();
  return `${cut || text.slice(0, max - 1)}…`;
}

function buildShareDescription(bio: string): string {
  if (!bio) return DEFAULT_SEO.shareDescription;
  return truncateShareText(bio);
}

export type ShopSeo = {
  name: string;
  /** Meta description geral (pode ser a bio completa). */
  description: string;
  /** Texto curto para prévia no WhatsApp / Open Graph. */
  shareDescription: string;
  logoUrl: string;
};

export async function getShopSeo(): Promise<ShopSeo> {
  if (!isSupabaseConfigured()) {
    return DEFAULT_SEO;
  }

  try {
    const supabase = await createClient();
    if (!supabase) return DEFAULT_SEO;

    const { data } = await supabase
      .from("shop_settings")
      .select("shop_name, bio, logo_url")
      .single();

    const name = data?.shop_name?.trim() || DEFAULT_SEO.name;
    const bio = data?.bio?.trim() ?? "";
    const logoUrl = data?.logo_url?.trim() || BRAND_ICON_PATH;

    return {
      name,
      description: bio || `Agende seu horário na ${name}.`,
      shareDescription: buildShareDescription(bio),
      logoUrl,
    };
  } catch {
    return DEFAULT_SEO;
  }
}
