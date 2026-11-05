"use strict";

const bcrypt = require("bcryptjs");
const { COSTO_BCRYPT } = require("../services/AuthService");
const { exigirEntornoDeDesarrollo } = require("../config/soloDesarrollo");

const LARGO_MINIMO = 12;

/**
 * @description Mail del operador de prueba, tal como se guarda.
 * @returns {string|undefined} El mail en minúsculas y sin espacios.
 */
const mailDelOperador = () => process.env.OPERADOR_EMAIL?.trim().toLowerCase();

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  /**
   * @description Crea un usuario operador para las pruebas (Newman y el CI). A
   * diferencia del admin inicial, no existe en producción ni siquiera al crear:
   * su contraseña está en el repo público. Si ya existe, no hace nada.
   * @param {import("sequelize").QueryInterface} queryInterface - Interfaz de consultas.
   * @returns {Promise<void>}
   * @throws {Error} Fuera de desarrollo y pruebas, si faltan las variables o si la
   *   contraseña es corta.
   */
  async up(queryInterface) {
    exigirEntornoDeDesarrollo("Crear el operador de prueba");
    const email = mailDelOperador();
    const password = process.env.OPERADOR_PASSWORD;

    if (!email || !password) {
      throw new Error("Faltan OPERADOR_EMAIL u OPERADOR_PASSWORD en el entorno");
    }
    if (password.length < LARGO_MINIMO) {
      throw new Error(`OPERADOR_PASSWORD tiene que tener al menos ${LARGO_MINIMO} caracteres`);
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
        nombre: "Operador de prueba",
        email,
        password_hash: await bcrypt.hash(password, COSTO_BCRYPT),
        rol: "operador",
        activo: true,
        creado_en: new Date(),
      },
    ]);
  },

  /**
   * @description Borra el operador de prueba. Solo borra un usuario con rol
   * operador: aunque OPERADOR_EMAIL tuviera por error el mail del admin, no lo toca.
   * @param {import("sequelize").QueryInterface} queryInterface - Interfaz de consultas.
   * @returns {Promise<void>}
   */
  async down(queryInterface) {
    exigirEntornoDeDesarrollo("Borrar el operador de prueba");
    const email = mailDelOperador();
    if (email) {
      await queryInterface.bulkDelete("usuarios", { email, rol: "operador" }, {});
    }
  },
};
