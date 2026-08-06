import type { NextConfig } from "next";

function getSupabaseImagePatterns(): NonNullable<
  NextConfig["images"]
>["remotePatterns"] {
  const patterns: NonNullable<NextConfig["images"]>["remotePatterns"] = [
    {
      protocol: "https",
      hostname: "*.supabase.co",
      pathname: "/storage/v1/object/public/**",
    },
  ];

  const supabaseUrl =
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (supabaseUrl) {
    try {
      const hostname = new URL(supabaseUrl).hostname;
      if (!patterns.some((pattern) => pattern.hostname === hostname)) {
        patterns.unshift({
          protocol: "https",
          hostname,
          pathname: "/storage/v1/object/public/**",
        });
      }
    } catch {
      // URL inválida no .env — o padrão *.supabase.co cobre o caso comum.
    }
  }

  return patterns;
}

const nextConfig: NextConfig = {
  images: {
    remotePatterns: getSupabaseImagePatterns(),
  },
  async redirects() {
    return [
      {
        source: "/admin/financeiro",
        destination: "/admin/metricas",
        permanent: true,
      },
    ];
  },
  experimental: {
    serverActions: {
      // Fotos de celular passam facil de 1 MB (limite padrao)
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
