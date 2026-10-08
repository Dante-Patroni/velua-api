"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  /**
   * @description Agrega a las categorías su categoría padre, para tener dos
   * niveles: la línea de producto arriba (Jabones, Cuidado capilar) y las
   * colecciones debajo.
   *
   * Es nullable porque las categorías de primer nivel no tienen padre, y porque
   * así las tres colecciones actuales siguen funcionando igual hasta que se les
   * asigne uno desde el panel. La clave foránea impide apuntar a una categoría
   * que no existe; las demás reglas (solo dos niveles, productos o hijas) las
   * hace cumplir el servicio, porque MySQL no puede expresarlas.
   *
   * @param {import("sequelize").QueryInterface} queryInterface - Interfaz de consultas.
   * @param {import("sequelize").Sequelize} Sequelize - Constructor con los tipos de dato.
   * @returns {Promise<void>}
   */
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("categorias", "padre_id", {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: true,
      after: "id",
    });

    // La clave foránea va aparte y con nombre propio: así el down la puede
    // quitar por su nombre. MySQL no deja borrar una columna con una clave
    // foránea encima, y el nombre automático cambia de una base a otra.
    await queryInterface.addConstraint("categorias", {
      fields: ["padre_id"],
      type: "foreign key",
      name: "fk_categorias_padre",
      references: { table: "categorias", field: "id" },
      onUpdate: "CASCADE",
      // Las categorías no se borran, se despublican. Si alguna vez se borrara
      // un padre con hijas, que falle en vez de dejar hijas huérfanas.
      onDelete: "RESTRICT",
    });
  },

  /**
   * @description Quita la columna, junto con su clave foránea.
   * @param {import("sequelize").QueryInterface} queryInterface - Interfaz de consultas.
   * @returns {Promise<void>}
   */
  async down(queryInterface) {
    await queryInterface.removeConstraint("categorias", "fk_categorias_padre");
    await queryInterface.removeColumn("categorias", "padre_id");
  },
};
