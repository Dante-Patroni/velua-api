"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  /**
   * @description Crea la tabla de notificaciones del procesador de pagos.
   * El índice único sobre payment_id es lo que garantiza la idempotencia del webhook.
   * @param {import("sequelize").QueryInterface} queryInterface - Interfaz de consultas.
   * @param {import("sequelize").Sequelize} Sequelize - Constructor con los tipos de dato.
   * @returns {Promise<void>}
   */
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("mp_notificaciones", {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      payment_id: { type: Sequelize.STRING(80), allowNull: false, unique: true },
      topic: { type: Sequelize.STRING(40), allowNull: true },
      pedido_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
        references: { model: "pedidos", key: "id" },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },
      payload: { type: Sequelize.JSON, allowNull: true },
      procesado_en: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    });
  },

  /**
   * @description Elimina la tabla de notificaciones de pagos.
   * @param {import("sequelize").QueryInterface} queryInterface - Interfaz de consultas.
   * @returns {Promise<void>}
   */
  async down(queryInterface) {
    await queryInterface.dropTable("mp_notificaciones");
  },
};