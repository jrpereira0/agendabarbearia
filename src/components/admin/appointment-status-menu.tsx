"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  CONTEXT_MENU_STATUSES,
  STATUS_LABELS,
  type AppointmentStatus,
} from "@/lib/appointment-status";
import { agendaStatusSwatchClass } from "@/lib/agenda-colors";
import { updateAppointmentStatus, cancelAppointmentService } from "@/app/admin/(panel)/agenda/actions";

type ContextMenuStatus = (typeof CONTEXT_MENU_STATUSES)[number];

type AppointmentStatusMenuProps = {
  appointmentId: string;
  currentStatus: AppointmentStatus;
  open: boolean;
  position: { x: number; y: number };
  onClose: () => void;
  /** Quando o card é um serviço específico de um agendamento com vários. */
  serviceIndex?: number | null;
  serviceCount?: number;
};

const MENU_WIDTH = 176;
const MENU_ITEM_HEIGHT = 36;
const MENU_PADDING = 8;

function clampPosition(x: number, y: number, itemCount: number) {
  if (typeof window === "undefined") {
    return { x, y };
  }

  const maxX = window.innerWidth - MENU_WIDTH - MENU_PADDING;
  const maxY =
    window.innerHeight - itemCount * MENU_ITEM_HEIGHT - MENU_PADDING;

  return {
    x: Math.max(MENU_PADDING, Math.min(x, maxX)),
    y: Math.max(MENU_PADDING, Math.min(y, maxY)),
  };
}

export function AppointmentStatusMenu({
  appointmentId,
  currentStatus,
  open,
  position,
  onClose,
  serviceIndex = null,
  serviceCount = 1,
}: AppointmentStatusMenuProps) {
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement>(null);
  const busyRef = useRef(false);

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node | null;
      if (menuRef.current?.contains(target)) return;
      onClose();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    // click (não mousedown) evita fechar o menu antes do item ser selecionado
    window.addEventListener("click", handleClickOutside, true);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", onClose, true);

    return () => {
      window.removeEventListener("click", handleClickOutside, true);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", onClose, true);
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") {
    return null;
  }

  const { x, y } = clampPosition(
    position.x,
    position.y,
    CONTEXT_MENU_STATUSES.length
  );

  async function handleSelect(status: ContextMenuStatus) {
    if (busyRef.current) return;

    if (status === currentStatus) {
      onClose();
      return;
    }

    busyRef.current = true;

    const cancelOnlyThisService =
      status === "cancelled" &&
      serviceCount > 1 &&
      typeof serviceIndex === "number";

    const result = cancelOnlyThisService
      ? await cancelAppointmentService({
          appointmentId,
          serviceIndex,
          reason: "Cancelado pelo status na agenda",
        })
      : await updateAppointmentStatus(appointmentId, status);

    busyRef.current = false;

    if (result.ok) {
      toast.success(
        cancelOnlyThisService
          ? "Serviço cancelado."
          : `Status: ${STATUS_LABELS[status]}`
      );
      onClose();
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      aria-label="Alterar status do agendamento"
      className="fixed z-[100] w-44 rounded-lg border bg-popover p-1 shadow-lg"
      style={{ left: x, top: y }}
      onContextMenu={(event) => event.preventDefault()}
    >
      <p className="px-2.5 py-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        Status
      </p>
      {CONTEXT_MENU_STATUSES.map((status) => {
        const isCurrent = status === currentStatus;
        return (
          <button
            key={status}
            type="button"
            role="menuitemradio"
            aria-checked={isCurrent}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition-colors hover:bg-muted",
              isCurrent && "bg-muted font-medium"
            )}
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              void handleSelect(status);
            }}
          >
            <span
              className={cn(
                "size-3.5 shrink-0 rounded-sm",
                agendaStatusSwatchClass(status)
              )}
              aria-hidden
            />
            {STATUS_LABELS[status]}
          </button>
        );
      })}
    </div>,
    document.body
  );
}
