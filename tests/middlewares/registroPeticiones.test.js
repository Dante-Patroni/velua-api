const { EventEmitter } = require("node:events");
const { crearRegistroPeticiones } = require("../../src/middlewares/registroPeticiones");
const { manejarErrorHttp } = require("../../src/middlewares/errorMapper");

/**
 * @description Request falsa con datos sensibles que nunca tienen que aparecer en el registro.
 * @param {Object} [cambios] - Campos a reemplazar.
 * @returns {Object} Request falsa.
 */
const crearReq = (cambios = {}) => ({
  method: "POST",
  originalUrl: "/api/v1/pedidos/VEL-ABC234?token=secreto-en-query",
  baseUrl: "/api/v1",
  route: { path: "/pedidos/:numero" },
  ip: "203.0.113.7",
  headers: { authorization: "Bearer token-secreto", cookie: "velua_sesion=token-secreto" },
  cookies: { velua_sesion: "token-secreto" },
  body: { email: "ana@example.com", password: "contrasena-secreta" },
  get(nombre) {
    return this.headers[nombre.toLowerCase()];
  },
  ...cambios,
});

/**
 * @description Response falsa que emite "finish" cuando el test lo pide.
 * @returns {EventEmitter} Response falsa.
 */
const crearRes = () => {
  const res = new EventEmitter();
  res.statusCode = 200;
  res.locals = {};
  return res;
};

/**
 * @description Corre el middleware con un reloj y un generador de id fijos.
 * @param {Object} [opciones] - req, res u opciones del middleware.
 * @returns {Object} Las líneas escritas, la response y el next.
 */
const correr = ({ req = crearReq(), res = crearRes(), ...opciones } = {}) => {
  const lineas = [];
  let tiempo = 1000;
  const next = jest.fn();
  const middleware = crearRegistroPeticiones({
    escribir: (linea) => lineas.push(linea),
    reloj: () => (tiempo += 12),
    generarId: () => "id-generado",
    ...opciones,
  });
  middleware(req, res, next);
  return { lineas, res, req, next };
};

describe("registroPeticiones", () => {
  it("escribe una línea JSON al terminar la respuesta, no antes", () => {
    const { lineas, res, next } = correr();

    expect(next).toHaveBeenCalled();
    expect(lineas).toHaveLength(0);

    res.statusCode = 404;
    res.locals.codigoError = "NO_ENCONTRADO";
    res.emit("finish");

    expect(lineas).toHaveLength(1);
    expect(JSON.parse(lineas[0])).toEqual({
      tipo: "peticion",
      id: "id-generado",
      metodo: "POST",
      ruta: "/api/v1/pedidos/:numero",
      status: 404,
      ms: 12,
      usuario: null,
      error: "NO_ENCONTRADO",
      ip: "203.0.113.7",
    });
  });

  it("registra el usuario de la sesión, que el middleware de auth carga después", () => {
    const { lineas, res, req } = correr();

    req.usuario = { id: 2, rol: "operador" };
    res.emit("finish");

    expect(JSON.parse(lineas[0]).usuario).toBe(2);
  });

  it("guarda el patrón de la ruta, nunca el número de pedido ni la query", () => {
    const { lineas, res } = correr();

    res.emit("finish");

    expect(lineas[0]).not.toContain("VEL-ABC234");
    expect(lineas[0]).not.toContain("secreto-en-query");
  });

  it("sin ruta (404 o límite global) lo dice", () => {
    const { lineas, res } = correr({ req: crearReq({ route: undefined, baseUrl: "" }) });

    res.emit("finish");

    expect(JSON.parse(lineas[0]).ruta).toBe("(sin ruta)");
  });

  it("no registra el cuerpo, las cookies ni los encabezados", () => {
    const { lineas, res } = correr();

    res.emit("finish");

    for (const dato of ["ana@example.com", "contrasena-secreta", "token-secreto", "Bearer"]) {
      expect(lineas[0]).not.toContain(dato);
    }
  });

  it("usa el id de petición de Railway si viene", () => {
    const { lineas, res } = correr({
      req: crearReq({ headers: { "x-railway-request-id": "Z2N6zO8HQXSw-EKTb0_TJvA" } }),
    });

    res.emit("finish");

    expect(JSON.parse(lineas[0]).id).toBe("Z2N6zO8HQXSw-EKTb0_TJvA");
  });

  it("si el id que llega no tiene forma de id, lo descarta y genera uno", () => {
    const invalido = `inyectado\n{"tipo":"falso"} ${"x".repeat(100)}`;
    const { lineas, res } = correr({
      req: crearReq({ headers: { "x-railway-request-id": invalido } }),
    });

    res.emit("finish");

    expect(JSON.parse(lineas[0]).id).toBe("id-generado");
    expect(lineas[0]).not.toContain("inyectado");
  });
});

describe("manejarErrorHttp y el registro", () => {
  it("deja el código de error en res.locals para el registro", () => {
    const res = { locals: {} };
    res.status = jest.fn(() => res);
    res.json = jest.fn(() => res);

    manejarErrorHttp(new Error("NO_ENCONTRADO"), res);

    expect(res.locals.codigoError).toBe("NO_ENCONTRADO");
  });
});
