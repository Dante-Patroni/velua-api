const express = require("express");
const { body } = require("express-validator");

const db = require("../models");
const SequelizeArrepentimientoRepository = require("../repositories/sequelize/SequelizeArrepentimientoRepository");
const { ArrepentimientoService } = require("../services/ArrepentimientoService");
const ArrepentimientoController = require("../controllers/ArrepentimientoController");
const { manejarErroresValidacion } = require("../middlewares/validacion");
const { limitadorArrepentimiento } = require("../middlewares/rateLimitMiddleware");

const router = express.Router();

const controller = new ArrepentimientoController(
  new ArrepentimientoService(new SequelizeArrepentimientoRepository(db))
);

/** Mismo formato que los números de pedido: VEL- y seis caracteres sin confusiones. */
const FORMATO_PEDIDO = /^VEL-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/;

/**
 * @description Reglas del formulario. Solo se valida la forma: que el pedido
 * exista no se confirma, para que el formulario no sirva para averiguar números.
 */
const validarArrepentimiento = [
  body("pedidoNumero")
    .optional({ values: "falsy" })
    .isString()
    .bail()
    .trim()
    .toUpperCase()
    .matches(FORMATO_PEDIDO)
    .withMessage("El número de pedido tiene la forma VEL-XXXXXX"),
  body("nombre")
    .isString()
    .withMessage("Ingresá tu nombre")
    .bail()
    .trim()
    .isLength({ min: 2, max: 140 })
    .withMessage("Ingresá tu nombre"),
  body("email")
    .isString()
    .withMessage("Ingresá un email válido")
    .bail()
    .trim()
    .isLength({ max: 180 })
    .isEmail()
    .withMessage("Ingresá un email válido"),
  body("telefono")
    .optional({ values: "falsy" })
    .isString()
    .bail()
    .trim()
    .isLength({ max: 40 })
    .withMessage("El teléfono admite hasta 40 caracteres"),
  body("motivo")
    .optional({ values: "falsy" })
    .isString()
    .bail()
    .trim()
    .isLength({ max: 600 })
    .withMessage("El motivo admite hasta 600 caracteres"),
  manejarErroresValidacion,
];

/**
 * @openapi
 * /arrepentimientos:
 *   post:
 *     tags: [Arrepentimiento]
 *     summary: Solicitar el arrepentimiento de una compra
 *     description: >
 *       Botón de arrepentimiento (Resolución 424/2020). No requiere registrarse.
 *       Siempre registra la solicitud y devuelve un código de trámite, que
 *       también se le manda por mail a la clienta.
 *
 *
 *       No confirma si el pedido existe ni controla el plazo legal: de eso se
 *       ocupa la dueña. El motivo es opcional: no hace falta justificar.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [nombre, email]
 *             properties:
 *               pedidoNumero:
 *                 type: string
 *                 example: VEL-TV89DE
 *               nombre:
 *                 type: string
 *                 maxLength: 140
 *               email:
 *                 type: string
 *                 format: email
 *                 maxLength: 180
 *               telefono:
 *                 type: string
 *                 maxLength: 40
 *               motivo:
 *                 type: string
 *                 maxLength: 600
 *     responses:
 *       201:
 *         description: Solicitud registrada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [codigo, creadoEn]
 *               properties:
 *                 codigo:
 *                   type: string
 *                   example: ARR-K7Q2XM
 *                 creadoEn:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: DATOS_INVALIDOS, con el campo que falla en details.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       429:
 *         description: Demasiadas solicitudes desde la misma dirección
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: LIMITE_SUPERADO
 */
router.post(
  "/arrepentimientos",
  limitadorArrepentimiento,
  validarArrepentimiento,
  controller.registrar
);

module.exports = router;
