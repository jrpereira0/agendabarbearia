import { describe, expect, it } from "vitest";
import {
  groupServicesForBooking,
  sortServicesByPopularity,
} from "@/lib/booking-service-groups";
import type { PublicService } from "@/lib/get-shop-catalog";

function makeService(
  id: string,
  name: string,
  bookingCount = 0
): PublicService {
  return {
    id,
    name,
    description: "",
    photoUrl: null,
    photoPosition: "50% 50%",
    durationMinutes: 30,
    priceCents: 6000,
    priceFrom: false,
    weekdayPrices: [],
    bookingCount,
  };
}

describe("booking-service-groups", () => {
  it("ordena por quantidade de agendamentos", () => {
    const services = [
      makeService("a", "Barba", 2),
      makeService("b", "Corte", 10),
      makeService("c", "Sobrancelha", 5),
    ];

    expect(sortServicesByPopularity(services).map((s) => s.id)).toEqual([
      "b",
      "c",
      "a",
    ]);
  });

  it("separa os mais agendados dos demais", () => {
    const services = [
      makeService("a", "Barba", 1),
      makeService("b", "Corte", 20),
      makeService("c", "Sobrancelha", 15),
      makeService("d", "Combo", 0),
    ];

    const { popular, others } = groupServicesForBooking(services);
    expect(popular.map((s) => s.id)).toEqual(["b", "c", "a"]);
    expect(others.map((s) => s.id)).toEqual(["d"]);
  });

  it("na busca mostra lista única ordenada", () => {
    const services = [
      makeService("a", "Barba", 1),
      makeService("b", "Corte", 20),
    ];

    const { popular, others } = groupServicesForBooking(services, {
      searching: true,
    });
    expect(popular).toHaveLength(0);
    expect(others.map((s) => s.id)).toEqual(["b", "a"]);
  });
});
