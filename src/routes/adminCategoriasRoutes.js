const express = require("express");
const { body, param } = require("express-validator");

const db = require("../models");
const SequelizeCategoriaRepository = require("../repositories/sequelize/SequelizeCategoriaRepository");
const CategoriaAdminService = require("../services/CategoriaAdminService");
const CategoriaAdminController = require("../controllers/CategoriaAdminController");
const { authMiddleware } = require("../middlewares/authMiddleware");
const { soloPermisos } = require("../middlewares/roleMiddleware");
const { manejarErroresValidacion } = require("../middlewares/validacion");
const { PERMISOS } = require("../config/permisos");

const router = express.Router();

const controller = new CategoriaAdminController(
  new CategoriaAdminService(new SequelizeCategoriaRepository(db))
);

/**
 * @description Cadena de protección: sesión válida más el permiso indicado.
 * @param {string} permiso - Permiso requerido.
 * @returns {Array<Function>} Middlewares de autenticación y autorización.
 */
const proteger = (permiso) => [authMiddleware, soloPermisos(permiso)];

/**
 * @description Regla del id en la ruta. Función por el mismo motivo que reglasCampos.
 * @returns {Object} Cadena de validación nueva.
 */
const validarId = () => param("id").isInt({ min: 1 }).withMessage("Id inválido").toInt();

/**
 * @description Reglas de los campos de una categoría. Son funciones y no cadenas
 * sueltas porque las cadenas de express-validator se modifican al encadenar:
 * si crear y editar compartieran la misma, marcar el nombre como opcional para
 * editar lo volvería opcional también al crear.
 */
const reglasCampos = {
  /**
   * @description Construye la regla de validación para el campo nombre.
   * @returns {Object} Cadena de validación de express-validator.
   */
  nombre: () =>
    body("nombre")
      .isString()
      .trim()
      .isLength({ min: 1, max: 80 })
      .withMessage("El nombre es obligatorio y admite hasta 80 caracteres"),
  /**
   * @description Construye la regla de validación para el campo slug.
   * @returns {Object} Cadena de validación de express-validator.
   */
  slug: () =>
    body("slug")
      .optional({ values: "null" })
      .isString()
      .trim()
      .isLength({ max: 80 })
      .withMessage("El slug admite hasta 80 caracteres"),
  /**
   * @description Construye la regla de validación para el campo descripcion.
   * @returns {Object} Cadena de validación de express-validator.
   */
  descripcion: () =>
    body("descripcion")
      .optional({ values: "null" })
      .isString()
      .isLength({ max: 300 })
      .withMessage("La descripción admite hasta 300 caracteres"),
  /**
   * @description Construye la regla de validación para el campo imagenUrl.
   * @returns {Object} Cadena de validación de express-validator.
   */
  imagenUrl: () =>
    body("imagenUrl")
      .optional({ values: "null" })
      .isURL({ protocols: ["https"], require_protocol: true })
      .withMessage("La imagen tiene que ser una URL https")
      .isLength({ max: 500 }),
};

const validarCrear = [
  reglasCampos.nombre(),
  reglasCampos.slug(),
  reglasCampos.descripcion(),
  reglasCampos.imagenUrl(),
  manejarErroresValidacion,
];

const validarActualizar = [
  param("id").isInt({ min: 1 }).withMessage("Id inválido").toInt(),
  reglasCampos.nombre().optional(),
  reglasCampos.slug(),
  reglasCampos.descripcion(),
  reglasCampos.imagenUrl(),
  manejarErroresValidacion,
];

const validarEstado = [
  validarId(),
  body("activa").isBoolean({ strict: true }).withMessage("Tiene que ser true o false"),
  manejarErroresValidacion,
];

const validarOrden = [
  body("ids").isArray({ min: 1 }).withMessage("Tiene que ser una lista de ids"),
  body("ids.*").isInt({ min: 1 }).withMessage("Cada id tiene que ser un número").toInt(),
  manejarErroresValidacion,
];

/**
 * @openapi
 * /admin/categorias:
 *   get:
 *     tags: [Admin - Categorias]
 *     summary: Listar todas las categorias
 *     description: >
 *       Incluye las inactivas. Cada una trae cuantos productos activos tiene,
 *       para poder avisar antes de desactivarla: desactivar una categoria oculta
 *       todos sus productos de la tienda.
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Categorias ordenadas por su campo orden
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [datos]
 *               properties:
 *                 datos:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/CategoriaAdmin'
 *       401:
 *         $ref: '#/components/responses/NoAutorizado'
 *       403:
 *         $ref: '#/components/responses/SinPermiso'
 *   post:
 *     tags: [Admin - Categorias]
 *     summary: Crear una categoria
 *     description: >
 *       Si no se indica slug, se genera del nombre y se le agrega un sufijo si ya
 *       existe. Si se indica a mano y esta tomado, se rechaza con
 *       CONFLICTO_DE_DATOS. La categoria nueva queda activa y al final del menu.
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CategoriaEntrada'
 *     responses:
 *       201:
 *         description: Categoria creada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CategoriaAdmin'
 *       400:
 *         $ref: '#/components/responses/DatosInvalidos'
 *       401:
 *         $ref: '#/components/responses/NoAutorizado'
 *       403:
 *         $ref: '#/components/responses/SinPermiso'
 *       409:
 *         $ref: '#/components/responses/Conflicto'
 */
router.get("/admin/categorias", proteger(PERMISOS.CATALOGO_VER), controller.listar);
router.post(
  "/admin/categorias",
  proteger(PERMISOS.CATALOGO_EDITAR),
  validarCrear,
  controller.crear
);

/**
 * @openapi
 * /admin/categorias/orden:
 *   put:
 *     tags: [Admin - Categorias]
 *     summary: Reordenar el menu
 *     description: >
 *       Recibe los ids de TODAS las categorias en el orden deseado. Se rechaza una
 *       lista con faltantes, repetidos o ids desconocidos: un orden parcial
 *       dejaria dos categorias en la misma posicion.
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [ids]
 *             properties:
 *               ids:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 example: [6, 4, 5]
 *     responses:
 *       200:
 *         description: Categorias en el orden nuevo
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 datos:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/CategoriaAdmin'
 *       400:
 *         $ref: '#/components/responses/DatosInvalidos'
 *       401:
 *         $ref: '#/components/responses/NoAutorizado'
 *       403:
 *         $ref: '#/components/responses/SinPermiso'
 */
router.put(
  "/admin/categorias/orden",
  proteger(PERMISOS.CATALOGO_EDITAR),
  validarOrden,
  controller.reordenar
);

/**
 * @openapi
 * /admin/categorias/{id}:
 *   get:
 *     tags: [Admin - Categorias]
 *     summary: Obtener una categoria
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/IdRuta'
 *     responses:
 *       200:
 *         description: Categoria
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CategoriaAdmin'
 *       401:
 *         $ref: '#/components/responses/NoAutorizado'
 *       403:
 *         $ref: '#/components/responses/SinPermiso'
 *       404:
 *         $ref: '#/components/responses/NoEncontrado'
 *   patch:
 *     tags: [Admin - Categorias]
 *     summary: Editar una categoria
 *     description: >
 *       Solo se modifican los campos que vienen. Cambiar el nombre NO cambia el
 *       slug: para cambiar la URL hay que editar el slug a proposito. Si la
 *       categoria esta activa, el panel tiene que avisar que los links anteriores
 *       dejan de funcionar.
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/IdRuta'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CategoriaCambios'
 *     responses:
 *       200:
 *         description: Categoria actualizada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CategoriaAdmin'
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
  "/admin/categorias/:id",
  proteger(PERMISOS.CATALOGO_VER),
  [validarId(), manejarErroresValidacion],
  controller.obtener
);
router.patch(
  "/admin/categorias/:id",
  proteger(PERMISOS.CATALOGO_EDITAR),
  validarActualizar,
  controller.actualizar
);

/**
 * @openapi
 * /admin/categorias/{id}/estado:
 *   patch:
 *     tags: [Admin - Categorias]
 *     summary: Activar o desactivar una categoria
 *     description: >
 *       Desactivar una categoria oculta de la tienda TODOS sus productos, aunque
 *       cada uno siga activo. La respuesta incluye cantidadProductos, y el panel
 *       tiene que informarlo antes de confirmar.
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
 *             required: [activa]
 *             properties:
 *               activa:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Categoria con su estado nuevo
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CategoriaAdmin'
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
  "/admin/categorias/:id/estado",
  proteger(PERMISOS.CATALOGO_EDITAR),
  validarEstado,
  controller.cambiarEstado
);

module.exports = router;
