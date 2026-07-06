// Zera dados operacionais da barbearia (mantém login do dono).
// Uso: node --env-file=.env.local scripts/reset-shop-data.mjs
import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function deleteAllRows(table) {
  const { data, error: fetchErr } = await admin.from(table).select("id");
  if (fetchErr) throw new Error(`${table}: ${fetchErr.message}`);
  if (!data?.length) return 0;
  const ids = data.map((r) => r.id);
  const { error } = await admin.from(table).delete().in("id", ids);
  if (error) throw new Error(`${table}: ${error.message}`);
  return ids.length;
}

async function deleteAppointmentServices() {
  const { data } = await admin.from("appointment_services").select("appointment_id, service_id");
  if (!data?.length) return 0;
  for (const row of data) {
    const { error } = await admin
      .from("appointment_services")
      .delete()
      .eq("appointment_id", row.appointment_id)
      .eq("service_id", row.service_id);
    if (error) throw new Error(`appointment_services: ${error.message}`);
  }
  return data.length;
}

async function deleteProfessionalServices() {
  const { data } = await admin
    .from("professional_services")
    .select("professional_id, service_id");
  if (!data?.length) return 0;
  for (const row of data) {
    const { error } = await admin
      .from("professional_services")
      .delete()
      .eq("professional_id", row.professional_id)
      .eq("service_id", row.service_id);
    if (error) throw new Error(`professional_services: ${error.message}`);
  }
  return data.length;
}

async function resetBusinessHours() {
  const seed = [
    { weekday: 0, open_time: "09:00", close_time: "19:00", active: false },
    { weekday: 1, open_time: "09:00", close_time: "19:00", active: true },
    { weekday: 2, open_time: "09:00", close_time: "19:00", active: true },
    { weekday: 3, open_time: "09:00", close_time: "19:00", active: true },
    { weekday: 4, open_time: "09:00", close_time: "19:00", active: true },
    { weekday: 5, open_time: "09:00", close_time: "19:00", active: true },
    { weekday: 6, open_time: "09:00", close_time: "19:00", active: true },
  ];
  for (const day of seed) {
    const { error } = await admin.from("business_hours").upsert(day);
    if (error) throw new Error(`business_hours: ${error.message}`);
  }
}

async function resetShopSettings() {
  const { error } = await admin
    .from("shop_settings")
    .update({
      shop_name: "",
      bio: "",
      address: "",
      cep: "",
      street: "",
      address_number: "",
      address_complement: "",
      neighborhood: "",
      city: "",
      state: "",
      whatsapp: "",
      instagram: null,
      logo_url: null,
      slot_step_minutes: 15,
    })
    .eq("id", 1);
  if (error) throw new Error(`shop_settings: ${error.message}`);
}

async function clearStorageFolder(folder) {
  const { data: files, error } = await admin.storage.from("photos").list(folder, {
    limit: 1000,
  });
  if (error) return;
  if (!files?.length) return;
  const paths = files
    .filter((f) => f.name && !f.name.startsWith("."))
    .map((f) => `${folder}/${f.name}`);
  if (paths.length) {
    await admin.storage.from("photos").remove(paths);
  }
}

const { data: professionals } = await admin
  .from("professionals")
  .select("profile_id");

const { data: barberProfiles } = await admin
  .from("profiles")
  .select("id")
  .eq("role", "barber");

const authIdsToDelete = [
  ...new Set([
    ...(professionals ?? []).map((p) => p.profile_id).filter(Boolean),
    ...(barberProfiles ?? []).map((p) => p.id),
  ]),
];

const summary = {};

summary.appointment_services = await deleteAppointmentServices();
summary.appointments = await deleteAllRows("appointments");
summary.customers = await deleteAllRows("customers");
summary.schedule_blocks = await deleteAllRows("schedule_blocks");
summary.schedule_exceptions = await deleteAllRows("schedule_exceptions");
summary.working_hours = await deleteAllRows("working_hours");
summary.professional_services = await deleteProfessionalServices();
summary.professionals = await deleteAllRows("professionals");
summary.services = await deleteAllRows("services");

for (const userId of authIdsToDelete) {
  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  if (profile?.role === "owner") continue;
  await admin.auth.admin.deleteUser(userId);
}
summary.barber_logins_removed = authIdsToDelete.length;

await resetBusinessHours();
await resetShopSettings();

await clearStorageFolder("professionals");
await clearStorageFolder("services");
await clearStorageFolder("shop");

console.log("Reset concluído:");
console.log(JSON.stringify(summary, null, 2));
