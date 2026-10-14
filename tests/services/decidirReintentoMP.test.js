const { decidirReintentoMP } = require("../../src/services/decidirReintentoMP");

const PEDIDO = { total: "8500.00" };

const pago = (id, estado, monto = "8500.00", moneda = "ARS") => ({
  id,
  estado,
  referencia: "VEL-UZQ4ZU",
  monto,
  moneda,
  metodo: "master",
});

const decidir = (pagos) => decidirReintentoMP({ pagos, pedido: PEDIDO });

describe("decidirReintentoMP", () => {
  describe("permite el link solo si no hubo cobro posible", () => {
    it("sin pagos, permite", () => {
      expect(decidir([])).toEqual({ permitir: true, motivo: "SIN_PAGO_APROBADO", revisar: false });
    });

    it.each(["rejected", "cancelled", "refunded", "charged_back"])(
      "con pagos %s, permite",
      (estado) => {
        expect(decidir([pago("1", estado)]).permitir).toBe(true);
      }
    );
  });

  describe("con un pago aprobado, no da otro link", () => {
    it("un aprobado válido: ya pagado, aplicar ese pago, sin revisión", () => {
      const aprobado = pago("1", "approved");
      expect(decidir([pago("2", "rejected"), aprobado])).toEqual({
        permitir: false,
        codigo: "PEDIDO_YA_PAGADO",
        motivo: "PAGO_APROBADO",
        pagoAAplicar: aprobado,
        revisar: false,
      });
    });

    it("dos aprobados: ya pagado para la clienta, aplica el más viejo y va a revisión", () => {
      const nuevo = pago("2", "approved");
      const viejo = pago("1", "approved");
      expect(decidir([nuevo, viejo])).toEqual({
        permitir: false,
        codigo: "PEDIDO_YA_PAGADO",
        motivo: "PAGO_DUPLICADO",
        pagoAAplicar: viejo,
        revisar: true,
        pagosAprobados: ["2", "1"],
      });
    });

    it.each([
      ["otro monto", pago("1", "approved", "100.00")],
      ["otra moneda", pago("1", "approved", "8500.00", "USD")],
    ])("aprobado con %s: en revisión, sin aplicar", (_caso, aprobado) => {
      const resultado = decidir([aprobado]);
      expect(resultado).toEqual({
        permitir: false,
        codigo: "PEDIDO_EN_REVISION",
        motivo: "MONTO_NO_COINCIDE",
        revisar: true,
        pagosAprobados: ["1"],
      });
      expect(resultado.pagoAAplicar).toBeUndefined();
    });
  });

  describe("con un pago que todavía puede cobrarse, no da otro link", () => {
    it.each(["pending", "in_process", "authorized"])(
      "con un pago %s: pago en proceso",
      (estado) => {
        expect(decidir([pago("2", estado), pago("1", "rejected")])).toEqual({
          permitir: false,
          codigo: "PAGO_EN_PROCESO",
          motivo: "PAGO_EN_CURSO",
          revisar: false,
        });
      }
    );
  });

  describe("ante la duda, no da link y pide revisión", () => {
    it("con un estado desconocido (in_mediation)", () => {
      expect(decidir([pago("1", "in_mediation")])).toEqual({
        permitir: false,
        codigo: "PEDIDO_EN_REVISION",
        motivo: "ESTADO_DESCONOCIDO",
        revisar: true,
      });
    });
  });
});
