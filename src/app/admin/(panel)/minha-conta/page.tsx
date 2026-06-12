import { redirect } from "next/navigation";
import { Clock, Store, User } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getAdminSession } from "@/lib/require-admin";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/admin/page-header";
import { FormSectionTitle } from "@/components/admin/form-section";
import { ChangePasswordForm } from "@/components/admin/change-password-form";
import {
  WeekGridEditor,
  fillWeek,
  type DayRanges,
} from "@/components/admin/week-grid-editor";
import type { BusinessDay } from "@/components/admin/business-hours-form";
import { formatTime, WEEKDAYS } from "@/lib/format";
import { changeMyPassword } from "./actions";

export const metadata = { title: "Minha conta" };

export default async function MyAccountPage() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  if (session.isOwner) redirect("/admin/configuracoes");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: professional }, { data: businessHours }] = await Promise.all([
    supabase
      .from("professionals")
      .select("nickname, working_hours(weekday, start_time, end_time)")
      .eq("profile_id", user!.id)
      .maybeSingle(),
    supabase.from("business_hours").select("*").order("weekday"),
  ]);

  const businessDays: BusinessDay[] = (businessHours ?? []).map((b) => ({
    weekday: b.weekday,
    active: b.active,
    openTime: formatTime(b.open_time),
    closeTime: formatTime(b.close_time),
  }));

  const ownSchedule: DayRanges[] = professional
    ? fillWeek(
        Object.values(
          (professional.working_hours ?? []).reduce(
            (acc, wh) => {
              acc[wh.weekday] ??= { weekday: wh.weekday, ranges: [] };
              acc[wh.weekday].ranges.push({
                startTime: formatTime(wh.start_time),
                endTime: formatTime(wh.end_time),
              });
              return acc;
            },
            {} as Record<number, DayRanges>
          )
        )
      )
    : [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Minha conta"
        description="Sua grade de atendimento e senha de acesso ao painel."
      />

      <Card>
        <CardContent className="flex flex-col gap-4">
          <FormSectionTitle
            icon={User}
            title={professional?.nickname ?? "Seu perfil"}
            description="Dados do seu login no painel."
          />
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">E-mail</dt>
              <dd className="mt-0.5 font-medium">{user?.email ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Apelido na agenda</dt>
              <dd className="mt-0.5 font-medium">
                {professional?.nickname ?? "—"}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-5">
          <FormSectionTitle
            icon={Store}
            title="Horário da barbearia"
            description="Dias e horários em que a loja funciona. Só o dono altera isso."
          />
          <ul className="flex flex-col gap-2 text-sm">
            {businessDays.map((day) => (
              <li
                key={day.weekday}
                className="flex items-center justify-between gap-4 border-b border-dashed py-2 last:border-0"
              >
                <span className="font-medium">{WEEKDAYS[day.weekday]}</span>
                <span className="text-muted-foreground">
                  {day.active
                    ? `${day.openTime} – ${day.closeTime}`
                    : "Fechado"}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {professional && (
        <Card>
          <CardContent className="flex flex-col gap-5">
            <FormSectionTitle
              icon={Clock}
              title="Sua grade de atendimento"
              description="Pra mudar seus horários, fale com o dono da barbearia."
            />
            <WeekGridEditor
              days={ownSchedule}
              businessDays={businessDays}
              readOnly
            />
          </CardContent>
        </Card>
      )}

      <ChangePasswordForm onSubmit={changeMyPassword} />
    </div>
  );
}
