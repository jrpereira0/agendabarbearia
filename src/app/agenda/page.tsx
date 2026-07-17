import type { Metadata } from "next";
import { todayInTimezone } from "@/lib/availability";
import { BOOKING_PATH } from "@/lib/booking-path";
import { getShopCatalog } from "@/lib/get-shop-catalog";
import { getShopSeo } from "@/lib/get-shop-seo";
import { BookingPage } from "@/components/booking/booking-page";
import { BookingUnavailable } from "@/components/booking/booking-unavailable";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { name, shareDescription } = await getShopSeo();

  return {
    title: { absolute: name },
    description: shareDescription,
    openGraph: {
      type: "website",
      locale: "pt_BR",
      url: BOOKING_PATH,
      siteName: name,
      title: name,
      description: shareDescription,
    },
    twitter: {
      card: "summary_large_image",
      title: name,
      description: shareDescription,
    },
  };
}

export default async function AgendaPublicPage() {
  try {
    const catalog = await getShopCatalog();
    return <BookingPage catalog={catalog} today={todayInTimezone()} />;
  } catch {
    return <BookingUnavailable />;
  }
}
