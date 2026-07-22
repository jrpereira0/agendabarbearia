import { BookingSection } from "@/components/booking/booking-section";
import type { ShopCatalog } from "@/lib/get-shop-catalog";
import "@/styles/booking-theme.css";

type BookingPageProps = {
  catalog: ShopCatalog;
  today: string;
};

export function BookingPage({ catalog, today }: BookingPageProps) {
  return (
    <div className="booking-theme relative min-h-dvh overflow-x-hidden">
      <div
        aria-hidden
        className="booking-glow pointer-events-none absolute inset-x-0 top-0 h-[40vh]"
      />
      <div
        aria-hidden
        className="booking-grid pointer-events-none absolute inset-x-0 top-0 h-[35vh]"
      />

      <BookingSection catalog={catalog} today={today} />
    </div>
  );
}
