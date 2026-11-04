const fs = require("fs");
const path = require("path");

const { MercadoPagoProcesador } = require("../../src/pagos/MercadoPagoProcesador");
const { procesadorPagos } = require("../../src/pagos/procesadorCompartido");

const SRC = path.join(__dirname, "..", "..", "src");

/**
 * @description Todos los archivos .js de una carpeta, recorriendo subcarpetas.
 * @param {string} carpeta - Carpeta de inicio.
 * @returns {string[]} Rutas absolutas.
 */
const archivosJs = (carpeta) =>
  fs.readdirSync(carpeta, { withFileTypes: true }).flatMap((e) => {
    const ruta = path.join(carpeta, e.name);
    if (e.isDirectory()) return archivosJs(ruta);
    return e.name.endsWith(".js") ? [ruta] : [];
  });

describe("procesador de pagos compartido", () => {
  test("es una instancia de Mercado Pago", () => {
    expect(procesadorPagos).toBeInstanceOf(MercadoPagoProcesador);
  });

  test("nadie más crea su propio procesador", () => {
    // Si una ruta armara el suyo, la cotización y la creación del pedido podrían
    // decidir distinto si Mercado Pago está disponible.
    const conInstanciaPropia = archivosJs(SRC)
      .filter((ruta) => !ruta.endsWith(path.join("pagos", "procesadorCompartido.js")))
      .filter((ruta) => fs.readFileSync(ruta, "utf8").includes("new MercadoPagoProcesador("))
      .map((ruta) => path.relative(SRC, ruta));

    expect(conInstanciaPropia).toEqual([]);
  });
});
