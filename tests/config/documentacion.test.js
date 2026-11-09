const { documentacionHabilitada } = require("../../src/config/documentacion");

describe("documentacionHabilitada", () => {
  it.each(["development", "test"])("en %s se publica", (entorno) => {
    expect(documentacionHabilitada({ NODE_ENV: entorno })).toBe(true);
  });

  // Lista cerrada: cualquier otro valor, también vacío o mal escrito, la apaga.
  it.each(["production", "migraciones", "", "Production", "dev", undefined])(
    "con NODE_ENV=%p no se publica",
    (entorno) => {
      expect(documentacionHabilitada({ NODE_ENV: entorno })).toBe(false);
    }
  );
});

/**
 * Prueba que app.js USA documentacionHabilitada, levantando la app de verdad:
 * si alguien volviera a montar /api-docs sin la condición, estos tests fallan.
 */
describe("/api-docs en la app", () => {
  const original = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = original;
  });

  /**
   * @description Levanta la app con un NODE_ENV y pide /api-docs/.
   * @param {string} entorno - Valor de NODE_ENV al cargar la app.
   * @returns {Promise<number>} El código HTTP de la respuesta.
   */
  const pedirDocumentacion = async (entorno) => {
    process.env.NODE_ENV = entorno;
    let app;
    jest.isolateModules(() => {
      app = require("../../src/app");
    });
    const servidor = app.listen(0);
    try {
      await new Promise((resolver) => servidor.once("listening", resolver));
      const { port } = servidor.address();
      const respuesta = await fetch(`http://127.0.0.1:${port}/api-docs/`);
      return respuesta.status;
    } finally {
      await new Promise((resolver) => servidor.close(resolver));
    }
  };

  test("en producción, /api-docs no existe", async () => {
    expect(await pedirDocumentacion("production")).toBe(404);
  });

  test("en desarrollo, /api-docs responde", async () => {
    expect(await pedirDocumentacion("development")).toBe(200);
  });
});
