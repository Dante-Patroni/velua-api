const express = require("express");
const { query } = require("express-validator");

const db = require("../models");
const SequelizeArrepentimientoRepository = require("../repositories/sequelize/SequelizeArrepentimientoRepository");
const { ArrepentimientoService } = require("../services/ArrepentimientoService");
const ArrepentimientoController = require("../controllers/ArrepentimientoController");
const { authMiddleware } = require("../middlewares/authMiddleware");
const { soloPermisos } = require("../middlewares/roleMiddleware");
const { manejarErroresValidacion } = require("../middlewares/validacion");
const { PERMISOS } = require("../config/permisos");

const router = express.Router();

const controller = new ArrepentimientoController(
  new ArrepentimientoService(new SequelizeArrepentimientoRepository(db))
);

const validarListado = [
  query("estado")
    .optional()
    .isIn(["recibido", "en_gestion", "resuelto"])
    .withMessage("Estado no reconocido"),
  query("pagina").optional().isInt({ min: 1 }).withMessage("Página inválida").toInt(),
  query("limite")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("El límite va de 1 a 100")
    .toInt(),
  manejarErroresValidacion,
];

/**
 * @openapi
 * /admin/arrepentimientos:
 *   get:
 *     tags: [Admin - Arrepentimientos]
 *     summary: Listar las solicitudes de arrepentimiento
 *     description: >
 *       De la más nueva a la más vieja. Incluye los datos de contacto de la
 *       clienta: por eso pide el permiso de ver pedidos. El plazo legal y si el
 *       pedido existe los evalúa quien gestiona la solicitud.
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: estado
 *         schema:
 *           type: string
 *           enum: [recibido, en_gestion, resuelto]
 *       - in: query
 *         name: pagina
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: limite
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *     responses:
 *       200:
 *         description: Página de solicitudes
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [datos, meta]
 *               properties:
 *                 datos:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       codigo:
 *                         type: string
 *                       pedidoNumero:
 *                         type: [string, "null"]
 *                       nombre:
 *                         type: string
 *                       email:
 *                         type: string
 *                       telefono:
 *                         type: [string, "null"]
 *                       motivo:
 *                         type: [string, "null"]
 *                       estado:
 *                         type: string
 *                         enum: [recibido, en_gestion, resuelto]
 *                       creadoEn:
 *                         type: string
 *                         format: date-time
 *                 meta:
 *                   type: object
 *                   properties:
 *                     pagina:
 *                       type: integer
 *                     limite:
 *                       type: integer
 *                     total:
 *                       type: integer
 *       400:
 *         $ref: '#/components/responses/DatosInvalidos'
 *       401:
 *         $ref: '#/components/responses/NoAutorizado'
 *       403:
 *         $ref: '#/components/responses/SinPermiso'
 */
router.get(
  "/admin/arrepentimientos",
  authMiddleware,
  soloPermisos(PERMISOS.PEDIDOS_VER),
  validarListado,
  controller.listar
);

module.exports = router;
