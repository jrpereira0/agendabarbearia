/** Cálculos do arraste de cards na grade do painel (snap + validação local). */

import { minutesToTime, type MinuteRange } from "@/lib/availability";
import { isActiveAppointmentStatus } from "@/lib/appointment-status";

/** Só atendimentos ativos e da agenda de quem está logado podem ser arrastados. */
export function canDragAppointment(
  appointment: {
    status: string;
    professionalId: string;
    isComandaExtra?: boolean;
  },
  options: {
    canEditAppointments: boolean;
    isOwner: boolean;
    sessionProfessionalId: string | null;
  }
): boolean {
  if (!options.canEditAppointments) return false;
  if (appointment.isComandaExtra) return false;
  if (!isActiveAppointmentStatus(appointment.status)) return false;
  if (
    !options.isOwner &&
    appointment.professionalId !== options.sessionProfessionalId
  ) {
    return false;
  }
  return true;
}

/**
 * Limites horizontais de cada coluna de barbeiro, medidos ao iniciar o arraste,
 * em coordenadas do documento (rolar a tela não invalida a medida).
 */
export type AgendaColumnBounds = {
  professionalId: string;
  left: number;
  right: number;
};

/** Coluna sob o ponteiro; fora da grade, usa a coluna mais próxima. */
export function columnAtX(
  columns: AgendaColumnBounds[],
  x: number
): string | null {
  if (columns.length === 0) return null;

  const inside = columns.find((col) => x >= col.left && x < col.right);
  if (inside) return inside.professionalId;

  let closest = columns[0]!;
  let closestDistance = Number.POSITIVE_INFINITY;

  for (const col of columns) {
    const distance =
      x < col.left ? col.left - x : x >= col.right ? x - col.right : 0;
    if (distance < closestDistance) {
      closestDistance = distance;
      closest = col;
    }
  }

  return closest.professionalId;
}

export type SnapStartInput = {
  originStartMinutes: number;
  durationMinutes: number;
  /** Quanto o ponteiro andou na vertical desde o clique. */
  deltaY: number;
  rowHeight: number;
  slotStepMinutes: number;
  gridStart: number;
  gridEnd: number;
};

/** Novo início alinhado à linha da grade, sem sair do dia exibido. */
export function snapStartMinutes({
  originStartMinutes,
  durationMinutes,
  deltaY,
  rowHeight,
  slotStepMinutes,
  gridStart,
  gridEnd,
}: SnapStartInput): number {
  const steps = rowHeight > 0 ? Math.round(deltaY / rowHeight) : 0;
  const raw = originStartMinutes + steps * slotStepMinutes;
  const aligned =
    gridStart +
    Math.round((raw - gridStart) / slotStepMinutes) * slotStepMinutes;

  // Cards que já terminam depois da grade não devem ser puxados pra trás sozinhos.
  const maxStart = Math.max(
    gridStart,
    originStartMinutes,
    gridEnd - durationMinutes
  );

  return Math.min(Math.max(aligned, gridStart), maxStart);
}

function rangeFitsInRanges(
  start: number,
  end: number,
  ranges: MinuteRange[]
): boolean {
  return ranges.some((range) => start >= range.start && end <= range.end);
}

export type AgendaMoveTargetColumn = {
  professionalId: string;
  nickname: string;
  serviceIds: string[];
  availableRanges: MinuteRange[];
  blockRanges: MinuteRange[];
};

export type AgendaMoveValidationInput = {
  appointmentId: string;
  /** Encaixe pode dividir horário com outro atendimento. */
  isSqueezeIn: boolean;
  serviceIds: string[];
  durationMinutes: number;
  targetStartMinutes: number;
  target: AgendaMoveTargetColumn;
  /** Atendimentos que ocupam a coluna alvo (encaixes já excluídos). */
  busy: { appointmentId: string; start: number; end: number }[];
  isOwner: boolean;
  sessionProfessionalId: string | null;
};

export type AgendaMoveValidation = { ok: true } | { ok: false; error: string };

/**
 * Espelha as regras da server action pra dar resposta imediata no arraste.
 * O servidor continua validando tudo de novo antes de salvar.
 */
export function validateAgendaMove(
  input: AgendaMoveValidationInput
): AgendaMoveValidation {
  const start = input.targetStartMinutes;
  const end = start + input.durationMinutes;

  if (
    !input.isOwner &&
    input.target.professionalId !== input.sessionProfessionalId
  ) {
    return {
      ok: false,
      error: "Você só pode mover atendimentos na sua própria agenda.",
    };
  }

  const targetServices = new Set(input.target.serviceIds);
  if (!input.serviceIds.every((id) => targetServices.has(id))) {
    return {
      ok: false,
      error: `${input.target.nickname} não faz um dos serviços deste atendimento.`,
    };
  }

  if (end > 24 * 60) {
    return {
      ok: false,
      error: "O atendimento passaria da meia-noite.",
    };
  }

  if (!input.isSqueezeIn) {
    const conflict = input.busy.some(
      (slot) =>
        slot.appointmentId !== input.appointmentId &&
        start < slot.end &&
        end > slot.start
    );

    if (conflict) {
      return {
        ok: false,
        error: `${minutesToTime(start)} já está ocupado nessa coluna.`,
      };
    }
  }

  if (!input.isOwner) {
    if (!rangeFitsInRanges(start, end, input.target.availableRanges)) {
      return {
        ok: false,
        error: "Esse horário está fora do expediente.",
      };
    }

    const blocked = input.target.blockRanges.some(
      (range) => start < range.end && end > range.start
    );
    if (blocked) {
      return {
        ok: false,
        error: "Esse horário está bloqueado na agenda.",
      };
    }
  }

  return { ok: true };
}
