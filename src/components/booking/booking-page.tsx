import { ShopHero } from "@/components/booking/shop-hero";
import { BookingSection } from "@/components/booking/booking-section";
import type { ShopCatalog } from "@/lib/get-shop-catalog";
import "@/styles/booking-theme.css";

type BookingPageProps = {
  catalog: ShopCatalog;
  today: string;
};

export function BookingPage({ catalog, today }: BookingPageProps) {
  return (
    <div className="booking-theme relative flex min-h-dvh flex-col overflow-x-hidden">
      <div
        aria-hidden
        className="booking-glow pointer-events-none absolute inset-x-0 top-0 h-[50vh]"
      />
      <div
        aria-hidden
        className="booking-grid pointer-events-none absolute inset-x-0 top-0 h-[45vh]"
      />

      <ShopHero shop={catalog.shop} businessHours={catalog.businessHours} />

      <main
        id="agendar"
        className="booking-main relative z-10 flex-1 scroll-mt-3 rounded-t-[1.75rem] border-t px-4 pb-8 pt-2 sm:px-6 sm:pb-10 sm:pt-8"
      >
        <div className="mx-auto w-full max-w-lg">
          <BookingSection catalog={catalog} today={today} />
        </div>
      </main>
    </div>
  );
}
