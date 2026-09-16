"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  /**
   * @description Crea la tabla de zonas de envío con tarifa plana por zona.
   * @param {import("sequelize").QueryInterface} queryInterface - Interfaz de consultas.
   * @param {import("sequelize").Sequelize} Sequelize - Constructor con los tipos de dato.
   * @returns {Promise<void>}
   */
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("zonas_envio", {
      id: {
        type: Sequelize.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      nombre: { type: Sequelize.STRING(100), allowNull: false },
      costo: { type: Sequelize.DECIMAL(12, 2), allowNull: false },
      demora_texto: { type: Sequelize.STRING(80), allowNull: true },
      activa: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      orden: { type: Sequelize.SMALLINT, allowNull: false, defaultValue: 0 },
    });

    await queryInterface.sequelize.query(
      "ALTER TABLE zonas_envio ADD CONSTRAINT ck_zonas_costo CHECK (costo >= 0)"
    );
  },

  /**
   * @description Elimina la tabla de zonas de envío.
   * @param {import("sequelize").QueryInterface} queryInterface - Interfaz de consultas.
   * @returns {Promise<void>}
   */
  async down(queryInterface) {
    await queryInterface.dropTable("zonas_envio");
  },
};