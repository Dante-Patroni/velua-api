const { crearValidadorOrigen, leerConfigCors } = require("../../src/config/cors");

const PRODUCCION = "https://veluanature.com.ar";
const PATRON = /^https:\/\/velua-web-[a-z0-9-]+-dante-patroni\.vercel\.app$/;

/** Ejecuta el validador y devuelve lo que le pasó al callback. */
const validar = (validador, origin) => {
  const callback = jest.fn();
  validador(origin, callback);
  const [error, permitido] = callback.mock.calls[0];
  return { error, permitido };
};

describe("crearValidadorOrigen", () => {
  describe("sin patrón", () => {
    const validador = crearValidadorOrigen({ origenes: [PRODUCCION] });

    it("acepta pedidos sin origen (curl, servidor a servidor)", () => {
      expect(validar(validador, undefined)).toEqual({ error: null, permitido: true });
    });

    it("acepta un origen exacto de la lista", () => {
      expect(validar(validador, PRODUCCION)).toEqual({ error: null, permitido: true });
    });

    it("rechaza un origen que no está en la lista", () => {
      const { error } = validar(validador, "https://otro.com");
      expect(error.message).toBe("ORIGEN_NO_PERMITIDO");
    });

    it("rechaza una preview si no hay patrón configurado", () => {
      const { error } = validar(validador, "https://velua-web-git-x-dante-patroni.vercel.app");
      expect(error.message).toBe("ORIGEN_NO_PERMITIDO");
    });
  });

  describe("con patrón de previews", () => {
    const validador = crearValidadorOrigen({ origenes: [PRODUCCION], patron: PATRON });

    it.each([
      "https://velua-web-git-feat-ficha-producto-dante-patroni.vercel.app",
      "https://velua-web-abc123xyz-dante-patroni.vercel.app",
    ])("acepta la preview %s", (origen) => {
      expect(validar(validador, origen)).toEqual({ error: null, permitido: true });
    });

    it.each([
      ["http en vez de https", "http://velua-web-git-x-dante-patroni.vercel.app"],
      ["sufijo agregado", "https://velua-web-git-x-dante-patroni.vercel.app.evil.com"],
      ["prefijo agregado", "https://evil.velua-web-git-x-dante-patroni.vercel.app"],
      ["otro proyecto", "https://otra-web-git-x-dante-patroni.vercel.app"],
      ["otra cuenta", "https://velua-web-git-x-otra-cuenta.vercel.app"],
      ["puerto agregado", "https://velua-web-git-x-dante-patroni.vercel.app:8443"],
    ])("rechaza %s", (_caso, origen) => {
      const { error } = validar(validador, origen);
      expect(error.message).toBe("ORIGEN_NO_PERMITIDO");
    });

    it("acepta un equipo ajeno que termine en -dante-patroni (riesgo asumido, ver DECISIONES.md)", () => {
      const origen = "https://velua-web-abc-x-dante-patroni.vercel.app";
      expect(validar(validador, origen)).toEqual({ error: null, permitido: true });
    });
  });
});

describe("leerConfigCors", () => {
  it("usa localhost por defecto y ningún patrón", () => {
    expect(leerConfigCors({})).toEqual({
      origenes: ["http://localhost:5173"],
      patron: null,
    });
  });

  it("separa la lista por comas y recorta espacios", () => {
    const { origenes } = leerConfigCors({ CORS_ORIGENES: "https://a.com , https://b.com" });
    expect(origenes).toEqual(["https://a.com", "https://b.com"]);
  });

  it("compila el patrón de previews", () => {
    const { patron } = leerConfigCors({ CORS_PATRON_PREVIEWS: PATRON.source });
    expect(patron.test("https://velua-web-git-x-dante-patroni.vercel.app")).toBe(true);
  });

  it("tira error al arrancar si el patrón está mal escrito", () => {
    expect(() => leerConfigCors({ CORS_PATRON_PREVIEWS: "^https://(" })).toThrow();
  });
});
