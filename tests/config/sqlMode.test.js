const fs = require("node:fs");
const path = require("node:path");
const { MODOS_PROHIBIDOS, modosProhibidos, verificarSqlMode } = require("../../src/config/sqlMode");

/** El sql_mode por defecto de MySQL 8 y 9 (el de Railway y el de la CI). */
const MODO_POR_DEFECTO =
  "ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION";

/**
 * @description Conexión falsa de mysql2: responde la consulta del sql_mode.
 * @param {Object} respuesta - `{ modo }` o `{ error }`.
 * @returns {Object} Conexión con query y destroy espiables.
 */
const crearConexion = ({ modo, error }) => ({
  query: jest.fn((sql, callback) => (error ? callback(error) : callback(null, [{ modo }]))),
  destroy: jest.fn(),
});

describe("modosProhibidos", () => {
  it("el modo por defecto de MySQL no tiene ninguno", () => {
    expect(modosProhibidos(MODO_POR_DEFECTO)).toEqual([]);
  });

  it.each([
    ["al principio", `NO_BACKSLASH_ESCAPES,${MODO_POR_DEFECTO}`],
    ["al final", `${MODO_POR_DEFECTO},NO_BACKSLASH_ESCAPES`],
    ["solo", "NO_BACKSLASH_ESCAPES"],
    ["en minúsculas y con espacios", "strict_trans_tables, no_backslash_escapes "],
  ])("detecta NO_BACKSLASH_ESCAPES %s", (_caso, modo) => {
    expect(modosProhibidos(modo)).toEqual(["NO_BACKSLASH_ESCAPES"]);
  });

  it("compara modo por modo, no por substring", () => {
    expect(modosProhibidos("NO_BACKSLASH_ESCAPES_X,X_NO_BACKSLASH_ESCAPES")).toEqual([]);
  });

  it("un sql_mode vacío no tiene ninguno", () => {
    expect(modosProhibidos("")).toEqual([]);
  });

  it("la lista no se puede modificar", () => {
    expect(Object.isFrozen(MODOS_PROHIBIDOS)).toBe(true);
  });
});

describe("verificarSqlMode", () => {
  it("con el modo por defecto deja pasar la conexión sin cerrarla", async () => {
    const conexion = crearConexion({ modo: MODO_POR_DEFECTO });

    await expect(verificarSqlMode(conexion)).resolves.toBeUndefined();
    expect(conexion.query).toHaveBeenCalledWith(
      "SELECT @@SESSION.sql_mode AS modo",
      expect.any(Function)
    );
    expect(conexion.destroy).not.toHaveBeenCalled();
  });

  it("con NO_BACKSLASH_ESCAPES cierra la conexión y lanza SQL_MODE_INSEGURO", async () => {
    const conexion = crearConexion({ modo: `${MODO_POR_DEFECTO},NO_BACKSLASH_ESCAPES` });

    await expect(verificarSqlMode(conexion)).rejects.toMatchObject({
      code: "SQL_MODE_INSEGURO",
      message: expect.stringContaining("NO_BACKSLASH_ESCAPES"),
    });
    expect(conexion.destroy).toHaveBeenCalledTimes(1);
  });

  it("si no puede leer el sql_mode, falla cerrado: cierra la conexión y propaga el error", async () => {
    const fallo = new Error("se cortó la conexión");
    const conexion = crearConexion({ error: fallo });

    await expect(verificarSqlMode(conexion)).rejects.toBe(fallo);
    expect(conexion.destroy).toHaveBeenCalledTimes(1);
  });
});

describe("la guarda está instalada", () => {
  it("la instancia de Sequelize de la API verifica cada conexión nueva", () => {
    const db = require("../../src/models");

    expect(db.sequelize.hasHook("afterConnect")).toBe(true);
  });

  it("nadie en src cambia el sql_mode", () => {
    // Si el código de la API pudiera fijar el sql_mode, una conexión ya verificada
    // podría pasar a NO_BACKSLASH_ESCAPES sin abrir una nueva. (scripts/ queda
    // afuera: probar-sql-mode.js lo cambia en su sesión a propósito, y no es la API.)
    const raiz = path.join(__dirname, "../..");
    const archivos = [];
    const recorrer = (carpeta) => {
      for (const entrada of fs.readdirSync(carpeta, { withFileTypes: true })) {
        const ruta = path.join(carpeta, entrada.name);
        if (entrada.isDirectory()) recorrer(ruta);
        else if (entrada.name.endsWith(".js")) archivos.push(ruta);
      }
    };
    recorrer(path.join(raiz, "src"));

    const queLoCambian = archivos
      .filter((ruta) => /SET\s+[^;]*sql_mode/i.test(fs.readFileSync(ruta, "utf8")))
      .map((ruta) => path.relative(raiz, ruta));

    expect(queLoCambian).toEqual([]);
  });
});
