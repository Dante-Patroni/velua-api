"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  /**
   * @description Agrega a las categorías el identificador de su imagen en el
   * proveedor.
   *
   * `imagen_url` alcanza para mostrar la imagen, pero no para borrarla: Cloudinary
   * borra por `public_id`. Sin este dato, cada vez que se cambia la imagen de una
   * colección, la anterior queda huérfana en el proveedor consumiendo cuota para
   * siempre. Es la misma regla que ya cumplen las fotos de producto.
   *
   * @param {import("sequelize").QueryInterface} queryInterface - Interfaz de consultas.
   * @param {import("sequelize").Sequelize} Sequelize - Constructor con los tipos de dato.
   * @returns {Promise<void>}
   */
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("categorias", "imagen_public_id", {
      type: Sequelize.STRING(255),
      allowNull: true,
      after: "imagen_url",
    });
  },

  /**
   * @description Quita la columna.
   * @param {import("sequelize").QueryInterface} queryInterface - Interfaz de consultas.
   * @returns {Promise<void>}
   */
  async down(queryInterface) {
    await queryInterface.removeColumn("categorias", "imagen_public_id");
  },
};
