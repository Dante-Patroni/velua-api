const express = require("express");
const { body, param } = require("express-validator");

const db = require("../models");
const SequelizeImagenRepository = require("../repositories/sequelize/SequelizeImagenRepository");
const CloudinaryStorage = require("../almacenamiento/CloudinaryStorage");
const { ImagenAdminService } = require("../services/ImagenAdminService");
const ImagenAdminController = require("../controllers/ImagenAdminController");
const { authMiddleware } = require("../middlewares/authMiddleware");
const { soloPermisos } = require("../middlewares/roleMiddleware");
const { recibirImagen } = require("../middlewares/subidaImagen");
const { manejarErroresValidacion } = require("../middlewares/validacion");
const { PERMISOS } = require("../config/permisos");

const router = express.Router();

const controller = new ImagenAdminController(
  new ImagenAdminService(new SequelizeImagenRepository(db), new CloudinaryStorage())
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
 * @description Regla del id de la imagen en la ruta.
 * @returns {Object} Cadena de validación nueva.
 */
const validarImagenId = () =>
  param("imagenId").isInt({ min: 1 }).withMessage("Id de imagen inválido").toInt();

/**
 * @openapi
 * /admin/productos/{id}/imagenes:
 *   get:
 *     tags: [Admin - Imagenes]
 *     summary: Listar las imagenes de un producto
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/IdRuta'
 *     responses:
 *       200:
 *         description: Imagenes ordenadas. La primera es la principal.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [datos]
 *               properties:
 *                 datos:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ImagenAdmin'
 *       401:
 *         $ref: '#/components/responses/NoAutorizado'
 *       403:
 *         $ref: '#/components/responses/SinPermiso'
 *       404:
 *         $ref: '#/components/responses/NoEncontrado'
 *   post:
 *     tags: [Admin - Imagenes]
 *     summary: Subir una imagen
 *     description: >
 *       Se envia como multipart/form-data, con el archivo en el campo `imagen` y
 *       opcionalmente un texto alternativo en `alt`.
 *
 *
 *       Formatos aceptados: jpg, png y webp. Tope de 5 MB. El contenido se
 *       verifica mirando los primeros bytes del archivo, no el tipo que declara
 *       el navegador, que se puede falsear.
 *
 *
 *       La imagen se guarda en el proveedor achicada a 1600 px de lado mayor. Los
 *       tamanos para cada pantalla salen transformando la URL, sin subir nada
 *       adicional. Maximo 8 imagenes por producto.
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/IdRuta'
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [imagen]
 *             properties:
 *               imagen:
 *                 type: string
 *                 format: binary
 *               alt:
 *                 type: string
 *                 maxLength: 200
 *                 description: Texto alternativo para accesibilidad.
 *     responses:
 *       201:
 *         description: Galeria actualizada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 datos:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ImagenAdmin'
 *       400:
 *         description: >
 *           ARCHIVO_REQUERIDO, TIPO_ARCHIVO_INVALIDO, ARCHIVO_DEMASIADO_GRANDE
 *           o LIMITE_IMAGENES.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: ARCHIVO_DEMASIADO_GRANDE
 *       401:
 *         $ref: '#/components/responses/NoAutorizado'
 *       403:
 *         $ref: '#/components/responses/SinPermiso'
 *       404:
 *         $ref: '#/components/responses/NoEncontrado'
 *       502:
 *         description: El proveedor de imagenes rechazo la subida.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: ERROR_AL_SUBIR
 */
router.get(
  "/admin/productos/:id/imagenes",
  proteger(PERMISOS.CATALOGO_VER),
  [validarId(), manejarErroresValidacion],
  controller.listar
);
router.post(
  "/admin/productos/:id/imagenes",
  proteger(PERMISOS.CATALOGO_EDITAR),
  [validarId(), manejarErroresValidacion],
  recibirImagen,
  controller.subir
);

/**
 * @openapi
 * /admin/productos/{id}/imagenes/orden:
 *   put:
 *     tags: [Admin - Imagenes]
 *     summary: Reordenar la galeria
 *     description: >
 *       La primera imagen es la principal: es la que se ve en la grilla de la
 *       tienda. Recibe los ids de TODAS las imagenes del producto en el orden
 *       deseado; un orden parcial dejaria dos en la misma posicion y la
 *       principal seria impredecible.
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
 *             required: [ids]
 *             properties:
 *               ids:
 *                 type: array
 *                 items: { type: integer }
 *                 example: [5, 3, 4]
 *     responses:
 *       200:
 *         description: Galeria en el orden nuevo
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 datos:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ImagenAdmin'
 *       400:
 *         $ref: '#/components/responses/DatosInvalidos'
 *       401:
 *         $ref: '#/components/responses/NoAutorizado'
 *       403:
 *         $ref: '#/components/responses/SinPermiso'
 *       404:
 *         $ref: '#/components/responses/NoEncontrado'
 */
router.put(
  "/admin/productos/:id/imagenes/orden",
  proteger(PERMISOS.CATALOGO_EDITAR),
  [
    validarId(),
    body("ids").isArray({ min: 1 }).withMessage("Tiene que ser una lista de ids"),
    body("ids.*").isInt({ min: 1 }).withMessage("Cada id tiene que ser un número").toInt(),
    manejarErroresValidacion,
  ],
  controller.reordenar
);

/**
 * @openapi
 * /admin/productos/{id}/imagenes/{imagenId}:
 *   patch:
 *     tags: [Admin - Imagenes]
 *     summary: Cambiar el texto alternativo
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/IdRuta'
 *       - $ref: '#/components/parameters/ImagenIdRuta'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               alt:
 *                 type: string
 *                 maxLength: 200
 *                 nullable: true
 *     responses:
 *       200:
 *         description: Galeria actualizada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 datos:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ImagenAdmin'
 *       400:
 *         $ref: '#/components/responses/DatosInvalidos'
 *       401:
 *         $ref: '#/components/responses/NoAutorizado'
 *       403:
 *         $ref: '#/components/responses/SinPermiso'
 *       404:
 *         $ref: '#/components/responses/NoEncontrado'
 *   delete:
 *     tags: [Admin - Imagenes]
 *     summary: Borrar una imagen
 *     description: >
 *       Borra el archivo del proveedor y despues la fila. Si el borrado remoto
 *       falla, la fila se borra igual: un archivo huerfano molesta menos que una
 *       fila apuntando a una imagen que ya no existe, que dejaria la tienda con
 *       una foto rota.
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/IdRuta'
 *       - $ref: '#/components/parameters/ImagenIdRuta'
 *     responses:
 *       200:
 *         description: Galeria sin la imagen borrada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 datos:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ImagenAdmin'
 *       401:
 *         $ref: '#/components/responses/NoAutorizado'
 *       403:
 *         $ref: '#/components/responses/SinPermiso'
 *       404:
 *         description: No existe el producto, o la imagen no es de ese producto
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: NO_ENCONTRADO
 */
router.patch(
  "/admin/productos/:id/imagenes/:imagenId",
  proteger(PERMISOS.CATALOGO_EDITAR),
  [
    validarId(),
    validarImagenId(),
    body("alt").optional({ values: "null" }).isString().isLength({ max: 200 }),
    manejarErroresValidacion,
  ],
  controller.actualizarAlt
);
router.delete(
  "/admin/productos/:id/imagenes/:imagenId",
  proteger(PERMISOS.CATALOGO_EDITAR),
  [validarId(), validarImagenId(), manejarErroresValidacion],
  controller.borrar
);

module.exports = router;
