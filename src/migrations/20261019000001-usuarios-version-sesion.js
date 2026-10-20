"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  /**
   * @description Agrega version_sesion a usuarios. Cada cambio de contraseña la
   * incrementa y el middleware rechaza los tokens emitidos con una versión anterior.
   * Las filas existentes quedan en 0, el mismo valor que llevan los tokens nuevos.
   * @param {import("sequelize").QueryInterface} queryInterface - Interfaz de consultas.
   * @param {typeof import("sequelize")} Sequelize - Tipos de Sequelize.
   * @returns {Promise<void>}
   */
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("usuarios", "version_sesion", {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
    });
  },

  /**
   * @description Quita version_sesion de usuarios.
   * @param {import("sequelize").QueryInterface} queryInterface - Interfaz de consultas.
   * @returns {Promise<void>}
   */
  async down(queryInterface) {
    await queryInterface.removeColumn("usuarios", "version_sesion");
  },
};