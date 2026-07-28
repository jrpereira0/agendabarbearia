import { describe, expect, it } from "vitest";
import {
  canDragAppointment,
  columnAtX,
  snapStartMinutes,
  validateAgendaMove,
  type AgendaMoveValidationInput,
} from "@/lib/agenda-drag";

const columns = [
  { professionalId: "a", left: 100, right: 200 },
  { professionalId: "b", left: 200, right: 300 },
];

describe("columnAtX", () => {
  it("acha a coluna sob o ponteiro", () => {
    expect(columnAtX(columns, 150)).toBe("a");
    expect(columnAtX(columns, 250)).toBe("b");
  });

  it("usa a coluna mais próxima quando o ponteiro sai da grade", () => {
    expect(columnAtX(columns, 40)).toBe("a");
    expect(columnAtX(columns, 900)).toBe("b");
  });

  it("devolve nulo sem colunas", () => {
    expect(columnAtX([], 150)).toBeNull();
  });
});

describe("canDragAppointment", () => {
  const owner = {
    canEditAppointments: true,
    isOwner: true,
    sessionProfessionalId: null,
  };
  const apt = { status: "scheduled", professionalId: "pro-1" };

  it("permite atendimento ativo pra quem pode editar", () => {
    expect(canDragAppointment(apt, owner)).toBe(true);
  });

  it("bloqueia sem permissão de edição", () => {
    expect(
      canDragAppointment(apt, { ...owner, canEditAppointments: false })
    ).toBe(false);
  });

  it("bloqueia cancelado, atendido e serviço extra", () => {
    expect(canDragAppointment({ ...apt, status: "cancelled" }, owner)).toBe(
      false
    );
    expect(canDragAppointment({ ...apt, status: "done" }, owner)).toBe(false);
    expect(canDragAppointment({ ...apt, isComandaExtra: true }, owner)).toBe(
      false
    );
  });

  it("barbeiro só arrasta card da própria coluna", () => {
    const barber = {
      canEditAppointments: true,
      isOwner: false,
      sessionProfessionalId: "pro-2",
    };
    expect(canDragAppointment(apt, barber)).toBe(false);
    expect(
      canDragAppointment({ ...apt, professionalId: "pro-2" }, barber)
    ).toBe(true);
  });
});

const snapBase = {
  originStartMinutes: 10 * 60,
  durationMinutes: 30,
  rowHeight: 20,
  slotStepMinutes: 15,
  gridStart: 8 * 60,
  gridEnd: 20 * 60,
};

describe("snapStartMinutes", () => {
  it("mantém o horário enquanto o arraste não passa de meia linha", () => {
    expect(snapStartMinutes({ ...snapBase, deltaY: 9 })).toBe(10 * 60);
  });

  it("desce uma linha por altura de linha arrastada", () => {
    expect(snapStartMinutes({ ...snapBase, deltaY: 20 })).toBe(10 * 60 + 15);
    expect(snapStartMinutes({ ...snapBase, deltaY: 82 })).toBe(11 * 60);
  });

  it("sobe ao arrastar pra cima", () => {
    expect(snapStartMinutes({ ...snapBase, deltaY: -40 })).toBe(9 * 60 + 30);
  });

  it("não passa do começo nem do fim da grade", () => {
    expect(snapStartMinutes({ ...snapBase, deltaY: -5000 })).toBe(8 * 60);
    expect(snapStartMinutes({ ...snapBase, deltaY: 5000 })).toBe(
      20 * 60 - 30
    );
  });

  it("não puxa pra trás um card que já termina depois da grade", () => {
    expect(
      snapStartMinutes({
        ...snapBase,
        originStartMinutes: 19 * 60 + 45,
        durationMinutes: 60,
        deltaY: 3,
      })
    ).toBe(19 * 60 + 45);
  });
});

const validationBase: AgendaMoveValidationInput = {
  appointmentId: "apt-1",
  isSqueezeIn: false,
  serviceIds: ["svc-1"],
  durationMinutes: 30,
  targetStartMinutes: 10 * 60,
  target: {
    professionalId: "pro-1",
    nickname: "Bruno",
    serviceIds: ["svc-1", "svc-2"],
    availableRanges: [{ start: 9 * 60, end: 18 * 60 }],
    blockRanges: [],
  },
  busy: [],
  isOwner: true,
  sessionProfessionalId: null,
};

describe("validateAgendaMove", () => {
  it("aceita o destino livre", () => {
    expect(validateAgendaMove(validationBase)).toEqual({ ok: true });
  });

  it("recusa quando o barbeiro não faz o serviço", () => {
    const result = validateAgendaMove({
      ...validationBase,
      serviceIds: ["svc-9"],
    });
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toContain("Bruno");
  });

  it("recusa horário ocupado por outro atendimento", () => {
    const result = validateAgendaMove({
      ...validationBase,
      busy: [
        { appointmentId: "apt-2", start: 10 * 60 + 15, end: 11 * 60 },
      ],
    });
    expect(result.ok).toBe(false);
  });

  it("ignora o próprio atendimento ao checar conflito", () => {
    expect(
      validateAgendaMove({
        ...validationBase,
        busy: [{ appointmentId: "apt-1", start: 10 * 60, end: 11 * 60 }],
      })
    ).toEqual({ ok: true });
  });

  it("deixa encaixe dividir horário", () => {
    expect(
      validateAgendaMove({
        ...validationBase,
        isSqueezeIn: true,
        busy: [{ appointmentId: "apt-2", start: 10 * 60, end: 11 * 60 }],
      })
    ).toEqual({ ok: true });
  });

  it("recusa outra coluna quando não é o dono", () => {
    const result = validateAgendaMove({
      ...validationBase,
      isOwner: false,
      sessionProfessionalId: "pro-2",
    });
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toContain("própria agenda");
  });

  it("barbeiro não pode sair do expediente nem cair em bloqueio", () => {
    const outside = validateAgendaMove({
      ...validationBase,
      isOwner: false,
      sessionProfessionalId: "pro-1",
      targetStartMinutes: 8 * 60,
    });
    expect(outside.ok).toBe(false);

    const blocked = validateAgendaMove({
      ...validationBase,
      isOwner: false,
      sessionProfessionalId: "pro-1",
      target: {
        ...validationBase.target,
        blockRanges: [{ start: 10 * 60, end: 10 * 60 + 30 }],
      },
    });
    expect(blocked.ok).toBe(false);
  });

  it("dono pode mover pra fora do expediente e sobre bloqueio", () => {
    expect(
      validateAgendaMove({
        ...validationBase,
        targetStartMinutes: 8 * 60,
        target: {
          ...validationBase.target,
          blockRanges: [{ start: 8 * 60, end: 9 * 60 }],
        },
      })
    ).toEqual({ ok: true });
  });

  it("recusa atendimento que passaria da meia-noite", () => {
    const result = validateAgendaMove({
      ...validationBase,
      targetStartMinutes: 23 * 60 + 45,
      durationMinutes: 30,
    });
    expect(result.ok).toBe(false);
  });
});
