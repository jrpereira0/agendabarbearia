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
import { ConfirmationMessageForm } from "@/components/admin/confirmation-message-form";
import { ADMIN_SURFACE } from "@/lib/admin-surface";
import { cn } from "@/lib/utils";

type SettingsViewProps = {
  profile: ShopProfileValues;
  businessDays: BusinessDay[];
  slotStepMinutes: number;
  exceptions: ExceptionItem[];
  professionals: { id: string; nickname: string }[];
  confirmationWhatsappMessage: string;
  confirmationWhatsappEnabled: boolean;
};

export function SettingsView({
  profile,
  businessDays,
  slotStepMinutes,
  exceptions,
  professionals,
  confirmationWhatsappMessage,
  confirmationWhatsappEnabled,
}: SettingsViewProps) {
  return (
    <Tabs defaultValue="perfil" className="flex w-full flex-col gap-4">
      <div className="-mx-1 overflow-x-auto px-1 pb-0.5">
        <TabsList className="h-auto w-max min-w-full flex-nowrap justify-start gap-1 rounded-xl border border-white/10 bg-white/[0.04] p-1">
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
          <TabsTrigger value="mensagens" className="flex-none px-3">
            Mensagens
          </TabsTrigger>
          <TabsTrigger value="integracoes" className="flex-none px-3">
            Integrações
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="perfil" className="mt-0">
        <ShopProfileForm initialValues={profile} />
      </TabsContent>

      <TabsContent value="horarios" className="mt-0">
        <BusinessHoursForm
          initialDays={businessDays}
          initialSlotStep={slotStepMinutes}
        />
      </TabsContent>

      <TabsContent value="excecoes" className="mt-0">
        <ExceptionsCard
          exceptions={exceptions}
          professionals={professionals}
        />
      </TabsContent>

      <TabsContent value="mensagens" className="mt-0">
        <ConfirmationMessageForm
          initialMessage={confirmationWhatsappMessage}
          initialEnabled={confirmationWhatsappEnabled}
          shopName={profile.shopName}
        />
      </TabsContent>

      <TabsContent value="integracoes" className="mt-0">
        <div className={cn(ADMIN_SURFACE.panel, "overflow-hidden p-0")}>
          <Link
            href="/admin/configuracoes/integracoes"
            className="flex items-center justify-between gap-3 px-4 py-3.5 transition-colors hover:bg-white/[0.04] sm:gap-4 sm:px-5 sm:py-4"
          >
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-[#1a1b1e] sm:size-10">
                <KeyRound className={cn("size-4", ADMIN_SURFACE.accent)} />
              </div>
              <div className="min-w-0">
                <p className="text-[15px] font-medium tracking-tight text-[#f5f5f5]">
                  Integrações e API
                </p>
                <p className={cn("mt-0.5 text-xs sm:text-sm", ADMIN_SURFACE.muted)}>
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
