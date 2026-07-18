/**
 * Gera ícones P&B dos serviços, sobe no Storage e atualiza photo_url.
 * Uso: node --env-file=.env.local scripts/generate-service-icons.mjs
 */
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const SIZE = 512;
const BG = "#0a0a0a";
const FG = "#fafafa";

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Faltam SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no .env.local");
  process.exit(1);
}

const admin = createClient(url, key, { auth: { persistSession: false } });

/** Símbolos SVG (viewBox 0 0 24 24), stroke branco. */
const SYMBOLS = {
  scissors: `
    <circle cx="6" cy="6" r="2.5" fill="none" stroke="${FG}" stroke-width="1.75"/>
    <circle cx="6" cy="18" r="2.5" fill="none" stroke="${FG}" stroke-width="1.75"/>
    <path d="M8.2 7.8 L20 20 M8.2 16.2 L20 4" fill="none" stroke="${FG}" stroke-width="1.75" stroke-linecap="round"/>
  `,
  beard: `
    <path d="M5 9c0-2.5 3-4.5 7-4.5s7 2 7 4.5c0 5-2.5 9.5-7 11.5C7.5 18.5 5 14 5 9z" fill="none" stroke="${FG}" stroke-width="1.75"/>
    <path d="M8.5 11.5c1 .8 2.2 1.2 3.5 1.2s2.5-.4 3.5-1.2" fill="none" stroke="${FG}" stroke-width="1.5" stroke-linecap="round"/>
  `,
  pigment: `
    <path d="M14.5 4.5 L19.5 9.5 L10 19 H5 V14 Z" fill="none" stroke="${FG}" stroke-width="1.75" stroke-linejoin="round"/>
    <circle cx="8.5" cy="15.5" r="1.2" fill="${FG}"/>
    <path d="M16 7 L17.5 5.5" fill="none" stroke="${FG}" stroke-width="1.5" stroke-linecap="round"/>
  `,
  brow: `
    <path d="M4 14c3-4 6.5-5.5 8.5-5.5S18 10 20 14" fill="none" stroke="${FG}" stroke-width="1.75" stroke-linecap="round"/>
    <path d="M7 14.5c1.2-1.2 2.6-1.8 4-1.8s2.8.6 4 1.8" fill="none" stroke="${FG}" stroke-width="1.4" stroke-linecap="round"/>
  `,
  bottle: `
    <path d="M9 3h6v3l2 2v12a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V8l2-2V3z" fill="none" stroke="${FG}" stroke-width="1.75" stroke-linejoin="round"/>
    <path d="M9 10h6" fill="none" stroke="${FG}" stroke-width="1.5" stroke-linecap="round"/>
  `,
  progressive: `
    <path d="M4 16c2-6 4-8 6-8s3 3 4 6 2 5 4 5 2-2 2-5" fill="none" stroke="${FG}" stroke-width="1.75" stroke-linecap="round"/>
    <path d="M4 19h16" fill="none" stroke="${FG}" stroke-width="1.4" stroke-linecap="round"/>
  `,
  seal: `
    <path d="M12 3l2.2 4.5 5 .7-3.6 3.5.9 5L12 14.8 7.5 16.7l.9-5L4.8 8.2l5-.7z" fill="none" stroke="${FG}" stroke-width="1.6" stroke-linejoin="round"/>
  `,
  nose: `
    <path d="M10 5c0 0-1 5-.5 8.5C10 16 11 18 12.5 18c1.2 0 2-.8 2.2-2" fill="none" stroke="${FG}" stroke-width="1.75" stroke-linecap="round"/>
    <path d="M9 14.5c.8.8 1.6 1.2 2.5 1.2" fill="none" stroke="${FG}" stroke-width="1.4" stroke-linecap="round"/>
  `,
  ear: `
    <path d="M14 5.5c2.5 0 4 2 4 5s-1 5.5-3.5 7.5c-1 .8-2 1.5-3 1.5" fill="none" stroke="${FG}" stroke-width="1.75" stroke-linecap="round"/>
    <path d="M14 8.5c1.2 0 2 1 2 2.5s-.6 2.5-1.6 3" fill="none" stroke="${FG}" stroke-width="1.4" stroke-linecap="round"/>
  `,
  drop: `
    <path d="M12 3c0 0-6 7-6 11a6 6 0 0 0 12 0c0-4-6-11-6-11z" fill="none" stroke="${FG}" stroke-width="1.75" stroke-linejoin="round"/>
  `,
  face: `
    <circle cx="12" cy="12" r="8" fill="none" stroke="${FG}" stroke-width="1.75"/>
    <path d="M8.5 14c1.2 1.5 2.8 2.2 3.5 2.2s2.3-.7 3.5-2.2" fill="none" stroke="${FG}" stroke-width="1.5" stroke-linecap="round"/>
    <circle cx="9" cy="10.5" r="1" fill="${FG}"/>
    <circle cx="15" cy="10.5" r="1" fill="${FG}"/>
  `,
  lights: `
    <path d="M12 3v3 M12 18v3 M3 12h3 M18 12h3 M5.6 5.6l2.1 2.1 M16.3 16.3l2.1 2.1 M5.6 18.4l2.1-2.1 M16.3 7.7l2.1-2.1" fill="none" stroke="${FG}" stroke-width="1.6" stroke-linecap="round"/>
    <circle cx="12" cy="12" r="3.2" fill="none" stroke="${FG}" stroke-width="1.75"/>
  `,
  pezinho: `
    <path d="M7 6h10v3c0 2-1 3.5-3 4.5L12 20l-2-6.5C8 12.5 7 11 7 9V6z" fill="none" stroke="${FG}" stroke-width="1.75" stroke-linejoin="round"/>
    <path d="M9 9h6" fill="none" stroke="${FG}" stroke-width="1.4" stroke-linecap="round"/>
  `,
  platinum: `
    <path d="M7 20h10 M8 20l1.5-12h5L16 20 M10 8h4" fill="none" stroke="${FG}" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M9.5 5h5l.8 3H8.7z" fill="none" stroke="${FG}" stroke-width="1.5" stroke-linejoin="round"/>
  `,
  relax: `
    <path d="M4 12c2-3 4-4 6-4s3 2 4 4 2 4 4 4 2-1 2-3" fill="none" stroke="${FG}" stroke-width="1.75" stroke-linecap="round"/>
    <path d="M4 16c2-2 4-3 6-3s3 1.5 4 3" fill="none" stroke="${FG}" stroke-width="1.4" stroke-linecap="round"/>
  `,
  dye: `
    <path d="M8 3h8v4l-1 1v11a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2V8L8 7V3z" fill="none" stroke="${FG}" stroke-width="1.75" stroke-linejoin="round"/>
    <path d="M10 14h4 M10 17h4" fill="none" stroke="${FG}" stroke-width="1.4" stroke-linecap="round"/>
  `,
  zero: `
    <rect x="5" y="6" width="14" height="8" rx="1.5" fill="none" stroke="${FG}" stroke-width="1.75"/>
    <path d="M8 14v4 M16 14v4 M7 18h10" fill="none" stroke="${FG}" stroke-width="1.6" stroke-linecap="round"/>
    <path d="M8 9h8 M8 11.5h5" fill="none" stroke="${FG}" stroke-width="1.3" stroke-linecap="round"/>
  `,
  plan: `
    <path d="M12 3l2.5 5 5.5.8-4 3.9.9 5.5L12 15.8 7.1 18.2l.9-5.5-4-3.9 5.5-.8z" fill="none" stroke="${FG}" stroke-width="1.6" stroke-linejoin="round"/>
  `,
};

function parseParts(name) {
  return name
    .split("+")
    .map((p) => p.trim())
    .filter(Boolean);
}

function symbolForPart(part) {
  const p = part.toLowerCase();
  if (p.includes("corte de cabelo") || p === "corte") return "scissors";
  if (p.includes("barbaterapia") || p.includes("barba")) return "beard";
  if (p.includes("pigment")) return "pigment";
  if (p.includes("sobrancel")) return "brow";
  if (p.includes("botox")) return "bottle";
  if (p.includes("progressiva")) return "progressive";
  if (p.includes("selagem")) return "seal";
  if (p.includes("nariz") && p.includes("orelha")) return "nose"; // combo handled by parts
  if (p.includes("nariz")) return "nose";
  if (p.includes("orelha")) return "ear";
  if (p.includes("hidrata")) return "drop";
  if (p.includes("limpeza")) return "face";
  if (p.includes("luzes") || p.includes("reflexo")) return "lights";
  if (p.includes("pézinho") || p.includes("pezinho")) return "pezinho";
  if (p.includes("platinado")) return "platinum";
  if (p.includes("relax")) return "relax";
  if (p.includes("tintura")) return "dye";
  if (p.includes("zero")) return "zero";
  if (p.includes("plano bronze") || p.includes("plano prata") || p.includes("plano ouro") || p.includes("serviço plano") || p.includes("servico plano"))
    return "plan";
  if (p.includes("depilação") || p.includes("depilacao")) {
    if (p.includes("orelha")) return "ear";
    return "nose";
  }
  return "scissors";
}

function symbolsForService(name) {
  const lower = name.toLowerCase();
  if (lower.includes("depilação nariz + orelha") || lower.includes("depilacao nariz + orelha")) {
    return ["nose", "ear"];
  }
  if (lower.startsWith("serviço plano") || lower.startsWith("servico plano")) {
    return ["plan"];
  }

  const parts = parseParts(name);
  if (parts.length <= 1) {
    return [symbolForPart(name)];
  }
  return parts.map(symbolForPart);
}

function tileLayout(count) {
  if (count <= 1) return { cols: 1, rows: 1, cell: 280, gap: 0 };
  if (count === 2) return { cols: 2, rows: 1, cell: 180, gap: 28 };
  if (count === 3) return { cols: 3, rows: 1, cell: 130, gap: 20 };
  return { cols: 2, rows: 2, cell: 160, gap: 24 };
}

function buildSvg(name) {
  const keys = symbolsForService(name);
  const unique = [];
  for (const k of keys) {
    if (!unique.includes(k)) unique.push(k);
  }
  const symbols = unique.slice(0, 4);
  const { cols, rows, cell, gap } = tileLayout(symbols.length);
  const gridW = cols * cell + (cols - 1) * gap;
  const gridH = rows * cell + (rows - 1) * gap;
  const startX = (SIZE - gridW) / 2;
  const startY = (SIZE - gridH) / 2;

  const tiles = symbols
    .map((key, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = startX + col * (cell + gap);
      const y = startY + row * (cell + gap);
      const body = SYMBOLS[key] || SYMBOLS.scissors;
      return `
        <g transform="translate(${x}, ${y})">
          <rect width="${cell}" height="${cell}" rx="${Math.round(cell * 0.18)}" fill="#141414" stroke="rgba(255,255,255,0.14)" stroke-width="2"/>
          <svg x="${cell * 0.18}" y="${cell * 0.18}" width="${cell * 0.64}" height="${cell * 0.64}" viewBox="0 0 24 24">
            ${body}
          </svg>
        </g>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
  <rect width="${SIZE}" height="${SIZE}" fill="${BG}"/>
  ${tiles}
</svg>`;
}

async function pngForService(name) {
  const svg = buildSvg(name);
  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function main() {
  const { data: services, error } = await admin
    .from("services")
    .select("id, name, photo_url")
    .order("name");

  if (error) {
    console.error(error);
    process.exit(1);
  }

  console.log(`Gerando ícones para ${services.length} serviços...`);

  let ok = 0;
  let fail = 0;

  for (const service of services) {
    try {
      const png = await pngForService(service.name);
      const path = `services/${service.id}-icon-${Date.now()}.png`;

      const { error: upErr } = await admin.storage
        .from("photos")
        .upload(path, png, {
          contentType: "image/png",
          upsert: true,
        });

      if (upErr) {
        console.error(`Falha upload ${service.name}:`, upErr.message);
        fail++;
        continue;
      }

      const publicUrl = admin.storage.from("photos").getPublicUrl(path).data
        .publicUrl;

      const { error: updErr } = await admin
        .from("services")
        .update({
          photo_url: publicUrl,
          photo_position: "50% 50%",
        })
        .eq("id", service.id);

      if (updErr) {
        console.error(`Falha update ${service.name}:`, updErr.message);
        fail++;
        continue;
      }

      // Remove foto antiga do storage, se for do bucket photos/services
      if (service.photo_url && service.photo_url.includes("/photos/services/")) {
        try {
          const marker = "/photos/services/";
          const idx = service.photo_url.indexOf(marker);
          if (idx >= 0) {
            const oldPath = `services/${service.photo_url.slice(idx + marker.length).split("?")[0]}`;
            await admin.storage.from("photos").remove([oldPath]);
          }
        } catch {
          // limpeza é best-effort
        }
      }

      ok++;
      console.log(`✓ ${service.name}`);
    } catch (e) {
      fail++;
      console.error(`✗ ${service.name}:`, e.message || e);
    }
  }

  console.log(`\nConcluído: ${ok} ok, ${fail} falha(s).`);
}

main();
