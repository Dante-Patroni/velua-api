"use strict";

const INDICE = "ux_pedidos_clave_venta";
const RESTRICCION = "ck_pedidos_clave_venta_huella";

/**
 * @description Columnas de la idempotencia de las ventas del panel, como tienen
 * que quedar. Las dos en ASCII: un UUID y un hex no llevan otra cosa, y un texto
 * con otros caracteres no entra.
 *
 * - La clave, sin distinguir mayúsculas (`ascii_general_ci`): un UUID es el mismo
 *   en mayúsculas o en minúsculas (RFC 9562). La ruta la guarda en minúsculas;
 *   si alguna vez no lo hiciera, el índice único igual las trata como la misma
 *   clave y no deja crear una segunda venta.
 * - La huella, exacta (`ascii_bin`): es el hex que calcula la API y se compara tal cual.
 */
const COLUMNAS = {
  clave_venta: {
    tipo: "char(36)",
    intercalacion: "ascii_general_ci",
    definicion: "CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL AFTER canal",
  },
  huella_venta: {
    tipo: "char(64)",
    intercalacion: "ascii_bin",
    definicion: "CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL AFTER clave_venta",
  },
};

/**
 * @description Lee qué partes de esta migración ya existen en la base.
 * @param {import("sequelize").Sequelize} seq - Conexión de la migración.
 * @returns {Promise<{columnas: Object<string, Object>, indice: Object[], restriccion: boolean}>}
 *   Las columnas encontradas (por nombre), las filas del índice y si existe la restricción.
 */
async function leerEstado(seq) {
  const select = { type: seq.QueryTypes.SELECT };

  const columnas = await seq.query(
    `SELECT COLUMN_NAME AS nombre, COLUMN_TYPE AS tipo, IS_NULLABLE AS nula,
            COLLATION_NAME AS intercalacion
       FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pedidos'
        AND COLUMN_NAME IN ('clave_venta', 'huella_venta')`,
    select
  );

  const indice = await seq.query(
    `SELECT COLUMN_NAME AS columna, NON_UNIQUE AS noUnico
       FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pedidos' AND INDEX_NAME = :nombre`,
    { ...select, replacements: { nombre: INDICE } }
  );

  // CHECK_CONSTRAINTS existe en MySQL 8.0.16+ y en MariaDB 10.2+, con estas dos columnas.
  const [{ cantidad }] = await seq.query(
    `SELECT COUNT(*) AS cantidad FROM information_schema.CHECK_CONSTRAINTS
      WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = :nombre`,
    { ...select, replacements: { nombre: RESTRICCION } }
  );

  return {
    columnas: Object.fromEntries(columnas.map((c) => [c.nombre, c])),
    indice,
    restriccion: Number(cantidad) > 0,
  };
}

/**
 * @description Corta si lo que ya existe no es lo que esta migración crea. Que
 * se pueda reintentar no puede tapar un esquema inconsistente: una columna con
 * otro tipo, que no acepte NULL o con otra intercalación, o un índice con ese
 * nombre que no sea único sobre clave_venta.
 * @param {{columnas: Object<string, Object>, indice: Object[]}} estado - Resultado de leerEstado.
 * @returns {void}
 * @throws {Error} Si alguna parte existente no coincide.
 */
function verificarLoExistente({ columnas, indice }) {
  for (const [nombre, esperada] of Object.entries(COLUMNAS)) {
    const actual = columnas[nombre];
    if (!actual) continue;
    if (
      String(actual.tipo).toLowerCase() !== esperada.tipo ||
      actual.nula !== "YES" ||
      actual.intercalacion !== esperada.intercalacion
    ) {
      throw new Error(
        `pedidos.${nombre} ya existe pero no es ${esperada.tipo.toUpperCase()} NULL ` +
          `${esperada.intercalacion} ` +
          `(es ${actual.tipo}, nula: ${actual.nula}, ${actual.intercalacion}). No se modificó nada.`
      );
    }
  }

  if (
    indice.length > 0 &&
    (indice.length !== 1 || indice[0].columna !== "clave_venta" || Number(indice[0].noUnico) !== 0)
  ) {
    throw new Error(
      `El índice ${INDICE} ya existe pero no es único sobre clave_venta. No se modificó nada.`
    );
  }
}

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  /**
   * @description Prepara la idempotencia de las ventas del panel: la clave que
   * manda el panel con cada venta (un UUID) y la huella del contenido validado
   * (SHA-256 en hex). Un reintento con la misma clave y la misma huella devuelve
   * la venta original; la misma clave con otra huella es un error (409). Eso lo
   * hace el PR de la ruta; acá solo el esquema.
   *
   * - Índice único sobre la clave: la última barrera si dos reintentos llegan a la
   *   vez. MySQL admite muchos NULL en un índice único, así que los pedidos de la
   *   tienda (sin clave) no chocan.
   * - CHECK: las dos columnas van juntas o ninguna. Una clave sin huella no
   *   permitiría distinguir un reintento de una clave reusada.
   *
   * Todo va en un solo ALTER TABLE: en MySQL 8 en adelante (producción) un DDL es
   * atómico, y entra entero o no entra. En MariaDB eso no está garantizado: si
   * quedó una parte, el reintento agrega solo lo que falta, después de verificar
   * que lo que existe es exactamente lo esperado.
   *
   * @param {import("sequelize").QueryInterface} queryInterface - Interfaz de consultas.
   * @returns {Promise<void>}
   * @throws {Error} Si encuentra una parte con otra definición.
   */
  async up(queryInterface) {
    const seq = queryInterface.sequelize;
    const estado = await leerEstado(seq);
    verificarLoExistente(estado);

    const partes = [];
    for (const [nombre, { definicion }] of Object.entries(COLUMNAS)) {
      if (!estado.columnas[nombre]) partes.push(`ADD COLUMN ${nombre} ${definicion}`);
    }
    if (estado.indice.length === 0) partes.push(`ADD UNIQUE INDEX ${INDICE} (clave_venta)`);
    if (!estado.restriccion) {
      partes.push(
        `ADD CONSTRAINT ${RESTRICCION} CHECK ((clave_venta IS NULL) = (huella_venta IS NULL))`
      );
    }

    if (partes.length > 0) await seq.query(`ALTER TABLE pedidos ${partes.join(", ")}`);
  },

  /**
   * @description Vuelve atrás, solo si ninguna venta tiene clave. Sin la clave, un
   * reintento de esa venta crearía otra: por eso se cuenta primero y, si hay
   * alguna, no se toca nada (ni columnas, ni índice, ni restricción).
   *
   * @param {import("sequelize").QueryInterface} queryInterface - Interfaz de consultas.
   * @returns {Promise<void>}
   * @throws {Error} Si hay ventas con clave.
   */
  async down(queryInterface) {
    const seq = queryInterface.sequelize;
    const estado = await leerEstado(seq);

    if (estado.columnas.clave_venta) {
      const [{ cantidad }] = await seq.query(
        "SELECT COUNT(*) AS cantidad FROM pedidos WHERE clave_venta IS NOT NULL",
        { type: seq.QueryTypes.SELECT }
      );
      if (Number(cantidad) > 0) {
        throw new Error(
          `No se puede deshacer la idempotencia de las ventas: hay ventas con clave (${cantidad}). ` +
            "Sin ella, un reintento crearía otra venta. No se modificó nada."
        );
      }
    }

    const partes = [];
    if (estado.restriccion) partes.push(`DROP CONSTRAINT ${RESTRICCION}`);
    if (estado.indice.length > 0) partes.push(`DROP INDEX ${INDICE}`);
    for (const nombre of ["huella_venta", "clave_venta"]) {
      if (estado.columnas[nombre]) partes.push(`DROP COLUMN ${nombre}`);
    }

    if (partes.length > 0) await seq.query(`ALTER TABLE pedidos ${partes.join(", ")}`);
  },
};
