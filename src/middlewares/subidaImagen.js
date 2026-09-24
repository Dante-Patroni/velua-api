const multer = require("multer");
const { manejarErrorHttp } = require("./errorMapper");

const TOPE_BYTES = 5 * 1024 * 1024;

const TIPOS_PERMITIDOS = ["image/jpeg", "image/png", "image/webp"];

/**
 * @description Firmas de los formatos aceptados, en los primeros bytes del archivo.
 * El tipo que declara el navegador se puede falsear; estos bytes no.
 */
const FIRMAS = [
  { nombre: "jpeg", bytes: [0xff, 0xd8, 0xff] },
  { nombre: "png", bytes: [0x89, 0x50, 0x4e, 0x47] },
  { nombre: "webp", bytes: [0x52, 0x49, 0x46, 0x46] },
];

/**
 * @description Verifica que el contenido del archivo empiece con la firma de una
 * imagen conocida.
 * @param {Buffer} buffer - Contenido del archivo.
 * @returns {boolean} true si el contenido es una imagen de un formato aceptado.
 */
const esImagenDeVerdad = (buffer) => {
  if (!buffer || buffer.length < 12) {
    return false;
  }
  return FIRMAS.some(({ nombre, bytes }) => {
    const coincide = bytes.every((b, i) => buffer[i] === b);
    // WEBP comparte los primeros bytes con otros contenedores RIFF
    if (coincide && nombre === "webp") {
      return buffer.slice(8, 12).toString("ascii") === "WEBP";
    }
    return coincide;
  });
};

/**
 * @description Cargador de multer. Guarda en memoria, con tope de tamaño y
 * filtro por tipo declarado. El contenido real se verifica después, en
 * recibirImagen, mirando los primeros bytes del archivo.
 */
/* eslint-disable jsdoc/require-jsdoc */
const cargador = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: TOPE_BYTES, files: 1 },
  fileFilter: (req, archivo, callback) => {
    if (!TIPOS_PERMITIDOS.includes(archivo.mimetype)) {
      return callback(new Error("TIPO_ARCHIVO_INVALIDO"));
    }
    return callback(null, true);
  },
});
/* eslint-enable jsdoc/require-jsdoc */

/**
 * @description Recibe una imagen en el campo "imagen" del formulario y la deja
 * en req.file, en memoria.
 *
 * El archivo va a la RAM del contenedor camino a Cloudinary, nunca al disco:
 * el filesystem de Railway es efímero y se pierde en cada despliegue. Por eso el
 * tope de tamaño no es opcional.
 *
 * @param {import("express").Request} req - Request de Express.
 * @param {import("express").Response} res - Response de Express.
 * @param {import("express").NextFunction} next - Siguiente middleware.
 * @returns {void}
 * @throws {Error} ARCHIVO_REQUERIDO, TIPO_ARCHIVO_INVALIDO, ARCHIVO_DEMASIADO_GRANDE
 */
const recibirImagen = (req, res, next) => {
  cargador.single("imagen")(req, res, (error) => {
    if (error) {
      if (error.code === "LIMIT_FILE_SIZE") {
        return manejarErrorHttp(new Error("ARCHIVO_DEMASIADO_GRANDE"), res);
      }
      if (error.code === "LIMIT_FILE_COUNT" || error.code === "LIMIT_UNEXPECTED_FILE") {
        return manejarErrorHttp(new Error("TIPO_ARCHIVO_INVALIDO"), res);
      }
      return manejarErrorHttp(new Error(error.message || "TIPO_ARCHIVO_INVALIDO"), res);
    }

    if (!req.file) {
      return manejarErrorHttp(new Error("ARCHIVO_REQUERIDO"), res);
    }

    if (!esImagenDeVerdad(req.file.buffer)) {
      return manejarErrorHttp(new Error("TIPO_ARCHIVO_INVALIDO"), res);
    }

    return next();
  });
};

module.exports = { recibirImagen, esImagenDeVerdad, TOPE_BYTES, TIPOS_PERMITIDOS };
