"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  columnAtX,
  snapStartMinutes,
  type AgendaColumnBounds,
} from "@/lib/agenda-drag";

/** Começa a arrastar depois de sair do lugar (não atropela o clique). */
const ACTIVATION_DISTANCE_PX = 6;
/** Janela em que o clique logo após o arraste é ignorado. */
const CLICK_SUPPRESS_MS = 350;

export type AgendaDragCard = {
  appointmentId: string;
  professionalId: string;
  startMinutes: number;
  durationMinutes: number;
};

export type AgendaDragTarget = {
  card: AgendaDragCard;
  professionalId: string;
  startMinutes: number;
  valid: boolean;
  error: string | null;
};

type AgendaDragOptions = {
  enabled: boolean;
  rowHeight: number;
  slotStepMinutes: number;
  gridStart: number;
  gridEnd: number;
  measureColumns: () => AgendaColumnBounds[];
  evaluate: (
    card: AgendaDragCard,
    professionalId: string,
    startMinutes: number
  ) => { valid: boolean; error: string | null };
  onDrop: (
    card: AgendaDragCard,
    professionalId: string,
    startMinutes: number
  ) => void;
  onRejected: (error: string) => void;
};

type DragSession = {
  pointerId: number;
  card: AgendaDragCard;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  active: boolean;
  /** Em algum momento o card saiu do horário/coluna de origem. */
  leftOrigin: boolean;
  columns: AgendaColumnBounds[];
};

export type AgendaCardDrag = {
  /** Destino atual do arraste (nulo quando não está arrastando). */
  target: AgendaDragTarget | null;
  startDrag: (event: React.PointerEvent, card: AgendaDragCard) => void;
  /** O clique que fecha o arraste não deve abrir o card. */
  shouldIgnoreClick: () => boolean;
};

export function useAgendaCardDrag(
  options: AgendaDragOptions
): AgendaCardDrag {
  const optionsRef = useRef(options);
  // Os handlers vivem fora do React (window), então leem sempre a versão nova.
  useEffect(() => {
    optionsRef.current = options;
  });

  const sessionRef = useRef<DragSession | null>(null);
  const suppressClickUntilRef = useRef(0);
  const [target, setTarget] = useState<AgendaDragTarget | null>(null);
  const targetRef = useRef<AgendaDragTarget | null>(null);

  const applyTarget = useCallback((next: AgendaDragTarget | null) => {
    const current = targetRef.current;
    if (
      current &&
      next &&
      current.professionalId === next.professionalId &&
      current.startMinutes === next.startMinutes &&
      current.card.appointmentId === next.card.appointmentId
    ) {
      return;
    }
    targetRef.current = next;
    setTarget(next);
  }, []);

  const computeTarget = useCallback(() => {
    const session = sessionRef.current;
    if (!session?.active) return;

    const {
      rowHeight,
      slotStepMinutes,
      gridStart,
      gridEnd,
      evaluate,
    } = optionsRef.current;

    const professionalId =
      columnAtX(session.columns, session.lastX) ?? session.card.professionalId;
    const startMinutes = snapStartMinutes({
      originStartMinutes: session.card.startMinutes,
      durationMinutes: session.card.durationMinutes,
      deltaY: session.lastY - session.startY,
      rowHeight,
      slotStepMinutes,
      gridStart,
      gridEnd,
    });

    const unchanged =
      professionalId === session.card.professionalId &&
      startMinutes === session.card.startMinutes;
    if (!unchanged) session.leftOrigin = true;

    const check = unchanged
      ? { valid: true, error: null }
      : evaluate(session.card, professionalId, startMinutes);

    applyTarget({
      card: session.card,
      professionalId,
      startMinutes,
      valid: check.valid,
      error: check.error,
    });
  }, [applyTarget]);

  const endSession = useCallback(
    (commit: boolean) => {
      const session = sessionRef.current;
      if (!session) return;

      const wasActive = session.active;
      const leftOrigin = session.leftOrigin;
      const finalTarget = targetRef.current;
      sessionRef.current = null;
      applyTarget(null);

      if (!wasActive) return;

      document.body.classList.remove("agenda-card-dragging");
      // Tremida de mão sem sair do lugar continua valendo como clique no card.
      if (leftOrigin) {
        suppressClickUntilRef.current = Date.now() + CLICK_SUPPRESS_MS;
      }

      if (!commit || !finalTarget) return;

      const moved =
        finalTarget.professionalId !== finalTarget.card.professionalId ||
        finalTarget.startMinutes !== finalTarget.card.startMinutes;
      if (!moved) return;

      if (!finalTarget.valid) {
        optionsRef.current.onRejected(
          finalTarget.error ?? "Não é possível mover para esse horário."
        );
        return;
      }

      optionsRef.current.onDrop(
        finalTarget.card,
        finalTarget.professionalId,
        finalTarget.startMinutes
      );
    },
    [applyTarget]
  );

  const activate = useCallback(() => {
    const session = sessionRef.current;
    if (!session || session.active) return;

    session.active = true;
    session.columns = optionsRef.current.measureColumns();
    document.body.classList.add("agenda-card-dragging");
    computeTarget();
  }, [computeTarget]);

  useEffect(() => {
    function handleMove(event: PointerEvent) {
      const session = sessionRef.current;
      if (!session || event.pointerId !== session.pointerId) return;

      session.lastX = event.pageX;
      session.lastY = event.pageY;

      if (!session.active) {
        const distance = Math.hypot(
          session.lastX - session.startX,
          session.lastY - session.startY
        );
        if (distance < ACTIVATION_DISTANCE_PX) return;
        activate();
        return;
      }

      if (event.cancelable) event.preventDefault();
      computeTarget();
    }

    function handleUp(event: PointerEvent) {
      const session = sessionRef.current;
      if (!session || event.pointerId !== session.pointerId) return;
      endSession(true);
    }

    function handleCancel(event: PointerEvent) {
      const session = sessionRef.current;
      if (!session || event.pointerId !== session.pointerId) return;
      endSession(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (!sessionRef.current) return;
      endSession(false);
    }

    function handleContextMenu(event: MouseEvent) {
      if (!sessionRef.current?.active) return;
      event.preventDefault();
    }

    window.addEventListener("pointermove", handleMove, { passive: false });
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleCancel);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("contextmenu", handleContextMenu);

    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleCancel);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("contextmenu", handleContextMenu);
      document.body.classList.remove("agenda-card-dragging");
    };
  }, [activate, computeTarget, endSession]);

  const startDrag = useCallback(
    (event: React.PointerEvent, card: AgendaDragCard) => {
      if (!optionsRef.current.enabled) return;
      // No toque o arraste brigaria com o rolar da tela: só mouse e caneta.
      if (event.pointerType === "touch") return;
      if (event.button !== 0) return;
      if (sessionRef.current) return;

      const session: DragSession = {
        pointerId: event.pointerId,
        card,
        startX: event.pageX,
        startY: event.pageY,
        lastX: event.pageX,
        lastY: event.pageY,
        active: false,
        leftOrigin: false,
        columns: [],
      };
      sessionRef.current = session;
    },
    []
  );

  const shouldIgnoreClick = useCallback(
    () => Date.now() < suppressClickUntilRef.current,
    []
  );

  return { target, startDrag, shouldIgnoreClick };
}
