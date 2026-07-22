"use client";

import Link from "next/link";
import { ChevronRight, KeyRound } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ShopProfileForm,
  type ShopProfileValues,
} from "@/components/admin/shop-profile-form";
import {
  BusinessHoursForm,
  type BusinessDay,
} from "@/components/admin/business-hours-form";
import {
  ExceptionsCard,
  type ExceptionItem,
} from "@/components/admin/exceptions-card";
import { ADMIN_SURFACE } from "@/lib/admin-surface";
import { cn } from "@/lib/utils";

type SettingsViewProps = {
  profile: ShopProfileValues;
  businessDays: BusinessDay[];
  slotStepMinutes: number;
  exceptions: ExceptionItem[];
  professionals: { id: string; nickname: string }[];
};

export function SettingsView({
  profile,
  businessDays,
  slotStepMinutes,
  exceptions,
  professionals,
}: SettingsViewProps) {
  return (
    <Tabs defaultValue="perfil" className="w-full">
      <TabsList className="h-auto w-full flex-wrap justify-start gap-1 rounded-xl border border-white/10 bg-white/[0.04] p-1">
        <TabsTrigger value="perfil" className="flex-none px-3">
          Perfil
        </TabsTrigger>
        <TabsTrigger value="horarios" className="flex-none px-3">
          Horários
        </TabsTrigger>
        <TabsTrigger value="excecoes" className="flex-none px-3">
          Dias especiais
          {exceptions.length > 0 ? (
            <span className={cn("tabular-nums", ADMIN_SURFACE.muted)}>
              ({exceptions.length})
            </span>
          ) : null}
        </TabsTrigger>
        <TabsTrigger value="integracoes" className="flex-none px-3">
          Integrações
        </TabsTrigger>
      </TabsList>

      <TabsContent value="perfil" className="mt-4">
        <ShopProfileForm initialValues={profile} />
      </TabsContent>

      <TabsContent value="horarios" className="mt-4">
        <BusinessHoursForm
          initialDays={businessDays}
          initialSlotStep={slotStepMinutes}
        />
      </TabsContent>

      <TabsContent value="excecoes" className="mt-4">
        <ExceptionsCard
          exceptions={exceptions}
          professionals={professionals}
        />
      </TabsContent>

      <TabsContent value="integracoes" className="mt-4">
        <div className={cn(ADMIN_SURFACE.panel, "overflow-hidden p-0")}>
          <Link
            href="/admin/configuracoes/integracoes"
            className="flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-white/[0.04] sm:px-6"
          >
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-[#1a1b1e]">
                <KeyRound className={cn("size-4", ADMIN_SURFACE.accent)} />
              </div>
              <div>
                <p className="text-sm font-medium text-[#f5f5f5]">
                  Integrações e API
                </p>
                <p className={cn("mt-0.5 text-sm", ADMIN_SURFACE.muted)}>
                  Chaves para n8n e outras automações.
                </p>
              </div>
            </div>
            <ChevronRight
              className={cn("size-4 shrink-0", ADMIN_SURFACE.muted)}
            />
          </Link>
        </div>
      </TabsContent>
    </Tabs>
  );
}
