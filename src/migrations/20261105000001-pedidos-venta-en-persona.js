"use strict";

/**
 * @description Condiciones que impiden deshacer la migración: cada una es un dato
 * que solo existe gracias a ella. Si alguna se cumple, el `down` corta antes de
 * tocar el esquema, en vez de romper a mitad de camino o vaciar valores en silencio.
 */
const DATOS_QUE_SE_PERDERIAN = [
  { condicion: "canal = 'panel'", que: "ventas del panel" },
  { condicion: "medio_pago = 'efectivo'", que: "pedidos en efectivo" },
  { condicion: "metodo_entrega = 'en_mano'", que: "entregas en mano" },
  { condicion: "cliente_email IS NULL OR cliente_email = ''", que: "pedidos sin email" },
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  /**
   * @description Prepara los pedidos para la venta en persona: el canal por el que
   * entró, el efectivo como medio de pago, la entrega en mano y el email opcional.
   *
   * Ampliar el esquema no habilita nada: la ruta pública de la tienda sigue
   * aceptando solo mercadopago y transferencia, envío y retiro, y un email. Las
   * ventas del panel llegan con su propia ruta y su permiso, en otro PR.
   *
   * Los ENUM se amplían agregando el valor al final, que en MySQL no reescribe los
   * datos. Cada MODIFY repite la definición completa de la columna (tipo, nulabilidad
   * y valor por defecto, como los dejó su migración original): un MODIFY que omite
   * un atributo lo borra. Los índices no se tocan.
   *
   * Se puede volver a correr si falla a mitad de camino: los DDL no van en una
   * transacción, así que un error después de crear `canal` la deja creada sin que
   * la migración quede registrada. Por eso la columna se agrega solo si falta, y los
   * MODIFY ya dan el mismo resultado si se repiten. Sin esto, el reintento del
   * pre-deploy chocaría con "columna duplicada" y frenaría todos los deploys.
   *
   * @param {import("sequelize").QueryInterface} queryInterface - Interfaz de consultas.
   * @param {import("sequelize").Sequelize} Sequelize - Constructor con los tipos de dato.
   * @returns {Promise<void>}
   */
  async up(queryInterface, Sequelize) {
    // Los pedidos que ya existen entraron todos por la tienda.
    const columnas = await queryInterface.describeTable("pedidos");
    if (!columnas.canal) {
      await queryInterface.addColumn("pedidos", "canal", {
        type: Sequelize.ENUM("tienda", "panel"),
        allowNull: false,
        defaultValue: "tienda",
        after: "numero",
      });
    }

    const seq = queryInterface.sequelize;
    await seq.query(
      "ALTER TABLE pedidos MODIFY COLUMN medio_pago ENUM('mercadopago', 'transferencia', 'efectivo') NOT NULL"
    );
    await seq.query(
      "ALTER TABLE pedidos MODIFY COLUMN metodo_entrega ENUM('envio', 'retiro', 'en_mano') NOT NULL DEFAULT 'envio'"
    );
    // Una venta del panel puede no tener email; la tienda lo sigue exigiendo.
    await seq.query("ALTER TABLE pedidos MODIFY COLUMN cliente_email VARCHAR(180) NULL");
  },

  /**
   * @description Vuelve atrás, solo si no hay datos que dependan de esta migración.
   *
   * Las sentencias DDL de MySQL no van en una transacción, así que no se puede
   * deshacer a medias y volver: por eso se cuenta todo primero y, si hay algo, no
   * se toca nada.
   *
   * @param {import("sequelize").QueryInterface} queryInterface - Interfaz de consultas.
   * @returns {Promise<void>}
   * @throws {Error} Si hay ventas del panel, efectivo, entregas en mano o pedidos sin email.
   */
  async down(queryInterface) {
    const seq = queryInterface.sequelize;

    const hallados = [];
    for (const { condicion, que } of DATOS_QUE_SE_PERDERIAN) {
      const [{ cantidad }] = await seq.query(
        `SELECT COUNT(*) AS cantidad FROM pedidos WHERE ${condicion}`,
        { type: seq.QueryTypes.SELECT }
      );
      if (Number(cantidad) > 0) hallados.push(`${cantidad} ${que}`);
    }

    if (hallados.length > 0) {
      throw new Error(
        `No se puede deshacer la venta en persona: hay ${hallados.join(", ")}. ` +
          "Esos datos no entran en el esquema anterior. No se modificó nada."
      );
    }

    await seq.query("ALTER TABLE pedidos MODIFY COLUMN cliente_email VARCHAR(180) NOT NULL");
    await seq.query(
      "ALTER TABLE pedidos MODIFY COLUMN metodo_entrega ENUM('envio', 'retiro') NOT NULL DEFAULT 'envio'"
    );
    await seq.query(
      "ALTER TABLE pedidos MODIFY COLUMN medio_pago ENUM('mercadopago', 'transferencia') NOT NULL"
    );
    await queryInterface.removeColumn("pedidos", "canal");
  },
};
