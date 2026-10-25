const express = require("express");
const { param, query } = require("express-validator");

const db = require("../models");
const SequelizePedidoRepository = require("../repositories/sequelize/SequelizePedidoRepository");
const { PedidoAdminService } = require("../services/PedidoAdminService");
const PedidoAdminController = require("../controllers/PedidoAdminController");
const { authMiddleware } = require("../middlewares/authMiddleware");
const { soloPermisos } = require("../middlewares/roleMiddleware");
const { manejarErroresValidacion } = require("../middlewares/validacion");
const { PERMISOS } = require("../config/permisos");
const { TRANSICIONES_PAGO, TRANSICIONES_PREPARACION } = require("../services/transicionesPedido");

const router = express.Router();

const controller = new PedidoAdminController(
  new PedidoAdminService(new SequelizePedidoRepository(db))
);

/** Máximo de pedidos por página: nadie puede pedir todos los pedidos de una vez. */
const LIMITE_MAXIMO = 50;

const validarListado = [
  query("estadoPago")
    .optional()
    .isIn(Object.keys(TRANSICIONES_PAGO))
    .withMessage("Estado de pago no reconocido"),
  query("estadoPedido")
    .optional()
    .isIn(Object.keys(TRANSICIONES_PREPARACION))
    .withMessage("Estado de preparación no reconocido"),
  query("pagina").optional().isInt({ min: 1, max: 10000 }).withMessage("Página inválida").toInt(),
  query("limite")
    .optional()
    .isInt({ min: 1, max: LIMITE_MAXIMO })
    .withMessage(`El límite va de 1 a ${LIMITE_MAXIMO}`)
    .toInt(),
  manejarErroresValidacion,
];

const validarId = [
  param("id").isInt({ min: 1 }).withMessage("Id inválido").toInt(),
  manejarErroresValidacion,
];
/**
 * @openapi
 * /admin/pedidos:
 *   get:
 *     tags: [Admin - Pedidos]
 *     summary: Listar los pedidos
 *     description: >
 *       Del más nuevo al más viejo. La lista muestra solo lo necesario para
 *       ubicar un pedido: los datos de contacto y la dirección van en el detalle.
 *       Máximo 50 por página.
 *     security:
 *       - cookieAuth: []
  *     parameters:
 *       - in: query
 *         name: estadoPago
 *         schema:
 *           $ref: '#/components/schemas/EstadoPago'
 *       - in: query
 *         name: estadoPedido
 *         schema:
 *           $ref: '#/components/schemas/EstadoPedido'
 *       - $ref: '#/components/parameters/Pagina'
 *       - $ref: '#/components/parameters/Limite'
 *     responses:
 *       200:
 *         description: Página de pedidos
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [datos, meta]
 *               properties:
 *                 datos:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/PedidoAdminFila'
 *                 meta:
 *                   $ref: '#/components/schemas/Meta'
 *       400:
 *         $ref: '#/components/responses/DatosInvalidos'
 *       401:
 *         $ref: '#/components/responses/NoAutorizado'
 *       403:
 *         $ref: '#/components/responses/SinPermiso'
 */
router.get(
  "/admin/pedidos",
  authMiddleware,
  soloPermisos(PERMISOS.PEDIDOS_VER),
  validarListado,
  controller.listar
);

/**
 * @openapi
 * /admin/pedidos/{id}:
 *   get:
 *     tags: [Admin - Pedidos]
 *     summary: Detalle de un pedido
 *     description: >
 *       Contacto, entrega, totales con sus descuentos, pago, ítems e historial de
 *       eventos. No incluye datos internos del procesador de pagos.
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/IdRuta'
 *     responses:
 *       200:
 *         description: El pedido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PedidoAdminDetalle'
 *       400:
 *         $ref: '#/components/responses/DatosInvalidos'
 *       401:
 *         $ref: '#/components/responses/NoAutorizado'
 *       403:
 *         $ref: '#/components/responses/SinPermiso'
 *       404:
 *         $ref: '#/components/responses/NoEncontrado'
 */
router.get(
  "/admin/pedidos/:id",
  authMiddleware,
  soloPermisos(PERMISOS.PEDIDOS_VER),
  validarId,
  controller.detalle
);

module.exports = router;
