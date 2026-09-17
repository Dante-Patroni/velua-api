"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  /**
   * @description Crea las tablas de usuarios del panel y de solicitudes de arrepentimiento.
   * @param {import("sequelize").QueryInterface} queryInterface - Interfaz de consultas.
   * @param {import("sequelize").Sequelize} Sequelize - Constructor con los tipos de dato.
   * @returns {Promise<void>}
   */
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("usuarios", {
      id: {
        type: Sequelize.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      nombre: { type: Sequelize.STRING(120), allowNull: false },
      email: { type: Sequelize.STRING(180), allowNull: false, unique: true },
      password_hash: { type: Sequelize.STRING(255), allowNull: false },
      rol: {
        type: Sequelize.ENUM("admin", "operador"),
        allowNull: false,
        defaultValue: "operador",
      },
      activo: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      ultimo_acceso: { type: Sequelize.DATE, allowNull: true },
      creado_en: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    });

    await queryInterface.createTable("arrepentimientos", {
      id: {
        type: Sequelize.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      codigo: { type: Sequelize.STRING(30), allowNull: false, unique: true },
      pedido_numero: { type: Sequelize.STRING(20), allowNull: true },
      nombre: { type: Sequelize.STRING(140), allowNull: false },
      email: { type: Sequelize.STRING(180), allowNull: false },
      telefono: { type: Sequelize.STRING(40), allowNull: true },
      motivo: { type: Sequelize.STRING(600), allowNull: true },
      estado: {
        type: Sequelize.ENUM("recibido", "en_gestion", "resuelto"),
        allowNull: false,
        defaultValue: "recibido",
      },
      creado_en: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    });
  },

  /**
   * @description Elimina las tablas de administración.
   * @param {import("sequelize").QueryInterface} queryInterface - Interfaz de consultas.
   * @returns {Promise<void>}
   */
  async down(queryInterface) {
    await queryInterface.dropTable("arrepentimientos");
    await queryInterface.dropTable("usuarios");
  },
};
