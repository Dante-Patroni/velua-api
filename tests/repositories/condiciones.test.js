const fs = require("node:fs");
const path = require("node:path");
const {
  ALIAS_CATEGORIA,
  padreActivo,
  escaparLike,
  contiene,
} = require("../../src/repositories/sequelize/condiciones");

describe("padreActivo: alias en lista cerrada", () => {
  it.each(ALIAS_CATEGORIA)("con el alias permitido %s arma la condición con ese alias", (alias) => {
    const condicion = padreActivo(alias);

    expect(condicion.val).toContain(`\`${alias}\`.\`padre_id\` IS NULL`);
    expect(condicion.val).toContain(`p.id = \`${alias}\`.\`padre_id\``);
  });

  it.each([
    ["otra tabla", "Producto"],
    ["mayúsculas distintas", "CATEGORIA"],
    ["un intento de inyección", "categoria`.`id` = 1 OR 1=1 -- "],
    ["texto vacío", ""],
    ["undefined", undefined],
    ["un objeto con toString", { toString: () => "categoria" }],
    ["un array con el alias", ["categoria"]],
  ])("con %s lanza ALIAS_NO_PERMITIDO", (_caso, alias) => {
    expect(() => padreActivo(alias)).toThrow("ALIAS_NO_PERMITIDO");
  });

  it("la lista no se puede modificar", () => {
    expect(Object.isFrozen(ALIAS_CATEGORIA)).toBe(true);
  });
});

describe("escaparLike y contiene", () => {
  it.each([
    ["%", "\\%"],
    ["_", "\\_"],
    ["\\", "\\\\"],
    ["50% off", "50\\% off"],
    ["a_b\\c%", "a\\_b\\\\c\\%"],
    ["%%__", "\\%\\%\\_\\_"],
  ])("escapa %j como %j", (texto, esperado) => {
    expect(escaparLike(texto)).toBe(esperado);
  });

  it("un texto sin comodines no cambia", () => {
    expect(escaparLike("Jabón de lavanda")).toBe("Jabón de lavanda");
  });

  it("contiene envuelve el texto escapado en %", () => {
    expect(contiene("50%")).toBe("%50\\%%");
  });
});

describe("búsquedas con LIKE en los repositorios", () => {
  const carpeta = path.join(__dirname, "../../src/repositories/sequelize");
  const archivos = fs.readdirSync(carpeta).filter((nombre) => nombre.endsWith(".js"));

  it("ninguna arma el patrón de LIKE a mano: todas pasan por contiene()", () => {
    // Un `%${texto}%` escrito a mano deja los comodines sin escapar. Si una
    // búsqueda nueva lo necesita, que use contiene().
    const aMano = archivos.filter((nombre) =>
      /\[Op\.(not)?[Ll]ike\]:\s*`/.test(fs.readFileSync(path.join(carpeta, nombre), "utf8"))
    );

    expect(aMano).toEqual([]);
  });

  it("las búsquedas del catálogo y del panel usan contiene()", () => {
    for (const nombre of ["SequelizeCatalogoRepository.js", "SequelizeProductoRepository.js"]) {
      const codigo = fs.readFileSync(path.join(carpeta, nombre), "utf8");
      expect(codigo).toMatch(/\[Op\.like\]: contiene\(filtros\.q\)/);
    }
  });
});
