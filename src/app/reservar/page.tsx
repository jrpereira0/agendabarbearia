import { redirect } from "next/navigation";
import { BOOKING_PATH } from "@/lib/booking-path";

export default function ReservarRedirectPage() {
  redirect(BOOKING_PATH);
}
