const express = require("express");
const { body } = require("express-validator");

const db = require("../models");
const SequelizePedidoRepository = require("../repositories/sequelize/SequelizePedidoRepository");
const { CheckoutService } = require("../services/CheckoutService");
const { TOPE_ITEMS } = require("../services/cotizador");
const PedidoController = require("../controllers/PedidoController");
const { manejarErroresValidacion } = require("../middlewares/validacion");
const { limitadorPedidos } = require("../middlewares/rateLimitMiddleware");
const { MercadoPagoProcesador } = require("../pagos/MercadoPagoProcesador");

const router = express.Router();

const controller = new PedidoController(
  new CheckoutService(
    new SequelizePedidoRepository(db),
    {
      umbralEnvioGratis: process.env.ENVIO_GRATIS_DESDE || null,
      descuentoTransferencia: Number(process.env.DESCUENTO_TRANSFERENCIA || 0),
    },
    undefined,
    new MercadoPagoProcesador()
  )
);

/**
 * @description Regla de texto opcional con largo máximo.
 *
 * Los máximos son los de las columnas de la base. Si un texto los supera, MySQL lo
 * rechaza y eso sería un 500; validándolo acá es un 400 que dice qué campo sobra.
 *
 * @param {string} campo - Ruta del campo en el cuerpo.
 * @param {number} maximo - Largo máximo de la columna.
 * @returns {Object} Cadena de validación nueva.
 */
const textoOpcional = (campo, maximo) =>
  body(campo)
    .optional({ values: "null" })
    .isString()
    .trim()
    .isLength({ max: maximo })
    .withMessage(`Hasta ${maximo} caracteres`);

const validarPedido = [
  body("items")
    .isArray({ min: 1, max: TOPE_ITEMS })
    .withMessage(`El carrito admite entre 1 y ${TOPE_ITEMS} productos`),

  body("cliente.nombre")
    .isString()
    .trim()
    .isLength({ min: 2, max: 140 })
    .withMessage("Escribí tu nombre"),
  body("cliente.email")
    .isString()
    .trim()
    .isEmail()
    .withMessage("Revisá el mail")
    .isLength({ max: 180 }),
  body("cliente.telefono")
    .isString()
    .trim()
    .isLength({ min: 6, max: 40 })
    .withMessage("Escribí un teléfono de contacto"),
  textoOpcional("cliente.documento", 20),

  body("entrega.metodo").isIn(["envio", "retiro"]).withMessage("Elegí envío o retiro"),
  body("entrega.zonaEnvioId")
    .optional({ values: "null" })
    .isInt({ min: 1 })
    .withMessage("Zona de envío inválida")
    .toInt(),
  textoOpcional("entrega.direccion.calle", 180),
  textoOpcional("entrega.direccion.numero", 20),
  textoOpcional("entrega.direccion.extra", 120),
  textoOpcional("entrega.direccion.ciudad", 120),
  textoOpcional("entrega.direccion.provincia", 80),
  textoOpcional("entrega.direccion.cp", 20),

  body("medioPago").isIn(["mercadopago", "transferencia"]).withMessage("Elegí cómo vas a pagar"),
  body("totalEsperado")
    .isString()
    .withMessage("Falta el total que se mostró")
    .matches(/^\d{1,12}([.,]\d{1,2})?$/)
    .withMessage("Tiene que ser un importe"),
  textoOpcional("notas", 500),

  manejarErroresValidacion,
];

/**
 * @openapi
 * /pedidos:
 *   post:
 *     tags: [Pedidos]
 *     summary: Crear un pedido
 *     description: >
 *       Convierte el carrito en un pedido con el stock apartado. Todo pasa en una
 *       transaccion: si algo falla, no queda nada.
 *
 *
 *       Es mas estricto que /cotizar: **nunca cobra algo distinto de lo que la
 *       clienta vio**. Si algo del carrito cambio (stock, producto despublicado,
 *       tope), responde CARRITO_DESACTUALIZADO. Si el total no coincide con
 *       `totalEsperado`, responde TOTAL_CAMBIO. En los dos casos el frontend tiene
 *       que volver a cotizar y mostrarle a la clienta que cambio.
 *
 *
 *       El stock queda apartado 1 hora con Mercado Pago y 24 horas con
 *       transferencia. Limitado a 10 pedidos por hora por IP: crear pedidos aparta
 *       stock, y sin limite alguien podria agotar el catalogo con pedidos falsos.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PedidoEntrada'
 *     responses:
 *       201:
 *         description: Pedido creado, con pago pendiente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PedidoCreado'
 *       400:
 *         description: >
 *           DATOS_INVALIDOS, CARRITO_SIN_ITEMS_VALIDOS o ZONA_INVALIDA.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       409:
 *         description: >
 *           CARRITO_DESACTUALIZADO, TOTAL_CAMBIO o STOCK_INSUFICIENTE. El estado
 *           cambio desde que la clienta miro el carrito: hay que volver a cotizar.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: TOTAL_CAMBIO
 *       429:
 *         description: Demasiados pedidos desde la misma direccion
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: LIMITE_SUPERADO
 */
router.post("/pedidos", limitadorPedidos, validarPedido, controller.crear);

/**
 * @openapi
 * /pedidos/{numero}:
 *   get:
 *     tags: [Pedidos]
 *     summary: Consultar el estado de un pedido
 *     description: >
 *       Publico y sin sesion: lo usa la pagina de resultado del pago. El numero es
 *       imposible de adivinar y funciona como llave, y la respuesta **no incluye
 *       ningun dato personal**: ni nombre, ni mail, ni telefono, ni direccion.
 *     parameters:
 *       - name: numero
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           example: VEL-4K7Q2X
 *     responses:
 *       200:
 *         description: Estado del pedido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PedidoPublico'
 *       404:
 *         $ref: '#/components/responses/NoEncontrado'
 */
router.get("/pedidos/:numero", controller.consultar);

/**
 * @openapi
 * /pedidos/{numero}/pago:
 *   post:
 *     tags: [Pedidos]
 *     summary: Generar un link de pago de Mercado Pago
 *     description: >
 *       Para un pedido de Mercado Pago con el pago pendiente o rechazado y la
 *       reserva vigente. Se usa si al crear el pedido Mercado Pago no respondio
 *       (urlPago null), o para reintentar despues de un rechazo. Publico: el numero
 *       funciona como llave. Comparte el limite de 10 por hora por IP con la
 *       creacion de pedidos.
 *     parameters:
 *       - name: numero
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           example: VEL-4K7Q2X
 *     responses:
 *       200:
 *         description: Link de pago
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PagoIniciado'
 *       404:
 *         $ref: '#/components/responses/NoEncontrado'
 *       409:
 *         description: >
 *           PEDIDO_NO_PAGABLE (otro medio de pago, o ya aprobado o cancelado) o
 *           PEDIDO_VENCIDO (la reserva vencio).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       502:
 *         description: PROCESADOR_NO_DISPONIBLE. Mercado Pago no respondio.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post("/pedidos/:numero/pago", limitadorPedidos, controller.iniciarPago);

module.exports = router;
