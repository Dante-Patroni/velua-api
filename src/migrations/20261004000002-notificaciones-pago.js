"use strict";

/**
 * @description Busca el nombre del índice único que MySQL creó sobre una columna.
 * El índice se creó con `unique: true` en la definición de la columna, así que su
 * nombre lo eligió MySQL. Buscarlo evita depender de esa convención.
 * @param {import("sequelize").QueryInterface} queryInterface - Interfaz de consultas.
 * @param {string} tabla - Nombre de la tabla.
 * @param {string} columna - Nombre de la columna.
 * @returns {Promise<string|null>} Nombre del índice, o null si no hay.
 */
const indiceUnicoDe = async (queryInterface, tabla, columna) => {
  const [filas] = await queryInterface.sequelize.query(
    `SELECT INDEX_NAME AS nombre
       FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = :tabla
        AND COLUMN_NAME = :columna
        AND NON_UNIQUE = 0
        AND INDEX_NAME <> 'PRIMARY'`,
    { replacements: { tabla, columna } }
  );
  return filas[0]?.nombre ?? null;
};

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  /**
   * @description Convierte `mp_notificaciones` en `notificaciones_pago`, una tabla
   * que sirve para cualquier proveedor.
   *
   * Dos cambios de fondo:
   *
   * La clave de idempotencia pasa a ser la pareja proveedor más id externo. Dos
   * proveedores distintos pueden usar el mismo número de operación.
   *
   * Se separa cuándo llegó el aviso de cuándo se terminó de procesar. Antes había una
   * sola fecha, que se llenaba al insertar: si el procesamiento fallaba, el reintento
   * del proveedor chocaba contra el duplicado y el pago no se procesaba nunca.
   * Idempotencia no es "ya vi este aviso", es "ya terminé de procesarlo".
   *
   * @param {import("sequelize").QueryInterface} queryInterface - Interfaz de consultas.
   * @param {import("sequelize").Sequelize} Sequelize - Constructor con los tipos de dato.
   * @returns {Promise<void>}
   */
  async up(queryInterface, Sequelize) {
    await queryInterface.renameTable("mp_notificaciones", "notificaciones_pago");

    const indiceViejo = await indiceUnicoDe(queryInterface, "notificaciones_pago", "payment_id");
    if (indiceViejo) {
      await queryInterface.removeIndex("notificaciones_pago", indiceViejo);
    }

    await queryInterface.renameColumn("notificaciones_pago", "payment_id", "id_externo");
    await queryInterface.renameColumn("notificaciones_pago", "topic", "tipo");
    // La columna de fecha se renombra a mano: renameColumn de Sequelize reescribe la
    // definicion entera y pone CURRENT_TIMESTAMP entre comillas, que MySQL rechaza.
    await queryInterface.sequelize.query(
      "ALTER TABLE notificaciones_pago CHANGE procesado_en recibido_en " +
        "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP"
    );

    // Los avisos que pudiera haber son todos de Mercado Pago. El código nuevo siempre
    // indica el proveedor en forma explícita.
    await queryInterface.addColumn("notificaciones_pago", "proveedor", {
      type: Sequelize.STRING(30),
      allowNull: false,
      defaultValue: "mercadopago",
      after: "id",
    });

    await queryInterface.addColumn("notificaciones_pago", "procesado_en", {
      type: Sequelize.DATE,
      allowNull: true,
      after: "recibido_en",
    });

    // El tipo no entra en la clave: es opcional, y en MySQL dos NULL nunca se
    // consideran iguales, así que una clave que lo incluya dejaría pasar duplicados.
    await queryInterface.addIndex("notificaciones_pago", ["proveedor", "id_externo"], {
      unique: true,
      name: "ux_notif_proveedor_id",
    });
  },

  /**
   * @description Devuelve la tabla a su forma anterior.
   * @param {import("sequelize").QueryInterface} queryInterface - Interfaz de consultas.
   * @returns {Promise<void>}
   */
  async down(queryInterface) {
    await queryInterface.removeIndex("notificaciones_pago", "ux_notif_proveedor_id");
    await queryInterface.removeColumn("notificaciones_pago", "procesado_en");
    await queryInterface.removeColumn("notificaciones_pago", "proveedor");

    await queryInterface.sequelize.query(
      "ALTER TABLE notificaciones_pago CHANGE recibido_en procesado_en " +
        "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP"
    );
    await queryInterface.renameColumn("notificaciones_pago", "tipo", "topic");
    await queryInterface.renameColumn("notificaciones_pago", "id_externo", "payment_id");

    await queryInterface.addIndex("notificaciones_pago", ["payment_id"], {
      unique: true,
      name: "payment_id",
    });

    await queryInterface.renameTable("notificaciones_pago", "mp_notificaciones");
  },
};
