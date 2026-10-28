const express = require("express");
const { body, param, query } = require("express-validator");

const db = require("../models");
const SequelizePedidoRepository = require("../repositories/sequelize/SequelizePedidoRepository");
const { PedidoAdminService } = require("../services/PedidoAdminService");
  const { PedidoEstadoService, AVANCES_PREPARACION, SEGUIMIENTO_VALIDO } = require("../services/PedidoEstadoService");
const PedidoAdminController = require("../controllers/PedidoAdminController");
const { authMiddleware } = require("../middlewares/authMiddleware");
const { soloPermisos } = require("../middlewares/roleMiddleware");
const { manejarErroresValidacion } = require("../middlewares/validacion");
const { PERMISOS } = require("../config/permisos");
const { TRANSICIONES_PAGO, TRANSICIONES_PREPARACION } = require("../services/transicionesPedido");

const router = express.Router();

const repositorio = new SequelizePedidoRepository(db);
const controller = new PedidoAdminController(
  new PedidoAdminService(repositorio),
  new PedidoEstadoService(repositorio)
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

const idRuta = param("id").isInt({ min: 1 }).withMessage("Id inválido").toInt();

const validarId = [idRuta, manejarErroresValidacion];

const validarPreparacion = [
  idRuta,
  body("estado")
    .isString()
    .bail()
    .isIn(AVANCES_PREPARACION)
    .withMessage("Estado de preparación no permitido"),
  body("seguimiento")
    .optional()
    .isString()
    .bail()
    .trim()
    .matches(SEGUIMIENTO_VALIDO)
    .withMessage("El seguimiento lleva de 6 a 40 letras, números o guiones"),
  manejarErroresValidacion,
];

const validarCancelacion = [
  idRuta,
  body("motivo")
    .isString()
    .withMessage("El motivo es obligatorio")
    .bail()
    .trim()
    .isLength({ min: 5, max: 500 })
    .withMessage("El motivo lleva de 5 a 500 caracteres"),
  body("confirmaSinPago")
    .optional()
    .custom((valor) => typeof valor === "boolean")
    .withMessage("confirmaSinPago tiene que ser true o false"),
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

/**
 * @openapi
 * /admin/pedidos/{id}/preparacion:
 *   patch:
 *     tags: [Admin - Pedidos]
 *     summary: Avanzar la preparación de un pedido
 *     description: >
 *       Preparar, despachar o marcar como entregado, de a un paso y solo con el
 *       pago aprobado. Para despachar un envío hace falta el código de seguimiento,
 *       y al despacharlo se encola un mail a la clienta. Lo pueden hacer el admin
 *       y el operador. Queda en el historial con el usuario de la sesión.
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/IdRuta'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PreparacionEntrada'
 *     responses:
 *       200:
 *         description: Estado actualizado, o sin cambios si ya estaba en ese estado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PreparacionResultado'
 *       400:
 *         description: >
 *           DATOS_INVALIDOS (con details), TRANSICION_INVALIDA (salto de estado),
 *           PAGO_NO_APROBADO o SEGUIMIENTO_REQUERIDO.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: PAGO_NO_APROBADO
 *       401:
 *         $ref: '#/components/responses/NoAutorizado'
 *       403:
 *         $ref: '#/components/responses/SinPermiso'
 *       404:
 *         $ref: '#/components/responses/NoEncontrado'
 */
router.patch(
  "/admin/pedidos/:id/preparacion",
  authMiddleware,
  soloPermisos(PERMISOS.PEDIDOS_GESTIONAR),
  validarPreparacion,
  controller.cambiarPreparacion
);

/**
 * @openapi
 * /admin/pedidos/{id}/cancelacion:
 *   post:
 *     tags: [Admin - Pedidos]
 *     summary: Cancelar un pedido sin pagar
 *     description: >
 *       Solo el admin. Solo pedidos nuevos con el pago pendiente o rechazado: uno
 *       pagado se devuelve primero. Devuelve el stock una sola vez y encola un mail
 *       a la clienta, sin el motivo. Si la clienta informó una transferencia, hace
 *       falta confirmaSinPago en true. Cancelar dos veces no es un error.
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/IdRuta'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CancelacionEntrada'
 *     responses:
 *       200:
 *         description: Pedido cancelado, o sin cambios si ya estaba cancelado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CancelacionResultado'
 *       400:
 *         description: >
 *           DATOS_INVALIDOS (con details) o TRANSICION_INVALIDA (pedido devuelto
 *           o que ya no está en nuevo).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: DATOS_INVALIDOS
 *               details:
 *                 motivo: El motivo lleva de 5 a 500 caracteres
 *       401:
 *         $ref: '#/components/responses/NoAutorizado'
 *       403:
 *         $ref: '#/components/responses/SinPermiso'
 *       404:
 *         $ref: '#/components/responses/NoEncontrado'
 *       409:
 *         description: >
 *           PEDIDO_PAGADO (primero hay que devolver el pago) o
 *           COMPROBANTE_INFORMADO (falta confirmaSinPago).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               pagado:
 *                 value:
 *                   error: PEDIDO_PAGADO
 *               comprobante:
 *                 value:
 *                   error: COMPROBANTE_INFORMADO
 */
router.post(
  "/admin/pedidos/:id/cancelacion",
  authMiddleware,
  soloPermisos(PERMISOS.PEDIDOS_CANCELAR),
  validarCancelacion,
  controller.cancelar
);

module.exports = router;
