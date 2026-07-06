// Zera dados operacionais da barbearia.
// Mantém: logins (auth + profiles) e profissionais (com grade working_hours).
// Uso: npm run db:reset-shop
import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function deleteAllById(table) {
  const { data, error: fetchErr } = await admin.from(table).select("id");
  if (fetchErr) throw new Error(`${table}: ${fetchErr.message}`);
  if (!data?.length) return 0;
  const ids = data.map((row) => row.id);
  const { error } = await admin.from(table).delete().in("id", ids);
  if (error) throw new Error(`${table}: ${error.message}`);
  return ids.length;
}

async function deleteCompositeRows(table, columns) {
  const { data, error: fetchErr } = await admin.from(table).select(columns.join(","));
  if (fetchErr) throw new Error(`${table}: ${fetchErr.message}`);
  if (!data?.length) return 0;

  for (const row of data) {
    let query = admin.from(table).delete();
    for (const column of columns) {
      query = query.eq(column, row[column]);
    }
    const { error } = await query;
    if (error) throw new Error(`${table}: ${error.message}`);
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
    .filter((file) => file.name && !file.name.startsWith("."))
    .map((file) => `${folder}/${file.name}`);
  if (paths.length) {
    await admin.storage.from("photos").remove(paths);
  }
}

async function main() {
  const summary = {};

  summary.comanda_payments = await deleteAllById("comanda_payments");
  summary.comanda_items = await deleteAllById("comanda_items");
  summary.comanda_appointments = await deleteCompositeRows("comanda_appointments", [
    "comanda_id",
    "appointment_id",
  ]);
  summary.comandas = await deleteAllById("comandas");
  summary.cash_register_sessions = await deleteAllById("cash_register_sessions");
  summary.appointment_services = await deleteCompositeRows("appointment_services", [
    "appointment_id",
    "service_id",
  ]);
  summary.appointments = await deleteAllById("appointments");
  summary.schedule_blocks = await deleteAllById("schedule_blocks");
  summary.schedule_exceptions = await deleteAllById("schedule_exceptions");
  summary.service_weekday_prices = await deleteCompositeRows(
    "service_weekday_prices",
    ["service_id", "weekday"]
  );
  summary.professional_services = await deleteCompositeRows("professional_services", [
    "professional_id",
    "service_id",
  ]);
  summary.services = await deleteAllById("services");
  summary.customers = await deleteAllById("customers");
  summary.api_keys = await deleteAllById("api_keys");

  await resetBusinessHours();
  await resetShopSettings();

  await clearStorageFolder("services");
  await clearStorageFolder("shop");

  const { count: professionalsKept } = await admin
    .from("professionals")
    .select("id", { count: "exact", head: true });
  const { count: profilesKept } = await admin
    .from("profiles")
    .select("id", { count: "exact", head: true });

  summary.professionals_kept = professionalsKept ?? 0;
  summary.profiles_kept = profilesKept ?? 0;

  console.log("Reset concluído (login e profissionais mantidos):");
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
