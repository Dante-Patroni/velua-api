"use strict";

const bcrypt = require("bcryptjs");
const { COSTO_BCRYPT } = require("../services/AuthService");

const LARGO_MINIMO = 12;

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  /**
   * @description Crea el primer usuario admin a partir de variables de entorno.
   * Si ya existe un usuario con ese mail, no hace nada.
   * @param {import("sequelize").QueryInterface} queryInterface - Interfaz de consultas.
   * @returns {Promise<void>}
   * @throws {Error} Si faltan las variables o la contraseña es corta.
   */
  async up(queryInterface) {
    const nombre = process.env.ADMIN_NOMBRE;
    const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    const password = process.env.ADMIN_PASSWORD;

    if (!nombre || !email || !password) {
      throw new Error("Faltan ADMIN_NOMBRE, ADMIN_EMAIL o ADMIN_PASSWORD en el entorno");
    }
    if (password.length < LARGO_MINIMO) {
      throw new Error(`ADMIN_PASSWORD tiene que tener al menos ${LARGO_MINIMO} caracteres`);
    }

    const existentes = await queryInterface.sequelize.query(
      "SELECT id FROM usuarios WHERE email = :email",
      { replacements: { email }, type: queryInterface.sequelize.QueryTypes.SELECT }
    );
    if (existentes.length > 0) {
      return;
    }

    await queryInterface.bulkInsert("usuarios", [
      {
        nombre,
        email,
        password_hash: await bcrypt.hash(password, COSTO_BCRYPT),
        rol: "admin",
        activo: true,
        creado_en: new Date(),
      },
    ]);
  },

  /**
   * @description Borra el usuario inicial, identificado por su mail.
   * @param {import("sequelize").QueryInterface} queryInterface - Interfaz de consultas.
   * @returns {Promise<void>}
   */
  async down(queryInterface) {
    const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    if (email) {
      await queryInterface.bulkDelete("usuarios", { email }, {});
    }
  },
};
