"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  /**
   * @description Agrega public_id a imagenes_producto, necesario para borrar el
   * archivo en Cloudinary cuando se elimina una imagen o un producto.
   * @param {import("sequelize").QueryInterface} queryInterface - Interfaz de consultas.
   * @param {import("sequelize").Sequelize} Sequelize - Constructor con los tipos de dato.
   * @returns {Promise<void>}
   */
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("imagenes_producto", "public_id", {
      type: Sequelize.STRING(200),
      allowNull: true,
      after: "url",
    });
  },

  /**
   * @description Quita la columna public_id de imagenes_producto.
   * @param {import("sequelize").QueryInterface} queryInterface - Interfaz de consultas.
   * @returns {Promise<void>}
   */
  async down(queryInterface) {
    await queryInterface.removeColumn("imagenes_producto", "public_id");
  },
};