const baseUrl =
  process.env.API_BASE_URL?.replace(/\/$/, "") ?? "http://localhost:3000";

function digitsOnly(input) {
  return input.replace(/\D/g, "");
}

function normalizeWhatsapp(input) {
  const digits = digitsOnly(input);
  if (!digits) return null;
  if (digits.startsWith("55")) {
    if (digits.length === 12 || digits.length === 13) return digits;
    return null;
  }
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return null;
}

const samples = [
  "+55 (13) 99999-9999",
  "5513999999999",
  "13999999999",
  "",
  "abc",
];

console.log("=== Normalização (offline) ===\n");
for (const sample of samples) {
  console.log(`Entrada: ${JSON.stringify(sample)}`);
  console.log(`  normalizado: ${normalizeWhatsapp(sample) ?? "(inválido)"}`);
  console.log("");
}

console.log("=== API HTTP ===\n");
console.log(`Base: ${baseUrl}/api/v1/customers/by-whatsapp\n`);

const testNumbers = [
  process.argv[2] ?? "(13) 99999-9999",
  process.argv[3] ?? "5511000000000",
];

for (const whatsapp of testNumbers) {
  const url = `${baseUrl}/api/v1/customers/by-whatsapp?whatsapp=${encodeURIComponent(whatsapp)}`;
  console.log(`GET ${url}`);

  try {
    const response = await fetch(url);
    const body = await response.json();
    console.log(`Status: ${response.status}`);
    console.log(JSON.stringify(body, null, 2));
  } catch (error) {
    console.error("Erro:", error instanceof Error ? error.message : error);
    console.error(
      "Dica: rode npm run dev em outro terminal ou defina API_BASE_URL com a URL da Vercel."
    );
  }

  console.log("");
}
