import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import sharp from "sharp";
import { BRAND_ICON_PATH } from "@/lib/brand";
import { getShopSeo } from "@/lib/get-shop-seo";

export const alt = "Agende seu horário";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

const LOGO_PX = 192;

async function toEmbeddedPng(buffer: Buffer): Promise<string> {
  const resized = await sharp(buffer)
    .resize(LOGO_PX, LOGO_PX, {
      fit: "cover",
      position: "centre",
    })
    .png()
    .toBuffer();
  return `data:image/png;base64,${resized.toString("base64")}`;
}

async function resolveLogoSrc(logoUrl: string): Promise<string | null> {
  const trimmed = logoUrl.trim();
  if (!trimmed) return null;

  try {
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      const res = await fetch(trimmed, { cache: "force-cache" });
      if (!res.ok) return null;
      const buffer = Buffer.from(await res.arrayBuffer());
      return toEmbeddedPng(buffer);
    }

    const relative = trimmed.startsWith("/") ? trimmed.slice(1) : trimmed;
    const filePath = join(process.cwd(), "public", relative);
    const buffer = await readFile(filePath);
    return toEmbeddedPng(buffer);
  } catch {
    return null;
  }
}

export default async function Image() {
  const { name, logoUrl } = await getShopSeo();
  const logoSrc =
    (await resolveLogoSrc(logoUrl)) ??
    (await resolveLogoSrc(BRAND_ICON_PATH));

  const initial = (name.trim()[0] || "B").toUpperCase();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#0a0a0a",
          color: "#fafafa",
          padding: "72px 80px",
          fontFamily: "sans-serif",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            right: -40,
            bottom: -80,
            fontSize: 420,
            fontWeight: 700,
            color: "rgba(255,255,255,0.04)",
            lineHeight: 1,
            letterSpacing: -12,
            display: "flex",
          }}
        >
          {initial}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 28,
          }}
        >
          {logoSrc ? (
            <img
              src={logoSrc}
              width={96}
              height={96}
              alt=""
              style={{
                width: 96,
                height: 96,
                borderRadius: 20,
                objectFit: "cover",
                border: "1px solid rgba(255,255,255,0.18)",
              }}
            />
          ) : (
            <div
              style={{
                width: 96,
                height: 96,
                borderRadius: 20,
                border: "1px solid rgba(255,255,255,0.18)",
                background: "#171717",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 36,
                fontWeight: 700,
                letterSpacing: 1,
              }}
            >
              {initial}
            </div>
          )}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            <div
              style={{
                fontSize: 22,
                letterSpacing: 3,
                textTransform: "uppercase",
                color: "rgba(250,250,250,0.55)",
                fontWeight: 500,
              }}
            >
              Agendamento online
            </div>
            <div
              style={{
                fontSize: 64,
                fontWeight: 700,
                lineHeight: 1.05,
                letterSpacing: -1.5,
                maxWidth: 820,
              }}
            >
              {name}
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 18,
          }}
        >
          <div
            style={{
              width: 72,
              height: 2,
              background: "rgba(250,250,250,0.85)",
            }}
          />
          <div
            style={{
              fontSize: 34,
              fontWeight: 500,
              color: "rgba(250,250,250,0.88)",
              letterSpacing: -0.4,
            }}
          >
            Agende seu horário online
          </div>
          <div
            style={{
              fontSize: 24,
              color: "rgba(250,250,250,0.5)",
              maxWidth: 780,
            }}
          >
            Escolha o barbeiro, o serviço e o horário em poucos toques.
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
