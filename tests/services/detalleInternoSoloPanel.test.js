const fs = require("fs");
const path = require("path");

/**
 * El detalle interno de los avisos (por qué no se puede vender algo y cómo se
 * llama) es para el panel. La tienda es pública: sin él, no se puede saber qué ids
 * existen ni el nombre de un producto no publicado. Este test fija quién puede
 * pedirlo, para que una ruta nueva no lo active por error.
 */
const SRC = path.join(__dirname, "..", "..", "src");

/**
 * Archivos que pueden mencionar detalleInterno: el cotizador, que lo define, y la
 * cotización del panel (solo admin), que lo pide. Una línea nueva en esta lista es
 * lo primero que tiene que mirar la revisión.
 */
const PERMITIDOS = [
  path.join("services", "cotizador.js"),
  path.join("services", "CotizacionPanelService.js"),
];

/**
 * @description Lista los .js de una carpeta, recursivo, con la ruta relativa a src.
 * @param {string} carpeta - Carpeta absoluta.
 * @returns {string[]} Rutas relativas a src.
 */
const archivosJs = (carpeta) =>
  fs.readdirSync(carpeta, { withFileTypes: true }).flatMap((e) => {
    const completa = path.join(carpeta, e.name);
    if (e.isDirectory()) return archivosJs(completa);
    return e.name.endsWith(".js") ? [path.relative(SRC, completa)] : [];
  });

describe("detalleInterno solo en el panel", () => {
  test("solo el cotizador y la cotización del panel lo mencionan", () => {
    const conDetalle = archivosJs(SRC).filter((relativa) =>
      fs.readFileSync(path.join(SRC, relativa), "utf8").includes("detalleInterno")
    );

    expect(conDetalle.sort()).toEqual([...PERMITIDOS].sort());
  });

  test("CotizacionPanelService lo pide una sola vez, fijo en true y nunca de los datos", () => {
    const fuente = fs.readFileSync(path.join(SRC, "services", "CotizacionPanelService.js"), "utf8");

    expect(fuente.match(/\bdetalleInterno\b/g)).toHaveLength(1);
    expect(fuente).toMatch(/detalleInterno:\s*true\s*,/);
  });
});
