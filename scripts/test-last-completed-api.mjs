#!/usr/bin/env node
/**
 * Testa GET /api/v1/appointments/last-completed
 * Uso:
 *   API_BASE_URL=http://localhost:3000 node scripts/test-last-completed-api.mjs
 *   API_BASE_URL=https://... TEST_API_KEY=dbc_live_... node scripts/test-last-completed-api.mjs
 */
const base =
  process.env.API_BASE_URL?.replace(/\/$/, "") ||
  "http://localhost:3000";
const testKey = process.env.TEST_API_KEY?.trim();
const whatsapp = process.env.TEST_WHATSAPP ?? "5513981008852";
const url = `${base}/api/v1/appointments/last-completed?whatsapp=${encodeURIComponent(whatsapp)}`;

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
  return { status: res.status, json };
}

console.log(`URL: ${url}`);

const s1 = await request("1. Sem chave");
if (s1.status !== 401) process.exitCode = 1;

const s2 = await request("2. Chave inválida", {
  headers: { Authorization: "Bearer chave-invalida" },
});
if (s2.status !== 401) process.exitCode = 1;

if (testKey) {
  const s3 = await request("3. Chave válida", {
    headers: { Authorization: `Bearer ${testKey}` },
  });
  if (s3.status !== 200) process.exitCode = 1;
  if (s3.json.found !== true && s3.json.found !== false) process.exitCode = 1;
} else {
  console.log("\n3. Chave válida — pulado (defina TEST_API_KEY)");
}

if (process.exitCode) {
  console.error("\nAlgum teste falhou.");
  process.exit(1);
}

console.log("\nTestes concluídos.");
