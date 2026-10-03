const express = require("express");
const { body } = require("express-validator");

const db = require("../models");
const SequelizeCotizacionRepository = require("../repositories/sequelize/SequelizeCotizacionRepository");
const { Cotizador, TOPE_ITEMS } = require("../services/cotizador");
const CotizacionController = require("../controllers/CotizacionController");
const { manejarErroresValidacion } = require("../middlewares/validacion");

const router = express.Router();

const controller = new CotizacionController(
  new Cotizador(new SequelizeCotizacionRepository(db), {
    umbralEnvioGratis: process.env.ENVIO_GRATIS_DESDE || null,
    descuentoTransferencia: Number(process.env.DESCUENTO_TRANSFERENCIA || 0),
  })
);

/**
 * @description Reglas del carrito. El detalle de cada ítem lo valida el
 * cotizador, que puede nombrar la posición exacta dentro de la lista.
 */
const validarCotizacion = [
  body("items")
    .isArray({ min: 1, max: TOPE_ITEMS })
    .withMessage(`El carrito admite entre 1 y ${TOPE_ITEMS} productos`),
  body("zonaEnvioId")
    .optional({ values: "null" })
    .isInt({ min: 1 })
    .withMessage("Zona de envío inválida")
    .toInt(),
  body("medioPago")
    .optional({ values: "null" })
    .isIn(["transferencia", "mercadopago"])
    .withMessage("Medio de pago no reconocido"),
  manejarErroresValidacion,
];

/**
 * @openapi
 * /cotizar:
 *   post:
 *     tags: [Carrito]
 *     summary: Cotizar un carrito
 *     description: >
 *       Devuelve cuanto hay que pagar por un carrito. **No crea ni reserva
 *       nada**: el stock se verifica pero se descuenta recien al crear el pedido.
 *
 *
 *       Los precios NO vienen del carrito: se buscan en la base. El cliente
 *       manda que y cuanto, el servidor pone cuanto cuesta.
 *
 *
 *       Orden del calculo, que no se cambia sin acordarlo:
 *       subtotal, cupon, ajuste por medio de pago, envio. El redondeo al peso se
 *       hace una sola vez, sobre el total.
 *
 *
 *       Si un producto se agoto o se despublico mientras la persona compraba, se
 *       quita del carrito y se informa en `avisos`. Si la cantidad pedida supera
 *       el stock o el tope por producto, se ajusta y tambien se avisa. El
 *       frontend traduce esos codigos: la API no manda textos para mostrar.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CotizacionEntrada'
 *     responses:
 *       200:
 *         description: Carrito cotizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Cotizacion'
 *       400:
 *         description: >
 *           DATOS_INVALIDOS si el carrito esta mal formado,
 *           CARRITO_SIN_ITEMS_VALIDOS si ninguno de los productos se puede
 *           vender, o ZONA_INVALIDA si la zona no existe o esta inactiva.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: CARRITO_SIN_ITEMS_VALIDOS
 *       429:
 *         description: Demasiadas peticiones
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: LIMITE_SUPERADO
 */
router.post("/cotizar", validarCotizacion, controller.cotizar);

/**
 * @openapi
 * /zonas-envio:
 *   get:
 *     tags: [Carrito]
 *     summary: Listar las zonas de envio
 *     description: >
 *       Zonas activas con su tarifa plana, para que el checkout las muestre.
 *       Los costos viajan como cadena decimal, igual que los precios.
 *     responses:
 *       200:
 *         description: Zonas disponibles
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [datos]
 *               properties:
 *                 datos:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ZonaEnvio'
 */
router.get("/zonas-envio", controller.listarZonas);

module.exports = router;
