const fs = require("fs");
const path = require("path");

const SRC = path.join(__dirname, "..", "..", "src");

/**
 * Archivos que pueden pedir el efectivo al cotizador: el cotizador mismo y
 * CheckoutService, que lo pide solo con el perfil del panel (lo verifica el test de
 * abajo). La ruta del panel (POST /admin/ventas, con su permiso) se agrega acá en
 * su PR, y esa línea nueva es la que tiene que mirar la revisión.
 */
const PERMITIDOS = [
  path.join("services", "cotizador.js"),
  path.join("services", "CheckoutService.js"),
];

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

  test("CheckoutService pide el efectivo solo con el perfil del panel", () => {
    const fuente = fs.readFileSync(path.join(SRC, "services", "CheckoutService.js"), "utf8");

    // Tres apariciones, ni una más: el perfil de la tienda (false), el del panel
    // (true) y el núcleo, que pasa lo que diga el perfil.
    const valores = [...fuente.matchAll(/incluirEfectivo:\s*([^,\n}]+)/g)].map((m) => m[1].trim());
    expect(valores.sort()).toEqual(["false", "perfil.incluirEfectivo", "true"]);
    expect(fuente).toMatch(/PERFIL_TIENDA = Object\.freeze\(\{[^}]*incluirEfectivo: false/);
    expect(fuente).toMatch(/PERFIL_PANEL = Object\.freeze\(\{[^}]*incluirEfectivo: true/);

    // Cada perfil se usa en una sola llamada al núcleo, y la del panel está adentro
    // de registrarVentaDelPanel.
    const llamadas = [...fuente.matchAll(/#crearEnTransaccion\(tx, \w+, (PERFIL_\w+)/g)];
    expect(llamadas.map((m) => m[1]).sort()).toEqual(["PERFIL_PANEL", "PERFIL_TIENDA"]);
    const delPanel = llamadas.find((m) => m[1] === "PERFIL_PANEL").index;
    expect(delPanel).toBeGreaterThan(fuente.indexOf("async registrarVentaDelPanel("));
    expect(delPanel).toBeLessThan(fuente.indexOf("async #ventaPrevia("));
  });
});
