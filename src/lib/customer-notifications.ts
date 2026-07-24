import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeWhatsapp, whatsappLookupKeys } from "@/lib/whatsapp";

export type CustomerNotification = {
  id: string;
  title: string;
  body: string;
  type: string;
  data: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
};

export async function createCustomerNotification(input: {
  whatsapp: string;
  title: string;
  body: string;
  type: string;
  data?: Record<string, unknown>;
}): Promise<CustomerNotification | null> {
  const whatsapp = normalizeWhatsapp(input.whatsapp);
  if (!whatsapp) return null;

  const admin = createAdminClient();
  if (!admin) return null;

  const { data, error } = await admin
    .from("customer_notifications")
    .insert({
      whatsapp,
      title: input.title.trim(),
      body: input.body.trim(),
      type: input.type.trim() || "general",
      data: input.data ?? {},
    })
    .select("id, title, body, type, data, read_at, created_at")
    .maybeSingle();

  if (error || !data) {
    console.warn("[customer-notifications] falha ao criar", error?.message);
    return null;
  }

  return mapRow(data);
}

export async function listCustomerNotifications(
  rawWhatsapp: string,
  options?: { limit?: number }
): Promise<CustomerNotification[]> {
  const whatsapp = normalizeWhatsapp(rawWhatsapp);
  if (!whatsapp) return [];

  const admin = createAdminClient();
  if (!admin) return [];

  const limit = Math.min(Math.max(options?.limit ?? 50, 1), 100);

  const { data, error } = await admin
    .from("customer_notifications")
    .select("id, title, body, type, data, read_at, created_at")
    .in("whatsapp", whatsappLookupKeys(whatsapp))
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return data.map(mapRow);
}

export async function countUnreadCustomerNotifications(
  rawWhatsapp: string
): Promise<number> {
  const whatsapp = normalizeWhatsapp(rawWhatsapp);
  if (!whatsapp) return 0;

  const admin = createAdminClient();
  if (!admin) return 0;

  const { count, error } = await admin
    .from("customer_notifications")
    .select("id", { count: "exact", head: true })
    .in("whatsapp", whatsappLookupKeys(whatsapp))
    .is("read_at", null);

  if (error) return 0;
  return count ?? 0;
}

export async function markCustomerNotificationRead(input: {
  whatsapp: string;
  notificationId: string;
}): Promise<boolean> {
  const whatsapp = normalizeWhatsapp(input.whatsapp);
  if (!whatsapp) return false;

  const admin = createAdminClient();
  if (!admin) return false;

  const now = new Date().toISOString();
  const { error } = await admin
    .from("customer_notifications")
    .update({ read_at: now })
    .eq("id", input.notificationId)
    .in("whatsapp", whatsappLookupKeys(whatsapp))
    .is("read_at", null);

  return !error;
}

export async function markAllCustomerNotificationsRead(
  rawWhatsapp: string
): Promise<number> {
  const whatsapp = normalizeWhatsapp(rawWhatsapp);
  if (!whatsapp) return 0;

  const admin = createAdminClient();
  if (!admin) return 0;

  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("customer_notifications")
    .update({ read_at: now })
    .in("whatsapp", whatsappLookupKeys(whatsapp))
    .is("read_at", null)
    .select("id");

  if (error) return 0;
  return data?.length ?? 0;
}

function mapRow(row: {
  id: string;
  title: string;
  body: string;
  type: string;
  data: unknown;
  read_at: string | null;
  created_at: string;
}): CustomerNotification {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    type: row.type,
    data:
      row.data && typeof row.data === "object" && !Array.isArray(row.data)
        ? (row.data as Record<string, unknown>)
        : {},
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}
