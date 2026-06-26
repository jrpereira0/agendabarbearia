// Importa catálogo de serviços do AppBarber (PDF) e vincula todos os barbeiros.
// Uso: node --env-file=.env.local scripts/seed-services-appbarber.mjs
import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

/** [código AppBarber ou null, rótulo, preço reais, duração min, descrição] */
const SERVICES = [
  ["01", "Corte Seg. - Qua.", 60, 30, "Segunda a quarta"],
  ["02", "Corte Qui. - Sáb.", 65, 30, "Quinta a sábado"],
  ["03", "Corte+Sobrancelha Seg. - Qua.", 70, 30, "Segunda a quarta"],
  ["04", "Corte+Sobrancelha Qui. - Sáb.", 75, 30, "Quinta a sábado"],
  ["05", "Barbaterapia Seg. - Qua.", 60, 30, "Segunda a quarta"],
  ["06", "Barbaterapia Qui. - Sáb.", 65, 30, "Quinta a sábado"],
  ["07", "Barbaterapia+Sobrancelha Seg. - Qua.", 70, 30, "Segunda a quarta"],
  ["08", "Barbaterapia+Sobrancelha Qui. - Sáb.", 75, 30, "Quinta a sábado"],
  ["09", "Barbaterapia+Pigmentação Seg. - Qua.", 90, 60, "Segunda a quarta"],
  ["10", "Barbaterapia+Pigmentação Qui. - Sáb.", 95, 60, "Quinta a sábado"],
  ["11", "Barbaterapia+Pig+Sobrancelha Seg. - Qua.", 100, 60, "Segunda a quarta"],
  ["12", "Barbaterapia+Pig+Sobrancelha Qui. - Sáb.", 105, 60, "Quinta a sábado"],
  ["13", "Barba Simples Seg. - Qua.", 55, 30, "Segunda a quarta"],
  ["14", "Barba Simples Qui. - Sáb.", 60, 30, "Quinta a sábado"],
  ["15", "Barba Simples+Sobrancelha Seg. - Qua.", 65, 30, "Segunda a quarta"],
  ["16", "Barba Simples+Sobrancelha Qui. - Sáb.", 70, 30, "Quinta a sábado"],
  ["17", "Barba Simples+Pigmentação Seg. - Qua.", 85, 60, "Segunda a quarta"],
  ["18", "Barba Simples+Pigmentação Qui. - Sáb.", 90, 60, "Quinta a sábado"],
  ["19", "Barba Simples+Pig+Sobrancelha Seg. - Qua.", 95, 60, "Segunda a quarta"],
  ["20", "Barba Simples+Pig+Sobrancelha Qui. - Sáb.", 100, 60, "Quinta a sábado"],
  ["21", "Corte e Barbaterapia Seg. - Qua.", 110, 60, "Segunda a quarta"],
  ["22", "Corte e Barbaterapia Qui. - Sáb.", 120, 60, "Quinta a sábado"],
  ["23", "Corte+Barbaterapia+Sobrancelha Seg. - Qua.", 120, 60, "Segunda a quarta"],
  ["24", "Corte+Barbaterapia+Sobrancelha Qui. - Sáb.", 130, 60, "Quinta a sábado"],
  ["25", "Corte+Barbaterapia+Pig Seg. - Qua.", 140, 90, "Segunda a quarta"],
  ["26", "Corte+Barbaterapia+Pig Qui. - Sáb.", 150, 90, "Quinta a sábado"],
  ["27", "Corte+Barbaterapia+Pig+Sobrancelha Seg. - Qua.", 150, 90, "Segunda a quarta"],
  ["28", "Corte+Barbaterapia+Pig+Sobrancelha Qui. - Sáb.", 160, 90, "Quinta a sábado"],
  ["29", "Corte+Barba Simples Seg. - Qua.", 105, 60, "Segunda a quarta"],
  ["30", "Corte+Barba Simples Qui. - Sáb.", 115, 60, "Quinta a sábado"],
  ["31", "Corte+Barba Simples+Sobrancelha Seg. - Qua.", 115, 60, "Segunda a quarta"],
  ["32", "Corte+Barba Simples+Sobrancelha Qui. - Sáb.", 125, 60, "Quinta a sábado"],
  ["33", "Corte+Barba Simples+Pigmentação Seg. - Qua.", 135, 90, "Segunda a quarta"],
  ["34", "Corte+Barba Simples+Pigmentação Qui. - Sáb.", 145, 90, "Quinta a sábado"],
  ["35", "Corte+Barba Simples+Pig+Sobrancelha Seg. - Qua.", 145, 90, "Segunda a quarta"],
  ["36", "Corte+Barba Simples+Pig+Sobrancelha Qui. - Sáb.", 155, 90, "Quinta a sábado"],
  ["37", "Corte Afro Seg. - Qua.", 60, 30, "Segunda a quarta"],
  ["38", "Corte Afro Qui. - Sáb.", 65, 30, "Quinta a sábado"],
  ["39", "Corte+Selagem Seg. - Qua.", 140, 90, "Segunda a quarta"],
  ["40", "Corte+Selagem Qui. - Sáb.", 145, 90, "Quinta a sábado"],
  ["41", "Corte+Selagem+Sobrancelha Seg. - Qua.", 150, 90, "Segunda a quarta"],
  ["42", "Corte+Selagem+Sobrancelha Qui. - Sáb.", 155, 90, "Quinta a sábado"],
  ["43", "Corte+Barbaterapia+Selagem Seg. - Qua.", 190, 120, "Segunda a quarta"],
  ["44", "Corte+Barbaterapia+Selagem Qui. - Sáb.", 200, 120, "Quinta a sábado"],
  ["45", "Corte+Barbaterapia+Selagem+Sobrancelha Seg. - Qua.", 200, 120, "Segunda a quarta"],
  ["46", "Corte+Barbaterapia+Selagem+Sobrancelha Qui. - Sáb.", 210, 120, "Quinta a sábado"],
  ["47", "Corte+Barba Simples+Selagem Seg. - Qua.", 185, 120, "Segunda a quarta"],
  ["48", "Corte+Barba Simples+Selagem Qui. - Sáb.", 195, 120, "Quinta a sábado"],
  ["49", "Corte+Barba Simples+Selagem+Sobrancelha Seg. - Qua.", 195, 120, "Segunda a quarta"],
  ["50", "Corte+Barba Simples+Selagem+Sobrancelha Qui. - Sáb.", 205, 120, "Quinta a sábado"],
  ["51", "Corte+Progressiva Seg. - Qua.", 140, 90, "Segunda a quarta"],
  ["52", "Corte+Progressiva Qui. - Sáb.", 145, 90, "Quinta a sábado"],
  ["53", "Corte+Progressiva+Sobrancelha Seg. - Qua.", 150, 90, "Segunda a quarta"],
  ["54", "Corte+Progressiva+Sobrancelha Qui. - Sáb.", 155, 90, "Quinta a sábado"],
  ["55", "Corte+Barbaterapia+Progressiva Seg. - Qua.", 190, 120, "Segunda a quarta"],
  ["56", "Corte+Barbaterapia+Progressiva Qui. - Sáb.", 200, 120, "Quinta a sábado"],
  ["57", "Corte+Barbaterapia+Progressiva+Sobrancelha Seg. - Qua.", 200, 120, "Segunda a quarta"],
  ["58", "Corte+Barbaterapia+Progressiva+Sobrancelha Qui. - Sáb.", 210, 120, "Quinta a sábado"],
  ["59", "Corte+Barba Simples+Progressiva Seg. - Qua.", 185, 120, "Segunda a quarta"],
  ["60", "Corte+Barba Simples+Progressiva Qui. - Sáb.", 195, 120, "Quinta a sábado"],
  ["61", "Corte+Barbaterapia+Progressiva+Sobrancelha Seg. - Qua.", 195, 120, "Segunda a quarta"],
  ["62", "Corte+Barbaterapia+Progressiva+Sobrancelha Qui. - Sáb.", 205, 120, "Quinta a sábado"],
  ["63", "Corte+Botox Seg. - Qua.", 135, 90, "Segunda a quarta"],
  ["64", "Corte+Botox Qui. - Sáb.", 140, 90, "Quinta a sábado"],
  ["65", "Corte+Botox+Sobrancelha Seg. - Qua.", 145, 90, "Segunda a quarta"],
  ["66", "Corte+Botox+Sobrancelha Qui. - Sáb.", 150, 90, "Quinta a sábado"],
  ["67", "Corte+Barbaterapia+Botox Seg. - Qua.", 180, 120, "Segunda a quarta"],
  ["68", "Corte+Barbaterapia+Botox Qui. - Sáb.", 195, 120, "Quinta a sábado"],
  ["69", "Corte+Barbaterapia+Botox+Sobrancelha Seg. - Qua.", 190, 120, "Segunda a quarta"],
  ["70", "Corte+Barbaterapia+Botox+Sobrancelha Qui. - Sáb.", 205, 120, "Quinta a sábado"],
  ["71", "Corte+Barba Simples+Botox Seg. - Qua.", 180, 120, "Segunda a quarta"],
  ["72", "Corte+Barba Simples+Botox Qui. - Sáb.", 190, 120, "Quinta a sábado"],
  ["73", "Corte+Barbaterapia+Botox+Sobrancelha Seg. - Qua.", 195, 120, "Segunda a quarta"],
  ["74", "Corte+Barbaterapia+Botox+Sobrancelha Qui. - Sáb.", 200, 120, "Quinta a sábado"],
  ["75", "Platinado+Corte de Seg. - Qua.", 250, 60, "Segunda a quarta"],
  ["76", "Platinado+Corte de Qui. - Sáb.", 265, 60, "Quinta a sábado"],
  ["77", "Luzes+Corte de Seg. - Qua.", 210, 60, "Segunda a quarta"],
  ["78", "Luzes+Corte de Qui. - Sáb.", 215, 60, "Quinta a sábado"],
  ["79", "Platinado de Seg. - Qua.", 190, 60, "Segunda a quarta"],
  ["80", "Platinado de Qui. - Sáb.", 200, 60, "Quinta a sábado"],
  ["81", "Luzes", 150, 60, "Serviço avulso"],
  ["83", "Corte a Domicílio", 150, 60, "Atendimento externo"],
  ["84", "Zero Total", 50, 30, "Zerar máquina / acabamento"],
  ["150", "Pézinho", 20, 10, "Acabamento"],
  ["151", "Hidratação", 30, 10, "Tratamento capilar"],
  ["152", "Sobrancelha", 15, 10, "Design de sobrancelha"],
  ["153", "Selagem", 80, 60, "Tratamento capilar"],
  ["154", "Progressiva", 80, 60, "Tratamento capilar"],
  ["155", "Relaxamento", 70, 30, "Tratamento capilar"],
  ["156", "Pigmentação", 30, 30, "Barba ou cabelo"],
  ["157", "Tintura", 45, 30, "Coloração"],
  ["158", "Matização+Hidratação", 60, 30, "Tratamento capilar"],
  ["159", "Matização", 40, 30, "Tratamento capilar"],
  ["160", "Depilação Combo", 40, 20, "Nariz e orelha"],
  ["161", "Depilação Nariz", 25, 10, "Depilação"],
  ["162", "Depilação Orelha", 25, 10, "Depilação"],
  ["163", "Camuflagem", 60, 30, "Cobertura de fios brancos"],
  ["164", "Limpeza de Pele", 60, 30, "Tratamento facial"],
  ["166", "Risquinho Freestyle", 30, 10, "Desenho no corte"],
  ["167", "Blindado", 50, 30, "Tratamento"],
  ["168", "Botox", 75, 60, "Tratamento capilar"],
  [null, "Barba Terapia", 50, 30, "Barbaterapia"],
  [null, "Corte + Barba T.", 100, 60, "Combo corte e barbaterapia"],
  [null, "Corte de Cabelo", 50, 60, "Corte masculino"],
  [null, "Luzes (150 min)", 150, 150, "Mechas — sessão longa"],
  [null, "Plano Bronze Assinatura", 49.9, 30, "Plano de assinatura"],
  [null, "Plano Ouro Assinatura", 44.9, 30, "Plano de assinatura"],
  [null, "Plano Prata Assinatura", 49.9, 30, "Plano de assinatura"],
  [null, "Serviço Plano Bronze", 37.4, 30, "Preço para assinante Bronze"],
  [null, "Serviço Plano Diamond", 37.4, 30, "Preço para assinante Diamond"],
  [null, "Serviço Plano Gold", 37.4, 30, "Preço para assinante Gold"],
  [null, "Serviço Plano Silver", 37.4, 30, "Preço para assinante Silver"],
];

function serviceName(code, label) {
  return code ? `${code} - ${label}` : label;
}

function toCents(value) {
  return Math.round(value * 100);
}

async function deleteAllAppointmentServices() {
  const { data, error: fetchErr } = await admin
    .from("appointment_services")
    .select("appointment_id, service_id");
  if (fetchErr) throw new Error(fetchErr.message);
  if (!data?.length) return 0;

  for (const row of data) {
    const { error } = await admin
      .from("appointment_services")
      .delete()
      .eq("appointment_id", row.appointment_id)
      .eq("service_id", row.service_id);
    if (error) throw new Error(error.message);
  }
  return data.length;
}

async function deleteAllProfessionalServices() {
  const { data, error: fetchErr } = await admin
    .from("professional_services")
    .select("professional_id, service_id");
  if (fetchErr) throw new Error(fetchErr.message);
  if (!data?.length) return 0;

  for (const row of data) {
    const { error } = await admin
      .from("professional_services")
      .delete()
      .eq("professional_id", row.professional_id)
      .eq("service_id", row.service_id);
    if (error) throw new Error(error.message);
  }
  return data.length;
}

async function deleteAllServices() {
  const { data, error: fetchErr } = await admin.from("services").select("id");
  if (fetchErr) throw new Error(fetchErr.message);
  if (!data?.length) return 0;

  const { error } = await admin
    .from("services")
    .delete()
    .in(
      "id",
      data.map((r) => r.id)
    );
  if (error) throw new Error(error.message);
  return data.length;
}

const { data: professionals, error: proErr } = await admin
  .from("professionals")
  .select("id, nickname")
  .eq("active", true);
if (proErr) throw new Error(proErr.message);
if (!professionals?.length) {
  console.error("Nenhum barbeiro ativo encontrado.");
  process.exit(1);
}

const removedLinks = await deleteAllAppointmentServices();
const removedProLinks = await deleteAllProfessionalServices();
const removedServices = await deleteAllServices();

const rows = SERVICES.map(([code, label, price, duration, description]) => ({
  name: serviceName(code, label),
  description,
  price_cents: toCents(price),
  duration_minutes: duration,
  active: true,
}));

const { data: inserted, error: insertErr } = await admin
  .from("services")
  .insert(rows)
  .select("id, name");
if (insertErr) throw new Error(insertErr.message);

const links = [];
for (const pro of professionals) {
  for (const service of inserted) {
    links.push({ professional_id: pro.id, service_id: service.id });
  }
}

const chunkSize = 200;
for (let i = 0; i < links.length; i += chunkSize) {
  const chunk = links.slice(i, i + chunkSize);
  const { error } = await admin.from("professional_services").insert(chunk);
  if (error) throw new Error(error.message);
}

console.log(
  JSON.stringify(
    {
      servicos_removidos: removedServices,
      vinculos_agendamento_removidos: removedLinks,
      vinculos_barbeiro_removidos: removedProLinks,
      servicos_cadastrados: inserted.length,
      barbeiros: professionals.map((p) => p.nickname),
      vinculos_criados: links.length,
    },
    null,
    2
  )
);
