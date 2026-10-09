const {
  MercadoPagoProcesador,
  armarPreferencia,
  normalizarPago,
} = require("../../src/pagos/MercadoPagoProcesador");

const PEDIDO = {
  numero: "VEL-4K7Q2X",
  total: "17000.00",
  email: "clienta@example.com",
  expiraEn: new Date("2026-10-09T21:00:00.000Z"),
};
const PRODUCCION = { urlWeb: "https://veluanature.com.ar", urlApi: "https://api.veluanature.com.ar" };
const LOCAL = { urlWeb: "http://localhost:5173", urlApi: "http://localhost:3000" };

describe("armarPreferencia", () => {
  it("cobra un único ítem por el total, en pesos", () => {
    const c = armarPreferencia(PEDIDO, PRODUCCION);

    expect(c.items).toEqual([
      expect.objectContaining({ quantity: 1, unit_price: 17000, currency_id: "ARS" }),
    ]);
  });

  it("usa el número de pedido como referencia y como vuelta", () => {
    const c = armarPreferencia(PEDIDO, PRODUCCION);

    expect(c.external_reference).toBe("VEL-4K7Q2X");
    expect(c.back_urls.success).toBe("https://veluanature.com.ar/pedido/VEL-4K7Q2X");
  });

  it("vence a la misma hora que la reserva, con zona horaria explícita", () => {
    const c = armarPreferencia(PEDIDO, PRODUCCION);

    expect(c.expires).toBe(true);
    expect(c.expiration_date_to).toBe("2026-10-09T21:00:00.000+00:00");
  });

  it("en producción agrega auto_return y el webhook", () => {
    const c = armarPreferencia(PEDIDO, PRODUCCION);

    expect(c.auto_return).toBe("approved");
    expect(c.notification_url).toBe("https://api.veluanature.com.ar/api/v1/webhooks/mercadopago");
  });

  it("en local los omite, porque Mercado Pago rechaza URLs que no son https", () => {
    const c = armarPreferencia(PEDIDO, LOCAL);

    expect(c).not.toHaveProperty("auto_return");
    expect(c).not.toHaveProperty("notification_url");
  });
});

describe("normalizarPago", () => {
  it("traduce el pago y deja el monto como cadena decimal", () => {
    const p = normalizarPago({
      id: 123456,
      status: "approved",
      status_detail: "accredited",
      external_reference: "VEL-4K7Q2X",
      transaction_amount: 17000,
      currency_id: "ARS",
      payment_method_id: "visa",
    });

    expect(p).toEqual({
      id: "123456",
      estado: "approved",
      detalle: "accredited",
      referencia: "VEL-4K7Q2X",
      monto: "17000.00",
      moneda: "ARS",
      metodo: "visa",
    });
  });
});

describe("MercadoPagoProcesador", () => {
  const crear = (clientes) => new MercadoPagoProcesador({ ...PRODUCCION, clientes });

  it("crearPreferencia devuelve el id y la URL de pago", async () => {
    const preferencias = { create: jest.fn().mockResolvedValue({ id: "pref-1", init_point: "https://mp/pagar" }) };
    const r = await crear({ preferencias, pagos: {} }).crearPreferencia(PEDIDO);

    expect(r).toEqual({ preferenciaId: "pref-1", urlPago: "https://mp/pagar" });
    expect(preferencias.create).toHaveBeenCalledWith({ body: expect.objectContaining({ external_reference: "VEL-4K7Q2X" }) });
  });

  it("obtenerPago consulta por id y normaliza", async () => {
    const pagos = { get: jest.fn().mockResolvedValue({ id: 9, status: "rejected", transaction_amount: 100, currency_id: "ARS" }) };
    const r = await crear({ preferencias: {}, pagos }).obtenerPago("9");

    expect(pagos.get).toHaveBeenCalledWith({ id: "9" });
    expect(r).toEqual(expect.objectContaining({ id: "9", estado: "rejected", monto: "100.00" }));
  });

  it("si Mercado Pago falla, lanza PROCESADOR_NO_DISPONIBLE con la causa", async () => {
    const causa = new Error("timeout");
    const preferencias = { create: jest.fn().mockRejectedValue(causa) };

    await expect(crear({ preferencias, pagos: {} }).crearPreferencia(PEDIDO)).rejects.toMatchObject({
      message: "PROCESADOR_NO_DISPONIBLE",
      cause: causa,
    });
  });

  it("sin access token no rompe al arrancar, pero falla al usarse", async () => {
    const p = new MercadoPagoProcesador({ accessToken: "", ...PRODUCCION });

    await expect(p.obtenerPago("1")).rejects.toThrow("PROCESADOR_NO_CONFIGURADO");
  });
});