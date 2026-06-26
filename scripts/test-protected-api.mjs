#!/usr/bin/env node
/**
 * Testa autenticação das rotas protegidas.
 * Uso:
 *   API_BASE_URL=http://localhost:3000 node scripts/test-protected-api.mjs
 *   API_BASE_URL=https://... TEST_API_KEY=dbc_live_... node scripts/test-protected-api.mjs
 */
const base =
  process.env.API_BASE_URL?.replace(/\/$/, "") ||
  "http://localhost:3000";
const testKey = process.env.TEST_API_KEY?.trim();
const whatsapp = process.env.TEST_WHATSAPP ?? "5513981008852";
const url = `${base}/api/v1/appointments?whatsapp=${encodeURIComponent(whatsapp)}`;

async function request(label, init = {}) {
  const res = await fetch(url, init);
  const body = await res.text();
  let json;
  try {
    json = JSON.parse(body);
  } catch {
    json = body;
  }
  console.log(`\n${label}`);
  console.log(`  STATUS ${res.status}`);
  console.log(`  BODY ${JSON.stringify(json)}`);
  return res.status;
}

console.log(`Base: ${base}`);

const s1 = await request("1. Sem chave", {});
if (s1 !== 401) process.exitCode = 1;

const s2 = await request("2. Chave errada", {
  headers: { Authorization: "Bearer chave-invalida-apenas-para-teste" },
});
if (s2 !== 401) process.exitCode = 1;

if (testKey) {
  const s3 = await request("3. Chave válida (appointments:read)", {
    headers: { Authorization: `Bearer ${testKey}` },
  });
  if (s3 !== 200) process.exitCode = 1;

  const readonlyKey = process.env.TEST_API_KEY_READONLY?.trim();
  if (readonlyKey) {
    const s4 = await request("4. Chave sem appointments:read", {
      headers: { Authorization: `Bearer ${readonlyKey}` },
    });
    if (s4 !== 403) process.exitCode = 1;
  } else {
    console.log("\n4. Chave readonly — pulado (defina TEST_API_KEY_READONLY)");
  }
} else {
  console.log("\n3–4. Chave válida — pulado (defina TEST_API_KEY no ambiente)");
}

if (process.exitCode) {
  console.error("\nAlgum teste falhou.");
  process.exit(1);
}

console.log("\nTestes concluídos.");
