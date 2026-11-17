/**
 * La venta y su cotización tienen que calcular con la misma configuración: si
 * fueran dos, la pantalla podría mostrar un total y la venta rechazarlo con
 * TOTAL_CAMBIO, o cobrar otro. Se arma la ruta con los servicios simulados y se
 * mira qué objeto recibió cada uno: el mismo, no uno igual.
 */
// Sin base ni sesión: este test no depende del .env. Los modelos son los que cargan
// el .env (vía config.js), y la sesión exige JWT_SECRET al cargarse.
jest.mock("../../src/models", () => ({}));
jest.mock("../../src/middlewares/authMiddleware", () => ({ authMiddleware: jest.fn() }));
jest.mock("../../src/services/CheckoutService", () => ({ CheckoutService: jest.fn() }));
jest.mock("../../src/services/CotizacionPanelService", () => ({
  CotizacionPanelService: jest.fn(),
}));
jest.mock("../../src/services/cotizador", () => ({
  ...jest.requireActual("../../src/services/cotizador"),
  Cotizador: jest.fn(),
}));

const { CheckoutService } = require("../../src/services/CheckoutService");
const { CotizacionPanelService } = require("../../src/services/CotizacionPanelService");
const { Cotizador } = require("../../src/services/cotizador");
const { configVentaPanel } = require("../../src/config/ventaPanel");

require("../../src/routes/adminVentasRoutes");

// Los servicios se arman una sola vez, al cargar la ruta. La configuración de Jest
// limpia los mocks antes de cada test: se guarda ahora lo que recibieron.
const armados = {
  venta: [...CheckoutService.mock.calls],
  cotizador: [...Cotizador.mock.calls],
  cotizacion: [...CotizacionPanelService.mock.calls],
  instanciaDelCotizador: Cotizador.mock.instances[0],
};

describe("adminVentasRoutes: una sola configuración", () => {
  test("la venta, el cotizador y la cotización reciben el mismo objeto", () => {
    expect(armados.venta).toHaveLength(1);
    expect(armados.cotizador).toHaveLength(1);
    expect(armados.cotizacion).toHaveLength(1);

    expect(armados.venta[0][1]).toBe(configVentaPanel);
    expect(armados.cotizador[0][1]).toBe(configVentaPanel);
    expect(armados.cotizacion[0][1]).toBe(configVentaPanel);
  });

  test("la cotización usa el cotizador que se armó para ella", () => {
    expect(armados.cotizacion[0][0]).toBe(armados.instanciaDelCotizador);
  });
});
