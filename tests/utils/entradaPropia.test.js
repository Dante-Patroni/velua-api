const express = require("express");
const { entradaPropia } = require("../../src/utils/entradaPropia");
const { manejarErrorHttp } = require("../../src/middlewares/errorMapper");
const SequelizeCatalogoRepository = require("../../src/repositories/sequelize/SequelizeCatalogoRepository");
const SequelizeProductoRepository = require("../../src/repositories/sequelize/SequelizeProductoRepository");
const { PagoWebhookService } = require("../../src/services/PagoWebhookService");

/** Claves que `tabla[clave]` encuentra en Object.prototype aunque la tabla no las tenga. */
const HEREDADAS = ["__proto__", "constructor", "toString", "hasOwnProperty", "valueOf"];

describe("entradaPropia", () => {
  const tabla = Object.freeze({ recientes: "A", nombre: "B", cero: 0 });

  it("devuelve el valor de una clave propia", () => {
    expect(entradaPropia(tabla, "nombre")).toBe("B");
  });

  it("conserva un valor propio falsy (no lo confunde con 'no está')", () => {
    expect(entradaPropia(tabla, "cero")).toBe(0);
  });

  it.each(HEREDADAS)("con %s (heredada del prototipo) devuelve undefined", (clave) => {
    expect(tabla[clave]).toBeTruthy(); // lo que pasaba con tabla[clave]
    expect(entradaPropia(tabla, clave)).toBeUndefined();
  });

  it.each([
    ["undefined", undefined],
    ["null", null],
    ["un número", 1],
    ["un array con la clave", ["nombre"]],
    ["un objeto con toString", { toString: () => "nombre" }],
  ])("con %s como clave devuelve undefined", (_caso, clave) => {
    expect(entradaPropia(tabla, clave)).toBeUndefined();
  });
});

describe("errorMapper: un mensaje de error con el nombre de una propiedad heredada", () => {
  let servidor;
  let base;
  let consola;

  beforeAll(async () => {
    const app = express();
    app.get("/falla/:mensaje", (req) => {
      throw new Error(req.params.mensaje);
    });
    app.use((error, req, res, _next) => manejarErrorHttp(error, res));
    await new Promise((listo) => {
      servidor = app.listen(0, "127.0.0.1", listo);
    });
    base = `http://127.0.0.1:${servidor.address().port}`;
  });

  afterAll(() => new Promise((listo) => servidor.close(listo)));

  beforeEach(() => {
    consola = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consola.mockRestore();
  });

  it.each(HEREDADAS)(
    'un Error("%s") responde 500 con el JSON genérico (antes: HTML del manejador por defecto de Express)',
    async (mensaje) => {
      const respuesta = await fetch(`${base}/falla/${mensaje}`);

      expect(respuesta.status).toBe(500);
      expect(await respuesta.json()).toEqual({ error: "ERROR_INTERNO" });
    }
  );

  it("un error con type heredado no se toma como error del parser", async () => {
    const res = { locals: {}, status: jest.fn(), json: jest.fn() };
    res.status.mockReturnValue(res);
    const error = Object.assign(new Error("se rompió algo"), { type: "constructor" });

    manejarErrorHttp(error, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "ERROR_INTERNO" });
  });
});

describe("orden de los listados: una clave heredada cae al orden por defecto", () => {
  /** @returns {{models: Object, ultimoOrden: () => *}} Modelos falsos que capturan el `order`. */
  const modelosFalsos = () => {
    const findAndCountAll = jest.fn().mockResolvedValue({ rows: [], count: 0 });
    return {
      models: { Producto: { findAndCountAll }, Categoria: {}, Variante: {}, ImagenProducto: {} },
      ultimoOrden: () => findAndCountAll.mock.calls.at(-1)[0].order,
    };
  };

  it.each(HEREDADAS)("catálogo de la tienda con orden=%s", async (orden) => {
    const { models, ultimoOrden } = modelosFalsos();
    const repositorio = new SequelizeCatalogoRepository(models);

    await repositorio.listarProductos({});
    const porDefecto = ultimoOrden();
    await repositorio.listarProductos({ orden });

    expect(ultimoOrden()).toEqual(porDefecto);
  });

  it.each(HEREDADAS)("listado del panel con orden=%s", async (orden) => {
    const { models, ultimoOrden } = modelosFalsos();
    const repositorio = new SequelizeProductoRepository(models);

    await repositorio.listar({});
    const porDefecto = ultimoOrden();
    await repositorio.listar({ orden });

    expect(ultimoOrden()).toEqual(porDefecto);
  });

  it("un orden válido sigue funcionando", async () => {
    const { models, ultimoOrden } = modelosFalsos();
    const repositorio = new SequelizeProductoRepository(models);

    await repositorio.listar({ orden: "nombre" });

    expect(ultimoOrden()).toEqual([["nombre", "ASC"]]);
  });
});

describe("webhook: un estado de pago con el nombre de una propiedad heredada", () => {
  it.each(HEREDADAS)("estado=%s no mueve el pedido (SIN_RESULTADO)", async (estado) => {
    const pedidoRepository = { buscarPorNumero: jest.fn() };
    const pedidoEstadoService = { registrarResultadoPago: jest.fn() };
    const servicio = new PagoWebhookService({
      procesadorPagos: {},
      pedidoRepository,
      pedidoEstadoService,
      logger: { error: jest.fn() },
    });

    const resultado = await servicio.aplicarPago({
      id: "1",
      estado,
      referencia: "VEL-ABC234",
      monto: "1.00",
      moneda: "ARS",
      metodo: null,
    });

    expect(resultado).toEqual({ procesado: false, motivo: "SIN_RESULTADO" });
    expect(pedidoRepository.buscarPorNumero).not.toHaveBeenCalled();
    expect(pedidoEstadoService.registrarResultadoPago).not.toHaveBeenCalled();
  });
});
