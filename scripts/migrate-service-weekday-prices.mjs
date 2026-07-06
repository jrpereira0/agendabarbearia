// Migra serviços atuais para preços por dia da semana.
// - Agrupa pares AppBarber (Seg–Qua / Qui–Sáb) em um serviço só
// - Preenche service_weekday_prices
// - Limpa o nome (remove código e faixa de dia)
//
// Uso:
//   npm run db:migrate
//   npm run db:migrate-weekday-prices
import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const REGEX_SEG_QUA = /Seg\.\s*-\s*Qua\.|Seg\s*-\s*Qua|Seg\.\s*-\s*Quar\./i;
const REGEX_QUI_SAB = /Qui\.\s*-\s*Sáb\.|Qui\s*-\s*Sab|Qui\.\s*-\s*Sab\./i;

function cleanLegacyServiceName(serviceName) {
  let name = serviceName.replace(/^\d+\s*-\s*/, "");
  name = name.replace(REGEX_SEG_QUA, "");
  name = name.replace(REGEX_QUI_SAB, "");
  return name.trim().replace(/\s+/g, " ");
}

function inferLegacyWeekdays(serviceName, openWeekdays) {
  const hasSegQua = REGEX_SEG_QUA.test(serviceName);
  const hasQuiSab = REGEX_QUI_SAB.test(serviceName);
  if (!hasSegQua && !hasQuiSab) {
    return openWeekdays.filter((weekday) => weekday !== 0);
  }
  const band = hasSegQua ? [1, 2, 3] : [4, 5, 6];
  return band.filter((weekday) => openWeekdays.includes(weekday));
}

function leadingCode(name) {
  const match = name.match(/^(\d+)\s*-\s*/);
  return match ? Number(match[1]) : 9999;
}

function mergeWeekdayPriceMaps(maps) {
  const merged = new Map();
  for (const map of maps) {
    for (const [weekday, priceCents] of map.entries()) {
      merged.set(weekday, priceCents);
    }
  }
  return merged;
}

async function countAppointmentUses(serviceId) {
  const { count, error } = await admin
    .from("appointment_services")
    .select("appointment_id", { count: "exact", head: true })
    .eq("service_id", serviceId);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function upsertWeekdayPrices(serviceId, priceMap) {
  const rows = [...priceMap.entries()].map(([weekday, priceCents]) => ({
    service_id: serviceId,
    weekday,
    price_cents: priceCents,
  }));

  await admin
    .from("service_weekday_prices")
    .delete()
    .eq("service_id", serviceId);

  if (rows.length > 0) {
    const { error } = await admin.from("service_weekday_prices").insert(rows);
    if (error) throw new Error(error.message);
  }

  const minPrice = rows.length
    ? Math.min(...rows.map((row) => row.price_cents))
    : 0;

  const { error: updateError } = await admin
    .from("services")
    .update({ price_cents: minPrice })
    .eq("id", serviceId);

  if (updateError) throw new Error(updateError.message);
}

async function main() {
  const [{ data: services, error: servicesError }, { data: businessHours }] =
    await Promise.all([
      admin
        .from("services")
        .select("id, name, price_cents, duration_minutes, active, created_at")
        .order("created_at"),
      admin.from("business_hours").select("weekday, active"),
    ]);

  if (servicesError) throw new Error(servicesError.message);

  const openWeekdays = (businessHours ?? [])
    .filter((row) => row.active)
    .map((row) => row.weekday);

  const groups = new Map();
  for (const service of services ?? []) {
    const cleanName = cleanLegacyServiceName(service.name);
    const key = `${cleanName}::${service.duration_minutes}`;
    const list = groups.get(key) ?? [];
    list.push(service);
    groups.set(key, list);
  }

  let mergedGroups = 0;
  let deactivated = 0;
  let updatedServices = 0;

  for (const [key, members] of groups.entries()) {
    const sorted = [...members].sort(
      (a, b) => leadingCode(a.name) - leadingCode(b.name)
    );
    const canonical = sorted[0];
    const cleanName = key.split("::")[0];

    const priceMaps = sorted.map((service) => {
      const weekdays = inferLegacyWeekdays(service.name, openWeekdays);
      return new Map(
        weekdays.map((weekday) => [weekday, service.price_cents])
      );
    });
    const mergedPrices = mergeWeekdayPriceMaps(priceMaps);

    const { error: nameError } = await admin
      .from("services")
      .update({ name: cleanName })
      .eq("id", canonical.id);
    if (nameError) throw new Error(nameError.message);

    await upsertWeekdayPrices(canonical.id, mergedPrices);
    updatedServices++;

    if (sorted.length > 1) {
      mergedGroups++;
      for (const duplicate of sorted.slice(1)) {
        const { data: links } = await admin
          .from("professional_services")
          .select("professional_id")
          .eq("service_id", duplicate.id);

        if (links?.length) {
          const rows = links.map((link) => ({
            professional_id: link.professional_id,
            service_id: canonical.id,
          }));
          await admin
            .from("professional_services")
            .upsert(rows, { onConflict: "professional_id,service_id" });
        }

        const uses = await countAppointmentUses(duplicate.id);
        if (uses > 0) {
          await admin
            .from("services")
            .update({ active: false })
            .eq("id", duplicate.id);
        } else {
          await admin.from("service_weekday_prices").delete().eq("service_id", duplicate.id);
          await admin.from("professional_services").delete().eq("service_id", duplicate.id);
          await admin.from("services").delete().eq("id", duplicate.id);
        }
        deactivated++;
      }
    }
  }

  console.log(`Serviços atualizados: ${updatedServices}`);
  console.log(`Grupos unificados: ${mergedGroups}`);
  console.log(`Duplicatas removidas/desativadas: ${deactivated}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
