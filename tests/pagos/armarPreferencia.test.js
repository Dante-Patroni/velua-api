const { armarPreferencia } = require("../../src/pagos/MercadoPagoProcesador");

const PEDIDO = {
  numero: "VEL-TEST01",
  total: "8500.00",
  email: "clienta@ejemplo.com",
  expiraEn: new Date("2026-10-14T15:00:00.000Z"),
};
const URLS = { urlWeb: "https://veluanature.com.ar", urlApi: "https://api.veluanature.com.ar" };
const VENCE = "2026-10-14T15:00:00.000+00:00";

describe("armarPreferencia", () => {
  const cuerpo = armarPreferencia(PEDIDO, URLS);

  it("usa el número del pedido como referencia externa", () => {
    expect(cuerpo.external_reference).toBe("VEL-TEST01");
  });

  it("el checkout vence con la reserva", () => {
    expect(cuerpo.expires).toBe(true);
    expect(cuerpo.expiration_date_to).toBe(VENCE);
  });

  it("los cupones en efectivo también vencen con la reserva", () => {
    expect(cuerpo.date_of_expiration).toBe(VENCE);
  });

  it("excluye los medios de pago lentos (ver DECISIONES.md)", () => {
    expect(cuerpo.payment_methods.excluded_payment_types).toEqual(
      expect.arrayContaining([{ id: "ticket" }, { id: "atm" }])
    );
  });
});
