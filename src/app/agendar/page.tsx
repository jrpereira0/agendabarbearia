import { redirect } from "next/navigation";
import { BOOKING_PATH } from "@/lib/booking-path";

export default function AgendarRedirectPage() {
  redirect(BOOKING_PATH);
}
