import { BookingSection } from "@/components/booking/booking-section";
import type { ShopCatalog } from "@/lib/get-shop-catalog";
import "@/styles/booking-theme.css";

type BookingPageProps = {
  catalog: ShopCatalog;
  today: string;
};

export function BookingPage({ catalog, today }: BookingPageProps) {
  return (
    <div className="booking-theme relative h-dvh overflow-hidden">
      <BookingSection catalog={catalog} today={today} />
    </div>
  );
}
