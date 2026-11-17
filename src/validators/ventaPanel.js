const { body, header } = require("express-validator");
const { TOPE_ITEMS } = require("../services/cotizador");
const { MEDIOS_PANEL, ENTREGAS_PANEL } = require("../services/ventaPanel");
const { manejarErroresValidacion } = require("../middlewares/validacion");

/**
 * @description Regla de texto opcional con largo máximo (el de la columna).
 * @param {string} campo - Ruta del campo en el cuerpo.
 * @param {number} maximo - Largo máximo.
 * @returns {Object} Cadena de validación nueva.
 */
const textoOpcional = (campo, maximo) =>
  body(campo)
    .optional({ values: "null" })
    .isString()
    .trim()
    .isLength({ max: maximo })
    .withMessage(`Hasta ${maximo} caracteres`);

/**
 * Reglas de los ítems y de la entrega: los mismos objetos para la venta y para su
 * cotización. Si cada ruta tuviera las suyas, la cotización podría aceptar un
 * carrito que la venta después rechaza.
 */
const reglasCarrito = [
  body("items")
    .isArray({ min: 1, max: TOPE_ITEMS })
    .withMessage(`La venta admite entre 1 y ${TOPE_ITEMS} productos`),
  body("items.*.varianteId").isInt({ min: 1 }).withMessage("Variante inválida").toInt(),
  body("items.*.cantidad").isInt({ min: 1 }).withMessage("Cantidad inválida").toInt(),

  body("entrega.metodo").isIn(ENTREGAS_PANEL).withMessage("Elegí envío, retiro o en mano"),
  body("entrega.zonaEnvioId")
    .optional({ values: "null" })
    .isInt({ min: 1 })
    .withMessage("Zona de envío inválida")
    .toInt(),
];

/**
 * Reglas de forma de POST /admin/ventas. Solo lo que está acá llega al servicio
 * (el controlador lee con matchedData): un campo de más en el cuerpo, como un
 * precio o un usuario, no se usa nunca.
 *
 * Las reglas entre campos (dirección o zona sin envío, efectivo cobrado con
 * transferencia, ítems repetidos) las aplica el servicio: son la misma regla para
 * cualquiera que lo llame.
 */
const reglas = [
  header("idempotency-key")
    .isUUID()
    .withMessage("Falta el encabezado Idempotency-Key, con un UUID por venta"),

  ...reglasCarrito,

  body("cliente.nombre")
    .isString()
    .trim()
    .isLength({ min: 2, max: 140 })
    .withMessage("Escribí el nombre"),
  body("cliente.telefono")
    .isString()
    .trim()
    .isLength({ min: 6, max: 40 })
    .withMessage("Escribí un teléfono de contacto"),
  // Opcional: muchas ventas en persona no tienen mail. Si viene, tiene que ser uno.
  body("cliente.email")
    .optional({ values: "falsy" })
    .isString()
    .trim()
    .isEmail()
    .withMessage("Revisá el mail")
    .isLength({ max: 180 }),
  textoOpcional("cliente.documento", 20),

  textoOpcional("entrega.direccion.calle", 180),
  textoOpcional("entrega.direccion.numero", 20),
  textoOpcional("entrega.direccion.extra", 120),
  textoOpcional("entrega.direccion.ciudad", 120),
  textoOpcional("entrega.direccion.provincia", 80),
  textoOpcional("entrega.direccion.cp", 20),

  body("medioPago").isIn(MEDIOS_PANEL).withMessage("Efectivo o transferencia"),
  // Solo los booleanos: ni "true", ni 1, ni "1". Es la dueña diciendo que ya cobró.
  body("cobradoEnEfectivo")
    .optional()
    .custom((valor) => valor === true || valor === false)
    .withMessage("Tiene que ser true o false"),

  body("totalEsperado")
    .isString()
    .withMessage("Falta el total que se mostró")
    .matches(/^\d{1,12}([.,]\d{1,2})?$/)
    .withMessage("Tiene que ser un importe"),
  textoOpcional("notas", 500),
];

/**
 * Reglas de forma de POST /admin/ventas/cotizacion: las del carrito, y el medio de
 * pago opcional (sin él, la cotización trae el total de cada medio).
 */
const reglasCotizacion = [
  ...reglasCarrito,
  body("medioPago")
    .optional({ values: "null" })
    .isIn(MEDIOS_PANEL)
    .withMessage("Efectivo o transferencia"),
];

/** Las reglas y, al final, la respuesta 400 si alguna falla. */
const validarVentaPanel = [...reglas, manejarErroresValidacion];

/** Lo mismo para la cotización. */
const validarCotizacionPanel = [...reglasCotizacion, manejarErroresValidacion];

module.exports = {
  validarVentaPanel,
  validarCotizacionPanel,
  reglas,
  reglasCarrito,
  reglasCotizacion,
};
