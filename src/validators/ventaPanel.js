const { body, header } = require("express-validator");
const { TOPE_ITEMS } = require("../services/cotizador");
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

  body("items")
    .isArray({ min: 1, max: TOPE_ITEMS })
    .withMessage(`La venta admite entre 1 y ${TOPE_ITEMS} productos`),
  body("items.*.varianteId").isInt({ min: 1 }).withMessage("Variante inválida").toInt(),
  body("items.*.cantidad").isInt({ min: 1 }).withMessage("Cantidad inválida").toInt(),

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

  body("entrega.metodo")
    .isIn(["envio", "retiro", "en_mano"])
    .withMessage("Elegí envío, retiro o en mano"),
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

  body("medioPago").isIn(["efectivo", "transferencia"]).withMessage("Efectivo o transferencia"),
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

/** Las reglas y, al final, la respuesta 400 si alguna falla. */
const validarVentaPanel = [...reglas, manejarErroresValidacion];

module.exports = { validarVentaPanel, reglas };
