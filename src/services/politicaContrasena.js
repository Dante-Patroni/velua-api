const fs = require("fs");
const path = require("path");

/** @description Largo mínimo en caracteres (NIST SP 800-63B). */
const LARGO_MINIMO = 12;

/** @description bcrypt ignora lo que pasa de 72 bytes: se rechaza en vez de recortar en silencio. */
const MAXIMO_BYTES = 72;

/** @description Palabras del contexto que no pueden aparecer en la contraseña. */
const PALABRAS_DEL_SITIO = ["velua"];

/**
 * @description Contraseñas comunes de 12 caracteres o más, en minúscula.
 * Origen: SecLists, Passwords/Common-Credentials/xato-net-10-million-passwords-100000.txt
 * (licencia MIT), SHA-256 del original
 * 1472AAFA2561DF5E3293AEE252AEE3CA660C12B399A283CF808BB01B39BE388B.
 * Filtrada a 12 o más caracteres, porque las más cortas ya las rechaza el largo mínimo.
 * Se carga una sola vez al arrancar. Si el archivo falta, la API no arranca.
 */
const COMUNES = new Set(
  fs
    .readFileSync(path.join(__dirname, "..", "config", "contrasenas-comunes.txt"), "utf8")
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((linea) => linea.trim().toLowerCase())
    .filter(Boolean)
);

/** @description Texto para mostrar debajo del campo, por motivo de rechazo. */
const MENSAJES_RECHAZO = {
  MUY_CORTA: `Tiene que tener al menos ${LARGO_MINIMO} caracteres.`,
  MUY_LARGA: "Es demasiado larga. Probá con una más corta.",
  IGUAL_A_LA_ACTUAL: "Tiene que ser distinta de la actual.",
  MUY_COMUN: "Es una contraseña muy común. Elegí otra.",
  CONTIENE_EL_MAIL: "No puede contener tu mail.",
  CONTIENE_EL_NOMBRE_DEL_SITIO: "No puede contener el nombre de la marca.",
};

/**
 * @description Contraseñas comunes de 12 caracteres o más, en minúscula (46.146).
 * Origen: SecLists, Passwords/Common-Credentials/xato-net-10-million-passwords-1000000.txt
 * (licencia MIT), SHA-256 del original
 * 424A3E03A17DF0A2BC2B3CA749D81B04E79D59CB7AEEC8876A5A3F308D0CAF51.
 * Filtrada a 12 o más caracteres, porque las más cortas ya las rechaza el largo mínimo.
 * Se carga una sola vez al arrancar. Si el archivo falta, la API no arranca.
 * @param {string} nueva - Contraseña nueva, tal como la escribió la persona.
 * @param {Object} contexto - Datos para comparar.
 * @param {string} contexto.actual - Contraseña actual (ya verificada).
 * @param {string} contexto.email - Mail de la usuaria.
 * @returns {string|null} El motivo del rechazo, o null si se acepta.
 */
const motivoDeRechazo = (nueva, { actual, email }) => {
  if (typeof nueva !== "string" || [...nueva].length < LARGO_MINIMO) {
    return "MUY_CORTA";
  }
  if (Buffer.byteLength(nueva, "utf8") > MAXIMO_BYTES) {
    return "MUY_LARGA";
  }
  if (nueva === actual) {
    return "IGUAL_A_LA_ACTUAL";
  }

  const enMinuscula = nueva.toLowerCase();
  if (COMUNES.has(enMinuscula)) {
    return "MUY_COMUN";
  }

  const usuarioDelMail = String(email ?? "")
    .split("@")[0]
    .toLowerCase();
  if (usuarioDelMail.length >= 3 && enMinuscula.includes(usuarioDelMail)) {
    return "CONTIENE_EL_MAIL";
  }
  if (PALABRAS_DEL_SITIO.some((palabra) => enMinuscula.includes(palabra))) {
    return "CONTIENE_EL_NOMBRE_DEL_SITIO";
  }

  return null;
};

module.exports = { motivoDeRechazo, MENSAJES_RECHAZO, LARGO_MINIMO, MAXIMO_BYTES };
