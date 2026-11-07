const fs = require("fs");
const path = require("path");

const SRC = path.join(__dirname, "..", "..", "src");

/**
 * Archivos que pueden pedir el efectivo al cotizador. Hoy, solo el cotizador
 * mismo. La ruta del panel (POST /admin/ventas, con su permiso) se agrega acá
 * en su PR, y esa línea nueva es la que tiene que mirar la revisión.
 */
const PERMITIDOS = [path.join("services", "cotizador.js")];

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

describe("efectivo solo en el panel", () => {
  test("ningún otro archivo le pide el efectivo al cotizador", () => {
    // Si una ruta de la tienda pasara incluirEfectivo, la clienta vería el efectivo
    // con su descuento: la protección no puede depender de la configuración.
    const queLoPiden = archivosJs(SRC)
      .map((ruta) => path.relative(SRC, ruta))
      .filter((relativa) => !PERMITIDOS.includes(relativa))
      .filter((relativa) =>
        fs.readFileSync(path.join(SRC, relativa), "utf8").includes("incluirEfectivo")
      );

    expect(queLoPiden).toEqual([]);
  });
});
