/**
 * Campos que no se normalizan. Una contraseña creada con caracteres en otra
 * forma dejaría de coincidir con su hash si la normalizáramos solo al entrar.
 */
const CAMPOS_EXCLUIDOS = new Set(["password", "contrasena", "clave"]);

/**
 * @description Lleva a NFC todos los textos de un valor, recorriendo objetos y
 * arrays. "ê" puede llegar como un carácter o como "e" + acento combinable;
 * en NFC queda siempre como uno, y así las comparaciones, búsquedas, slugs y
 * validaciones de largo se comportan igual sin importar de dónde vino el texto.
 * @param {*} valor - Lo que haya que normalizar.
 * @returns {*} El mismo valor con los textos en NFC.
 */
const normalizarValor = (valor) => {
  if (typeof valor === "string") return valor.normalize("NFC");
  if (Array.isArray(valor)) return valor.map(normalizarValor);
  if (valor && typeof valor === "object") {
    return Object.fromEntries(
      Object.entries(valor).map(([clave, v]) => [
        clave,
        CAMPOS_EXCLUIDOS.has(clave) ? v : normalizarValor(v),
      ])
    );
  }
  return valor;
};

/**
 * @description Middleware: normaliza el body a NFC antes de validar. Tiene que
 * ir antes de las rutas, para que express-validator vea el texto ya canónico.
 * @param {import("express").Request} req - Petición.
 * @param {import("express").Response} _res - Respuesta (no se usa).
 * @param {import("express").NextFunction} next - Siguiente middleware.
 * @returns {void}
 */
const normalizarUnicode = (req, _res, next) => {
  if (req.body && typeof req.body === "object") {
    req.body = normalizarValor(req.body);
  }
  next();
};

module.exports = { normalizarUnicode, normalizarValor };
