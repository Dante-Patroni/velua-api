const fs = require("fs");
const path = require("path");
const { encolarParaClienta } = require("../../src/services/mailsClienta");

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

const MAIL = (destinatario) => ({
  tipo: "pedido_recibido",
  destinatario,
  datos: { numero: "VEL-AAAAAA" },
});

describe("encolarParaClienta", () => {
  test.each([
    ["null", null],
    ["undefined", undefined],
    ["vacío", ""],
    ["solo espacios", "   "],
    ["un número", 123],
  ])("con destinatario %s, no encola nada y devuelve false", async (_caso, destinatario) => {
    const tx = { encolarEmail: jest.fn() };

    const r = await encolarParaClienta(tx, MAIL(destinatario));

    expect(r).toBe(false);
    expect(tx.encolarEmail).not.toHaveBeenCalled();
  });

  test("con destinatario, encola el mail tal cual, una vez, y devuelve true", async () => {
    const tx = { encolarEmail: jest.fn().mockResolvedValue() };
    const mail = MAIL("valentina@ejemplo.test");

    const r = await encolarParaClienta(tx, mail);

    expect(r).toBe(true);
    expect(tx.encolarEmail).toHaveBeenCalledTimes(1);
    expect(tx.encolarEmail).toHaveBeenCalledWith(mail);
  });

  test("si encolar falla, el error sube para que la transacción vuelva atrás", async () => {
    const tx = { encolarEmail: jest.fn().mockRejectedValue(new Error("ERROR_DE_BASE")) };

    await expect(encolarParaClienta(tx, MAIL("valentina@ejemplo.test"))).rejects.toThrow(
      "ERROR_DE_BASE"
    );
  });
});

describe("una sola puerta para los mails a la clienta", () => {
  test("nadie en src llama a encolarEmail salvo mailsClienta.js", () => {
    // Un encolado directo con un pedido sin email rompería la transacción entera
    // (destinatario es NOT NULL): la venta del panel no se podría cobrar ni cancelar.
    const directos = archivosJs(SRC)
      .filter((ruta) => path.basename(ruta) !== "mailsClienta.js")
      .filter((ruta) => /\.\s*encolarEmail\b/.test(fs.readFileSync(ruta, "utf8")))
      .map((ruta) => path.relative(SRC, ruta));

    expect(directos).toEqual([]);
  });
});
