"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  /**
   * @description Agrega a los productos la fecha desde la que se pueden vender.
   *
   * Los jabones en curado se muestran como "Próximamente" antes de esa fecha y no
   * se venden aunque tengan stock. Vacía significa que se vende normal. Es solo
   * fecha (sin hora): se vende desde las 00:00 de Argentina del día indicado.
   *
   * @param {import("sequelize").QueryInterface} queryInterface - Interfaz de consultas.
   * @param {import("sequelize").Sequelize} Sequelize - Constructor con los tipos de dato.
   * @returns {Promise<void>}
   */
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("productos", "disponible_desde", {
      type: Sequelize.DATEONLY,
      allowNull: true,
      after: "activo",
    });
  },

  /**
   * @description Quita la columna.
   * @param {import("sequelize").QueryInterface} queryInterface - Interfaz de consultas.
   * @returns {Promise<void>}
   */
  async down(queryInterface) {
    await queryInterface.removeColumn("productos", "disponible_desde");
  },
};
