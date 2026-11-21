const path = require("node:path");
const express = require("express");
const { manejarErrorHttp } = require("../../src/middlewares/errorMapper");
const { crearRegistroPeticiones } = require("../../src/middlewares/registroPeticiones");

/**
 * @description Response falsa que registra el status y el cuerpo.
 * @returns {Object} res con status y json encadenables, y locals.
 */
const crearRes = () => {
  const res = { locals: {} };
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

describe("errorMapper: errores del cliente de origen conocido", () => {
  let consola;

  beforeEach(() => {
    consola = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consola.mockRestore();
  });

  it("el URIError del router (status 400) responde 400 SOLICITUD_INVALIDA, sin el mensaje y sin log de error", () => {
    const res = crearRes();
    const error = Object.assign(new URIError("Failed to decode param '%E0%A4%A'"), { status: 400 });

    manejarErrorHttp(error, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "SOLICITUD_INVALIDA" });
    expect(res.locals.codigoError).toBe("SOLICITUD_INVALIDA");
    expect(consola).not.toHaveBeenCalled();
  });

  it("un error de http-errors (expose: true) responde su status 4xx con el código genérico", () => {
    const res = crearRes();
    const error = Object.assign(new Error("Method Not Allowed"), {
      status: 405,
      statusCode: 405,
      expose: true,
    });

    manejarErrorHttp(error, res);

    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith({ error: "SOLICITUD_INVALIDA" });
  });

  describe("todo lo que no está en la lista blanca sigue siendo 500, con log", () => {
    it.each([
      [
        "status 401 sin marca (un SDK sin envolver, con nuestra credencial vencida)",
        { status: 401 },
      ],
      ["statusCode 401 sin marca", { statusCode: 401 }],
      ["status 400 con expose distinto de true", { status: 400, expose: "true" }],
      ["expose: true con status 500", { status: 500, expose: true }],
      ["expose: true con status no numérico", { status: "400", expose: true }],
    ])("%s", (_caso, campos) => {
      const res = crearRes();
      const error = Object.assign(new Error("Request failed with status code 401"), campos);

      manejarErrorHttp(error, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: "ERROR_INTERNO" });
      expect(consola).toHaveBeenCalledWith(error);
    });

    it("un URIError con otro status que no es 400", () => {
      const res = crearRes();
      const error = Object.assign(new URIError("x"), { status: 404 });

      manejarErrorHttp(error, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });

    it("un error sin status", () => {
      const res = crearRes();

      manejarErrorHttp(new Error("se rompió algo"), res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: "ERROR_INTERNO" });
    });
  });

  it("un código de dominio conocido gana sobre el status del error", () => {
    const res = crearRes();
    const error = Object.assign(new Error("NO_ENCONTRADO"), { status: 400, expose: true });

    manejarErrorHttp(error, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "NO_ENCONTRADO" });
  });
});

describe("errorMapper con Express real", () => {
  let servidor;
  let base;
  let lineas;
  let consola;

  beforeAll(async () => {
    lineas = [];
    const app = express();
    app.use(crearRegistroPeticiones({ escribir: (linea) => lineas.push(JSON.parse(linea)) }));
    app.use(express.json());
    app.get("/productos/:slug", (req, res) => res.json({ slug: req.params.slug }));
    app.post("/cotizar", (req, res) => res.json({ ok: true }));
    app.get("/falla", () => {
      throw new Error("se rompió algo");
    });
    app.use((error, req, res, _next) => manejarErrorHttp(error, res));
    await new Promise((listo) => {
      servidor = app.listen(0, "127.0.0.1", listo);
    });
    base = `http://127.0.0.1:${servidor.address().port}`;
  });

  afterAll(() => new Promise((listo) => servidor.close(listo)));

  beforeEach(() => {
    lineas.length = 0;
    consola = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consola.mockRestore();
  });

  it.each(["%E0%A4%A", "%"])(
    "GET /productos/%s responde 400 SOLICITUD_INVALIDA, sin el mensaje del router",
    async (segmento) => {
      const respuesta = await fetch(`${base}/productos/${segmento}`);
      const texto = await respuesta.text();

      expect(respuesta.status).toBe(400);
      expect(JSON.parse(texto)).toEqual({ error: "SOLICITUD_INVALIDA" });
      expect(texto).not.toMatch(/decode|param/i);
      expect(consola).not.toHaveBeenCalled();
    }
  );

  it("queda una línea en el registro de peticiones, con el código y sin la URL", async () => {
    await fetch(`${base}/productos/%E0%A4%A`);

    expect(lineas).toHaveLength(1);
    expect(lineas[0]).toMatchObject({
      status: 400,
      error: "SOLICITUD_INVALIDA",
      ruta: "(sin ruta)",
    });
    expect(JSON.stringify(lineas[0])).not.toContain("%E0");
  });

  it("un JSON mal formado sigue respondiendo 400 JSON_INVALIDO", async () => {
    const respuesta = await fetch(`${base}/cotizar`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: '{"items":',
    });

    expect(respuesta.status).toBe(400);
    expect(await respuesta.json()).toEqual({ error: "JSON_INVALIDO" });
  });

  it("un error del servidor sigue respondiendo 500 sin detalle, con log", async () => {
    const respuesta = await fetch(`${base}/falla`);
    const texto = await respuesta.text();

    expect(respuesta.status).toBe(500);
    expect(JSON.parse(texto)).toEqual({ error: "ERROR_INTERNO" });
    expect(texto).not.toContain("se rompió");
    expect(consola).toHaveBeenCalledTimes(1);
  });

  it("un segmento bien codificado no cambia", async () => {
    const respuesta = await fetch(`${base}/productos/jab%C3%B3n`);

    expect(respuesta.status).toBe(200);
    expect(await respuesta.json()).toEqual({ slug: "jabón" });
  });
});

describe("supuesto de la lista blanca: http-errors solo entra por Express", () => {
  it("en producción, solo express, body-parser, raw-body y send dependen de http-errors", () => {
    // Si este test falla, una dependencia nueva trae http-errors y sus errores
    // con `expose: true` llegarían al manejador como "del cliente". Revisar si
    // la marca sigue siendo confiable antes de actualizar la lista.
    const { packages } = require(path.join(__dirname, "../../package-lock.json"));

    const quienes = Object.entries(packages)
      .filter(([ruta, paquete]) => ruta && !paquete.dev && paquete.dependencies?.["http-errors"])
      .map(([ruta]) => ruta)
      .sort();

    expect(quienes).toEqual([
      "node_modules/body-parser",
      "node_modules/express",
      "node_modules/raw-body",
      "node_modules/send",
    ]);
  });
});
