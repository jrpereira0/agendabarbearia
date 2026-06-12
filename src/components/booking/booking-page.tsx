import { ShopHero } from "@/components/booking/shop-hero";
import { BookingSection } from "@/components/booking/booking-section";
import type { ShopCatalog } from "@/lib/get-shop-catalog";

type BookingPageProps = {
  catalog: ShopCatalog;
  today: string;
};

export function BookingPage({ catalog, today }: BookingPageProps) {
  const activeProfessionals = catalog.professionals.filter(
    (p) => p.serviceIds.length > 0
  );

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <ShopHero
        shop={catalog.shop}
        businessHours={catalog.businessHours}
        professionals={activeProfessionals}
      />

      <main
        id="agendar"
        className="relative flex-1 rounded-t-[1.75rem] bg-background px-4 pb-8 pt-6 sm:px-6 sm:pb-10 sm:pt-8"
      >
        <div className="mx-auto w-full max-w-lg">
          <BookingSection catalog={catalog} today={today} />
        </div>
      </main>
    </div>
  );
}
