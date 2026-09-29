const express = require("express");
const { body, param, query } = require("express-validator");

const db = require("../models");
const SequelizeProductoRepository = require("../repositories/sequelize/SequelizeProductoRepository");
const ProductoAdminService = require("../services/ProductoAdminService");
const ProductoAdminController = require("../controllers/ProductoAdminController");
const { authMiddleware } = require("../middlewares/authMiddleware");
const { soloPermisos } = require("../middlewares/roleMiddleware");
const { manejarErroresValidacion } = require("../middlewares/validacion");
const { PERMISOS } = require("../config/permisos");

const router = express.Router();

const SequelizeImagenRepository = require("../repositories/sequelize/SequelizeImagenRepository");
const CloudinaryStorage = require("../almacenamiento/CloudinaryStorage");
const { ImagenAdminService } = require("../services/ImagenAdminService");

const controller = new ProductoAdminController(
  new ProductoAdminService(
    new SequelizeProductoRepository(db),
    new ImagenAdminService(new SequelizeImagenRepository(db), new CloudinaryStorage())
  )
);

/**
 * @description Cadena de protección: sesión válida más el permiso indicado.
 * @param {string} permiso - Permiso requerido.
 * @returns {Array<Function>} Middlewares de autenticación y autorización.
 */
const proteger = (permiso) => [authMiddleware, soloPermisos(permiso)];

/**
 * @description Regla del id del producto en la ruta.
 * @returns {Object} Cadena de validación nueva.
 */
const validarId = () => param("id").isInt({ min: 1 }).withMessage("Id inválido").toInt();

/**
 * @description Regla del id de la variante en la ruta.
 * @returns {Object} Cadena de validación nueva.
 */
const validarVarianteId = () =>
  param("varianteId").isInt({ min: 1 }).withMessage("Id de variante inválido").toInt();

/**
 * @description Reglas de los campos de un producto. Cada propiedad devuelve una
 * cadena de validación nueva: las de express-validator se modifican al
 * encadenar, así que compartirlas entre crear y editar las corrompe.
 */
/* eslint-disable jsdoc/require-jsdoc */
const campos = {
  categoriaId: () =>
    body("categoriaId").isInt({ min: 1 }).withMessage("Elegí una categoría").toInt(),
  nombre: () =>
    body("nombre")
      .isString()
      .trim()
      .isLength({ min: 1, max: 140 })
      .withMessage("El nombre es obligatorio y admite hasta 140 caracteres"),
  slug: () =>
    body("slug")
      .optional({ values: "null" })
      .isString()
      .trim()
      .isLength({ max: 160 })
      .withMessage("El slug admite hasta 160 caracteres"),
  descripcionCorta: () =>
    body("descripcionCorta")
      .optional({ values: "null" })
      .isString()
      .isLength({ max: 300 })
      .withMessage("La descripción corta admite hasta 300 caracteres"),
  descripcion: () => body("descripcion").optional({ values: "null" }).isString(),
  ingredientes: () => body("ingredientes").optional({ values: "null" }).isString(),
  modoUso: () => body("modoUso").optional({ values: "null" }).isString(),
  destacado: () =>
    body("destacado")
      .optional()
      .isBoolean({ strict: true })
      .withMessage("Tiene que ser true o false"),
};
/* eslint-enable jsdoc/require-jsdoc */

/**
 * @description Reglas de una variante. El formato de los importes lo valida el
 * servicio, que da un mensaje por campo con la posición dentro de la lista.
 * @param {string} prefijo - Prefijo del campo: "variantes.*" o cadena vacía.
 * @returns {Array<Object>} Cadenas de validación.
 */
const camposVariante = (prefijo) => {
  const nombre = prefijo ? `${prefijo}.` : "";
  return [
    body(`${nombre}nombre`)
      .isString()
      .trim()
      .isLength({ min: 1, max: 80 })
      .withMessage("Cada variante necesita un nombre"),
    body(`${nombre}sku`).optional({ values: "null" }).isString().trim().isLength({ max: 60 }),
    body(`${nombre}precio`).exists().withMessage("Cada variante necesita un precio"),
    body(`${nombre}precioAnterior`).optional({ values: "null" }),
    body(`${nombre}stock`)
      .optional()
      .isInt({ min: 0 })
      .withMessage("El stock tiene que ser un entero de cero o más"),
    body(`${nombre}pesoGramos`).optional({ values: "null" }).isInt({ min: 0 }),
  ];
};

const validarListado = [
  query("pagina").optional().isInt({ min: 1 }).toInt(),
  query("limite").optional().isInt({ min: 1, max: 50 }).toInt(),
  query("q").optional().isString().trim().isLength({ max: 80 }),
  query("categoriaId").optional().isInt({ min: 1 }).toInt(),
  query("estado")
    .optional()
    .isIn(["todos", "activos", "inactivos"])
    .withMessage("Estado no reconocido"),
  query("orden")
    .optional()
    .isIn(["recientes", "nombre", "stock"])
    .withMessage("Orden no reconocido"),
  manejarErroresValidacion,
];

const validarCrear = [
  campos.categoriaId(),
  campos.nombre(),
  campos.slug(),
  campos.descripcionCorta(),
  campos.descripcion(),
  campos.ingredientes(),
  campos.modoUso(),
  campos.destacado(),
  body("variantes").isArray({ min: 1 }).withMessage("Cargá al menos una variante"),
  ...camposVariante("variantes.*"),
  manejarErroresValidacion,
];

const validarActualizar = [
  validarId(),
  campos.categoriaId().optional(),
  campos.nombre().optional(),
  campos.slug(),
  campos.descripcionCorta(),
  campos.descripcion(),
  campos.ingredientes(),
  campos.modoUso(),
  campos.destacado(),
  manejarErroresValidacion,
];

/**
 * @openapi
 * /admin/productos:
 *   get:
 *     tags: [Admin - Productos]
 *     summary: Listar productos para la grilla del panel
 *     description: >
 *       Incluye los inactivos. Cada fila trae cuantas variantes activas tiene,
 *       el precio minimo, el stock total y cuantas imagenes cargadas, para poder
 *       ver de un vistazo que falta completar.
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/Pagina'
 *       - $ref: '#/components/parameters/Limite'
 *       - in: query
 *         name: q
 *         description: Busca en nombre y slug.
 *         schema: { type: string, maxLength: 80 }
 *       - in: query
 *         name: categoriaId
 *         schema: { type: integer, minimum: 1 }
 *       - in: query
 *         name: estado
 *         schema: { type: string, enum: [todos, activos, inactivos], default: todos }
 *       - in: query
 *         name: orden
 *         description: >
 *           `recientes` es el orden por defecto. `stock` ordena de menor a mayor
 *           stock total, que es lo util para ver que hay que reponer.
 *         schema: { type: string, enum: [recientes, nombre, stock], default: recientes }
 *     responses:
 *       200:
 *         description: Productos paginados
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [datos, meta]
 *               properties:
 *                 datos:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ProductoAdminFila'
 *                 meta:
 *                   $ref: '#/components/schemas/Meta'
 *       400:
 *         $ref: '#/components/responses/DatosInvalidos'
 *       401:
 *         $ref: '#/components/responses/NoAutorizado'
 *       403:
 *         $ref: '#/components/responses/SinPermiso'
 *   post:
 *     tags: [Admin - Productos]
 *     summary: Crear un producto con sus variantes
 *     description: >
 *       El producto y sus variantes se crean juntos en una transaccion: el
 *       esquema exige al menos una variante, asi que un producto sin ellas
 *       quedaria invalido.
 *
 *
 *       Reglas de importes: se aceptan con punto o coma y se guardan con dos
 *       decimales. `precioAnterior` tiene que ser MAYOR que `precio`; si fuera
 *       igual o menor, la tienda mostraria un descuento de cero por ciento.
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ProductoEntrada'
 *     responses:
 *       201:
 *         description: Producto creado, con su ficha completa
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ProductoAdmin'
 *       400:
 *         description: >
 *           Datos invalidos, o SIN_VARIANTES si no se cargo ninguna. En
 *           DATOS_INVALIDOS, details indica el campo con la posicion dentro de
 *           la lista, por ejemplo "variantes[1].precio".
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: DATOS_INVALIDOS
 *               details:
 *                 variantes[1].precioAnterior: Tiene que ser mayor que el precio actual
 *       401:
 *         $ref: '#/components/responses/NoAutorizado'
 *       403:
 *         $ref: '#/components/responses/SinPermiso'
 *       409:
 *         $ref: '#/components/responses/Conflicto'
 */
router.get("/admin/productos", proteger(PERMISOS.CATALOGO_VER), validarListado, controller.listar);
router.post("/admin/productos", proteger(PERMISOS.CATALOGO_EDITAR), validarCrear, controller.crear);

/**
 * @openapi
 * /admin/productos/{id}:
 *   get:
 *     tags: [Admin - Productos]
 *     summary: Ficha completa de un producto
 *     description: >
 *       Incluye TODAS las variantes, activas e inactivas, con su stock real, y
 *       todas las imagenes con su id, que el panel necesita para borrarlas.
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/IdRuta'
 *     responses:
 *       200:
 *         description: Producto
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ProductoAdmin'
 *       401:
 *         $ref: '#/components/responses/NoAutorizado'
 *       403:
 *         $ref: '#/components/responses/SinPermiso'
 *       404:
 *         $ref: '#/components/responses/NoEncontrado'
 *   patch:
 *     tags: [Admin - Productos]
 *     summary: Editar un producto
 *     description: >
 *       Solo se modifican los campos que vienen. NO toca las variantes: cada una
 *       tiene sus propios endpoints. Cambiar el nombre no cambia el slug.
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/IdRuta'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ProductoCambios'
 *     responses:
 *       200:
 *         description: Producto actualizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ProductoAdmin'
 *       400:
 *         $ref: '#/components/responses/DatosInvalidos'
 *       401:
 *         $ref: '#/components/responses/NoAutorizado'
 *       403:
 *         $ref: '#/components/responses/SinPermiso'
 *       404:
 *         $ref: '#/components/responses/NoEncontrado'
 *       409:
 *         $ref: '#/components/responses/Conflicto'
 */
router.get(
  "/admin/productos/:id",
  proteger(PERMISOS.CATALOGO_VER),
  [validarId(), manejarErroresValidacion],
  controller.obtener
);
router.patch(
  "/admin/productos/:id",
  proteger(PERMISOS.CATALOGO_EDITAR),
  validarActualizar,
  controller.actualizar
);

/**
 * @openapi
 * /admin/productos/{id}/estado:
 *   patch:
 *     tags: [Admin - Productos]
 *     summary: Publicar o despublicar un producto
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/IdRuta'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [activo]
 *             properties:
 *               activo: { type: boolean }
 *     responses:
 *       200:
 *         description: Producto con su estado nuevo
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ProductoAdmin'
 *       400:
 *         $ref: '#/components/responses/DatosInvalidos'
 *       401:
 *         $ref: '#/components/responses/NoAutorizado'
 *       403:
 *         $ref: '#/components/responses/SinPermiso'
 *       404:
 *         $ref: '#/components/responses/NoEncontrado'
 */
router.patch(
  "/admin/productos/:id/estado",
  proteger(PERMISOS.CATALOGO_EDITAR),
  [
    validarId(),
    body("activo").isBoolean({ strict: true }).withMessage("Tiene que ser true o false"),
    manejarErroresValidacion,
  ],
  controller.cambiarEstado
);

/**
 * @openapi
 * /admin/productos/{id}/variantes:
 *   post:
 *     tags: [Admin - Productos]
 *     summary: Agregar una variante
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/IdRuta'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/VarianteEntrada'
 *     responses:
 *       201:
 *         description: Producto con la variante agregada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ProductoAdmin'
 *       400:
 *         $ref: '#/components/responses/DatosInvalidos'
 *       401:
 *         $ref: '#/components/responses/NoAutorizado'
 *       403:
 *         $ref: '#/components/responses/SinPermiso'
 *       404:
 *         $ref: '#/components/responses/NoEncontrado'
 *       409:
 *         description: El SKU ya lo usa otra variante
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: CONFLICTO_DE_DATOS
 */
router.post(
  "/admin/productos/:id/variantes",
  proteger(PERMISOS.CATALOGO_EDITAR),
  [validarId(), ...camposVariante(""), manejarErroresValidacion],
  controller.agregarVariante
);

/**
 * @openapi
 * /admin/productos/{id}/variantes/{varianteId}:
 *   patch:
 *     tags: [Admin - Productos]
 *     summary: Editar una variante
 *     description: >
 *       Si se cambia `precioAnterior` sin cambiar `precio`, se valida contra el
 *       precio que ya tiene la variante. Enviar `precioAnterior` en null quita la
 *       oferta.
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/IdRuta'
 *       - $ref: '#/components/parameters/VarianteIdRuta'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/VarianteCambios'
 *     responses:
 *       200:
 *         description: Producto con la variante actualizada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ProductoAdmin'
 *       400:
 *         $ref: '#/components/responses/DatosInvalidos'
 *       401:
 *         $ref: '#/components/responses/NoAutorizado'
 *       403:
 *         $ref: '#/components/responses/SinPermiso'
 *       404:
 *         description: No existe el producto, o la variante no es de ese producto
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: NO_ENCONTRADO
 *       409:
 *         $ref: '#/components/responses/Conflicto'
 */
router.patch(
  "/admin/productos/:id/variantes/:varianteId",
  proteger(PERMISOS.CATALOGO_EDITAR),
  [
    validarId(),
    validarVarianteId(),
    body("nombre").optional().isString().trim().isLength({ min: 1, max: 80 }),
    body("sku").optional({ values: "null" }).isString().trim().isLength({ max: 60 }),
    body("stock").optional().isInt({ min: 0 }),
    body("pesoGramos").optional({ values: "null" }).isInt({ min: 0 }),
    manejarErroresValidacion,
  ],
  controller.actualizarVariante
);

/**
 * @openapi
 * /admin/productos/{id}/variantes/{varianteId}/estado:
 *   patch:
 *     tags: [Admin - Productos]
 *     summary: Activar o desactivar una variante
 *     description: >
 *       Las variantes no se borran nunca: los pedidos historicos las
 *       referencian. Desactivada desaparece de la tienda sin perder el vinculo.
 *
 *
 *       No se puede desactivar la ultima variante activa: quedaria un producto
 *       visible que no se puede comprar. En ese caso responde
 *       ULTIMA_VARIANTE_ACTIVA.
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/IdRuta'
 *       - $ref: '#/components/parameters/VarianteIdRuta'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [activa]
 *             properties:
 *               activa: { type: boolean }
 *     responses:
 *       200:
 *         description: Producto con la variante actualizada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ProductoAdmin'
 *       400:
 *         description: Datos invalidos, o ULTIMA_VARIANTE_ACTIVA
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: ULTIMA_VARIANTE_ACTIVA
 *       401:
 *         $ref: '#/components/responses/NoAutorizado'
 *       403:
 *         $ref: '#/components/responses/SinPermiso'
 *       404:
 *         $ref: '#/components/responses/NoEncontrado'
 */
router.patch(
  "/admin/productos/:id/variantes/:varianteId/estado",
  proteger(PERMISOS.CATALOGO_EDITAR),
  [
    validarId(),
    validarVarianteId(),
    body("activa").isBoolean({ strict: true }).withMessage("Tiene que ser true o false"),
    manejarErroresValidacion,
  ],
  controller.cambiarEstadoVariante
);

/**
 * @openapi
 * /admin/productos/{id}:
 *   delete:
 *     tags: [Admin - Productos]
 *     summary: Borrar un producto
 *     description: >
 *       Borra el producto con sus variantes e imagenes, incluidos los archivos
 *       en el proveedor.
 *
 *
 *       Solo funciona con productos que NUNCA se vendieron. Si alguna variante
 *       figura en un pedido, responde 409 con PRODUCTO_CON_VENTAS: borrarlo
 *       dejaria ese pedido apuntando a un producto que ya no existe. Para ese
 *       caso esta despublicar, que lo saca de la tienda y conserva el historial.
 *
 *
 *       Requiere el permiso CATALOGO_BORRAR, que solo tiene el rol admin: el
 *       operador puede despublicar, que cubre casi todos los casos.
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/IdRuta'
 *     responses:
 *       204:
 *         description: Producto borrado
 *       401:
 *         $ref: '#/components/responses/NoAutorizado'
 *       403:
 *         $ref: '#/components/responses/SinPermiso'
 *       404:
 *         $ref: '#/components/responses/NoEncontrado'
 *       409:
 *         description: El producto tiene ventas registradas
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: PRODUCTO_CON_VENTAS
 */
router.delete(
  "/admin/productos/:id",
  proteger(PERMISOS.CATALOGO_BORRAR),
  [validarId(), manejarErroresValidacion],
  controller.borrar
);

module.exports = router;
