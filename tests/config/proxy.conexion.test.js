/**
 * Prueba que app.js USA leerSaltosProxy, no solo que el parser funciona: si
 * alguien volviera a escribir app.set("trust proxy", 1), estos tests fallan.
 */
describe("trust proxy en la app", () => {
  const original = process.env.TRUST_PROXY_SALTOS;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.TRUST_PROXY_SALTOS;
    } else {
      process.env.TRUST_PROXY_SALTOS = original;
    }
  });

  test("toma los saltos de TRUST_PROXY_SALTOS", () => {
    process.env.TRUST_PROXY_SALTOS = "2";
    jest.isolateModules(() => {
      const app = require("../../src/app");
      expect(app.get("trust proxy")).toBe(2);
    });
  });

  test("con un valor inválido la app no carga", () => {
    process.env.TRUST_PROXY_SALTOS = "true";
    jest.isolateModules(() => {
      expect(() => require("../../src/app")).toThrow("TRUST_PROXY_SALTOS");
    });
  });
});