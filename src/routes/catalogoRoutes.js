const express = require("express");
const { query, param } = require("express-validator");

const db = require("../models");
const SequelizeCatalogoRepository = require("../repositories/sequelize/SequelizeCatalogoRepository");
const CatalogoService = require("../services/CatalogoService");
const CatalogoController = require("../controllers/CatalogoController");
const { manejarErroresValidacion } = require("../middlewares/validacion");

const router = express.Router();

const catalogoRepositorio = new SequelizeCatalogoRepository(db);
const catalogoService = new CatalogoService(catalogoRepositorio);
const catalogoController = new CatalogoController(catalogoService);

/**
 * @description Reglas de validación del listado de productos.
 * Los valores y topes salen del contrato en docs/openapi.json.
 */
const validarListado = [
  query("pagina")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Debe ser un número entero mayor o igual a 1")
    .toInt(),
  query("limite")
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage("Debe ser un número entre 1 y 50")
    .toInt(),
  query("categoria")
    .optional()
    .isString()
    .isLength({ max: 80 })
    .withMessage("El slug de categoría no puede superar los 80 caracteres"),
  query("destacados").optional().isBoolean().withMessage("Debe ser true o false").toBoolean(),
  query("q")
    .optional()
    .isString()
    .isLength({ max: 80 })
    .withMessage("La búsqueda no puede superar los 80 caracteres")
    .trim(),
  query("orden")
    .optional()
    .isIn(["defecto", "precio_asc", "precio_desc", "mas_vendidos"])
    .withMessage("Valor de orden no reconocido"),
  manejarErroresValidacion,
];

/**
 * @description Reglas de validación del detalle por slug.
 */
const validarSlug = [
  param("slug").isString().isLength({ min: 1, max: 160 }).withMessage("Slug inválido").trim(),
  manejarErroresValidacion,
];

/**
 * @openapi
 * /categorias:
 *   get:
 *     tags: [Catalogo]
 *     summary: Listar categorias activas
 *     description: >
 *       Devuelve las categorias activas ordenadas por su campo de orden.
 *       Sin paginacion: son pocas y se usan para armar el menu.
 *     responses:
 *       200:
 *         description: Listado de categorias
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [datos]
 *               properties:
 *                 datos:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Categoria'
 */
router.get("/categorias", catalogoController.listarCategorias);

/**
 * @openapi
 * /productos:
 *   get:
 *     tags: [Catalogo]
 *     summary: Listar productos
 *     description: >
 *       Listado paginado y liviano, pensado para la grilla del catalogo.
 *       Incluye el precio minimo entre las variantes activas, si hay stock,
 *       y solo la imagen principal.
 *
 *
 *       Para los datos completos de un producto, usar el detalle por slug.
 *     parameters:
 *       - $ref: '#/components/parameters/Pagina'
 *       - $ref: '#/components/parameters/Limite'
 *       - in: query
 *         name: categoria
 *         required: false
 *         description: 'Slug de la categoria. Ej: jabones.'
 *         schema:
 *           type: string
 *           maxLength: 80
 *       - in: query
 *         name: destacados
 *         required: false
 *         description: Si es true, devuelve solo los productos marcados como destacados.
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: q
 *         required: false
 *         description: Texto de busqueda. Busca en nombre y descripcion corta.
 *         schema:
 *           type: string
 *           maxLength: 80
 *       - in: query
 *         name: orden
 *         required: false
 *         description: >
 *           Criterio de ordenamiento.
 *           `defecto`: orden de categoria y despues alfabetico.
 *           `precio_asc` / `precio_desc`: por precio minimo de variante activa.
 *           `mas_vendidos`: declarado en el contrato pero no implementado todavia;
 *           hasta que existan ventas reales devuelve el orden por defecto.
 *         schema:
 *           type: string
 *           enum: [defecto, precio_asc, precio_desc, mas_vendidos]
 *           default: defecto
 *     responses:
 *       200:
 *         description: Listado paginado de productos
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [datos, meta]
 *               properties:
 *                 datos:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ProductoListado'
 *                 meta:
 *                   $ref: '#/components/schemas/Meta'
 *       400:
 *         description: Parametros invalidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: DATOS_INVALIDOS
 *               details:
 *                 limite: Debe ser un número entre 1 y 50
 */
router.get("/productos", validarListado, catalogoController.listarProductos);

/**
 * @openapi
 * /productos/{slug}:
 *   get:
 *     tags: [Catalogo]
 *     summary: Detalle de un producto
 *     description: >
 *       Ficha completa: todas las variantes activas, todas las imagenes,
 *       ingredientes y modo de uso.
 *
 *
 *       Se busca por slug y no por id porque el slug es lo que va en la URL
 *       publica y en los links que se comparten.
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         description: 'Slug del producto. Ej: jabon-calendula-karite.'
 *         schema:
 *           type: string
 *           maxLength: 160
 *     responses:
 *       200:
 *         description: Producto encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ProductoDetalle'
 *       404:
 *         description: No existe un producto activo con ese slug
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: NO_ENCONTRADO
 */
router.get("/productos/:slug", validarSlug, catalogoController.obtenerProducto);

module.exports = router;
