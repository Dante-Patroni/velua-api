const { decidirVencimientoMP } = require("../../src/services/decidirVencimientoMP");

const CREADO = new Date("2026-10-11T13:00:00.000Z");
const PEDIDO = { total: "8500.00", creadoEn: CREADO };
const TOPE = 48;
const horas = (h) => new Date(CREADO.getTime() + h * 60 * 60 * 1000);

const pago = (id, estado, monto = "8500.00", moneda = "ARS") => ({
  id,
  estado,
  referencia: "VEL-UZQ4ZU",
  monto,
  moneda,
  metodo: "master",
});

const decidir = (pagos, ahora = horas(1.5)) =>
  decidirVencimientoMP({ pagos, pedido: PEDIDO, ahora, topeHoras: TOPE });

describe("decidirVencimientoMP", () => {
  describe("cancela solo si no hay nada vivo", () => {
    it("sin pagos, cancela", () => {
      expect(decidir([])).toEqual({ accion: "cancelar", motivo: "SIN_PAGO_APROBADO" });
    });

    it("con todos los pagos rechazados, cancela", () => {
      expect(decidir([pago("2", "rejected"), pago("1", "rejected")]).accion).toBe("cancelar");
    });

    it("con pagos cancelados o devueltos, cancela", () => {
      expect(decidir([pago("2", "cancelled"), pago("1", "refunded")]).accion).toBe("cancelar");
    });
  });

  describe("aprueba si Mercado Pago tiene un pago aprobado que coincide", () => {
    it("un aprobado: lo aprueba con ese pago", () => {
      const p = pago("1", "approved");
      expect(decidir([p])).toEqual({ accion: "aprobar", motivo: "PAGO_APROBADO", pago: p });
    });

    it("un rechazo y después un aprobado: aprueba con el aprobado", () => {
      const aprobado = pago("2", "approved");
      const r = decidir([aprobado, pago("1", "rejected")]);
      expect(r.accion).toBe("aprobar");
      expect(r.pago).toBe(aprobado);
    });

    it("el aprobado manda aunque haya otro pago en curso", () => {
      expect(decidir([pago("2", "in_process"), pago("1", "approved")]).accion).toBe("aprobar");
    });

    it("dos aprobados: aprueba con el más viejo y avisa el cobro duplicado", () => {
      const viejo = pago("1", "approved");
      const r = decidir([pago("2", "approved"), viejo]);
      expect(r).toEqual({
        accion: "aprobar",
        motivo: "PAGO_DUPLICADO",
        pago: viejo,
        pagosAprobados: ["2", "1"],
      });
    });
  });

  describe("manda a revisión lo que no cuadra, sin cancelar", () => {
    it("un aprobado con otro monto", () => {
      expect(decidir([pago("1", "approved", "100.00")])).toEqual({
        accion: "revisar",
        motivo: "MONTO_NO_COINCIDE",
        pagosAprobados: ["1"],
      });
    });

    it("un aprobado en otra moneda", () => {
      expect(decidir([pago("1", "approved", "8500.00", "USD")]).accion).toBe("revisar");
    });

    it("un pago en curso que pasó el tope", () => {
      expect(decidir([pago("1", "in_process")], horas(TOPE))).toEqual({
        accion: "revisar",
        motivo: "PAGO_EN_CURSO_SIN_RESOLVER",
      });
    });
  });

  describe("posterga mientras haya un pago en curso", () => {
    it("in_process: posterga una hora", () => {
      expect(decidir([pago("1", "in_process")], horas(1.5))).toEqual({
        accion: "postergar",
        motivo: "PAGO_EN_CURSO",
        hasta: horas(2.5),
      });
    });

    it("pending también se posterga", () => {
      expect(decidir([pago("1", "pending")]).accion).toBe("postergar");
    });

    it("cerca del tope, posterga solo hasta el tope", () => {
      const r = decidir([pago("1", "pending")], horas(TOPE - 0.5));
      expect(r.hasta).toEqual(horas(TOPE));
    });
  });

  describe("estados que no se conocen no cancelan", () => {
    it("un contracargo cuenta como sin cobro: cancela", () => {
      expect(decidir([pago("1", "charged_back")]).accion).toBe("cancelar");
    });

    it("un pago en mediación va a revisión: se cobró y está en disputa", () => {
      expect(decidir([pago("1", "in_mediation")])).toEqual({
        accion: "revisar",
        motivo: "ESTADO_DESCONOCIDO",
      });
    });

    it("un estado que Mercado Pago agregue mañana va a revisión", () => {
      expect(decidir([pago("1", "estado_nuevo")]).accion).toBe("revisar");
    });

    it("un rechazo junto a un estado desconocido también va a revisión", () => {
      expect(decidir([pago("2", "in_mediation"), pago("1", "rejected")]).accion).toBe("revisar");
    });
  });
});
