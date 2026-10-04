"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  /**
   * @description Crea la bandeja de salida de mails.
   *
   * Los mails nunca se mandan dentro de un request: quien necesita mandar uno
   * inserta una fila acá, y un job las toma, las envía y anota el resultado. Si el
   * proveedor de mail está caído, la compra igual se completa.
   *
   * Se guarda el tipo de mail y los datos del momento, no el texto armado: si cambia
   * el diseño del correo, los pendientes salen con el diseño nuevo pero con los datos
   * que tenían cuando se generaron.
   *
   * @param {import("sequelize").QueryInterface} queryInterface - Interfaz de consultas.
   * @param {import("sequelize").Sequelize} Sequelize - Constructor con los tipos de dato.
   * @returns {Promise<void>}
   */
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("emails_pendientes", {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      pedido_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
        references: { model: "pedidos", key: "id" },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },
      // Texto y no ENUM: sumar un tipo de mail nuevo no tiene que exigir una migración.
      tipo: { type: Sequelize.STRING(40), allowNull: false },
      destinatario: { type: Sequelize.STRING(180), allowNull: false },
      datos: { type: Sequelize.JSON, allowNull: false },
      estado: {
        type: Sequelize.ENUM("pendiente", "enviado", "fallido"),
        allowNull: false,
        defaultValue: "pendiente",
      },
      intentos: { type: Sequelize.SMALLINT.UNSIGNED, allowNull: false, defaultValue: 0 },
      ultimo_error: { type: Sequelize.STRING(500), allowNull: true },
      // Permite esperar entre reintentos y programar mails a futuro, como el
      // recordatorio de pago.
      enviar_desde: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      enviado_en: { type: Sequelize.DATE, allowNull: true },
      creado_en: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    });

    // Es la consulta del job: los pendientes que ya se pueden enviar.
    await queryInterface.addIndex("emails_pendientes", ["estado", "enviar_desde"], {
      name: "ix_emails_estado_enviar",
    });
  },

  /**
   * @description Elimina la bandeja de salida.
   * @param {import("sequelize").QueryInterface} queryInterface - Interfaz de consultas.
   * @returns {Promise<void>}
   */
  async down(queryInterface) {
    await queryInterface.dropTable("emails_pendientes");
  },
};
