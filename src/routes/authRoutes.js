const express = require("express");
const { body } = require("express-validator");

const db = require("../models");
const SequelizeUsuarioRepository = require("../repositories/sequelize/SequelizeUsuarioRepository");
const { AuthService } = require("../services/AuthService");
const AuthController = require("../controllers/AuthController");
const { authMiddleware } = require("../middlewares/authMiddleware");
const { limitadorLogin } = require("../middlewares/rateLimitMiddleware");
const { manejarErroresValidacion } = require("../middlewares/validacion");

const router = express.Router();

const authService = new AuthService(new SequelizeUsuarioRepository(db), {
  jwtSecret: process.env.JWT_SECRET,
  duracion: "8h",
});
const authController = new AuthController(authService);

/**
 * @description Reglas de validación del login.
 */
const validarLogin = [
  body("email")
    .isString()
    .trim()
    .isEmail()
    .withMessage("El mail no es válido")
    .isLength({ max: 180 }),
  body("password")
    .isString()
    .withMessage("La contraseña es obligatoria")
    .isLength({ min: 1, max: 128 })
    .withMessage("La contraseña es obligatoria"),
  manejarErroresValidacion,
];

/**
 * @openapi
 * /auth/login:
 *   post:
 *     tags: [Autenticacion]
 *     summary: Iniciar sesion en el panel
 *     description: >
 *       Verifica las credenciales y deja la sesion en una cookie httpOnly
 *       llamada velua_sesion. El token nunca viaja en el cuerpo de la respuesta.
 *       Limitado a 10 intentos cada 15 minutos por IP.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginEntrada'
 *     responses:
 *       200:
 *         description: Sesion iniciada. La cookie viene en el encabezado Set-Cookie.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Usuario'
 *       400:
 *         description: Datos invalidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Mail o contraseña incorrectos. No se distingue cual de los dos.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: CREDENCIALES_INVALIDAS
 *       403:
 *         description: Usuario desactivado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: USUARIO_INACTIVO
 *       429:
 *         description: Demasiados intentos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: LIMITE_SUPERADO
 */
router.post("/auth/login", limitadorLogin, validarLogin, authController.login);

/**
 * @openapi
 * /auth/logout:
 *   post:
 *     tags: [Autenticacion]
 *     summary: Cerrar sesion
 *     description: Borra la cookie de sesion. Responde 204 aunque no hubiera sesion.
 *     responses:
 *       204:
 *         description: Sesion cerrada
 */
router.post("/auth/logout", authController.logout);

/**
 * @openapi
 * /auth/yo:
 *   get:
 *     tags: [Autenticacion]
 *     summary: Usuario de la sesion actual
 *     description: >
 *       Devuelve el usuario logueado con sus permisos. El frontend lo usa para
 *       saber si hay sesion y que mostrar. Verifica que el usuario siga activo,
 *       aunque el token todavia no haya expirado.
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Usuario de la sesion
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Usuario'
 *       401:
 *         description: Sin sesion, token invalido o expirado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: TOKEN_EXPIRADO
 */
router.get("/auth/yo", authMiddleware, authController.yo);

module.exports = router;
