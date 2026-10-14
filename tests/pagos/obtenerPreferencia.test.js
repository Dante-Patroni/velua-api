const { MercadoPagoProcesador } = require("../../src/pagos/MercadoPagoProcesador");

const conPreferencias = (preferencias) =>
  new MercadoPagoProcesador({ clientes: { preferencias, pagos: {} } });

describe("MercadoPagoProcesador.obtenerPreferencia", () => {
  it("devuelve el link y el vencimiento de la preferencia", async () => {
    const get = jest.fn().mockResolvedValue({
      id: "pref-1",
      init_point: "https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=pref-1",
      expiration_date_to: "2026-10-14T15:00:00.000+00:00",
    });
    const procesador = conPreferencias({ get });

    await expect(procesador.obtenerPreferencia("pref-1")).resolves.toEqual({
      urlPago: "https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=pref-1",
      venceEn: new Date("2026-10-14T15:00:00.000Z"),
    });
    expect(get).toHaveBeenCalledWith({ preferenceId: "pref-1" });
  });

  it("sin vencimiento, venceEn es null", async () => {
    const get = jest.fn().mockResolvedValue({ id: "pref-1", init_point: "https://mp/x" });

    await expect(conPreferencias({ get }).obtenerPreferencia("pref-1")).resolves.toEqual({
      urlPago: "https://mp/x",
      venceEn: null,
    });
  });

  it("un 404 lanza PREFERENCIA_NO_ENCONTRADA, con la causa", async () => {
    const causa = { status: 404, error: "not_found", message: "Preference not found" };
    const get = jest.fn().mockRejectedValue(causa);

    await expect(conPreferencias({ get }).obtenerPreferencia("pref-x")).rejects.toMatchObject({
      message: "PREFERENCIA_NO_ENCONTRADA",
      cause: causa,
    });
  });

  it("otro status sigue siendo PROCESADOR_NO_DISPONIBLE (no da link)", async () => {
    const causa = { status: 500, error: "internal_error" };
    const get = jest.fn().mockRejectedValue(causa);

    await expect(conPreferencias({ get }).obtenerPreferencia("pref-1")).rejects.toMatchObject({
      message: "PROCESADOR_NO_DISPONIBLE",
      cause: causa,
    });
  });
});
