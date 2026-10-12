const crypto = require("crypto");

/**
 * @description Separa el encabezado x-signature ("ts=...,v1=...") en sus partes.
 * @param {string|undefined} encabezado - Valor del encabezado.
 * @returns {{ts: string|null, v1: string|null}} Hora y firma, o null si faltan.
 */
const leerFirma = (encabezado) => {
  const partes = Object.fromEntries(
    String(encabezado ?? "")
      .split(",")
      .map((p) => p.trim().split("="))
      .filter(([clave, valor]) => clave && valor)
  );
  return { ts: partes.ts ?? null, v1: partes.v1 ?? null };
};

/**
 * @description Arma el texto que Mercado Pago firma. Si falta un dato, su parte se
 * omite, como indica la documentación de Mercado Pago.
 * @param {Object} datos - Datos del aviso.
 * @param {string} [datos.dataId] - El data.id de la URL.
 * @param {string} [datos.requestId] - El encabezado x-request-id.
 * @param {string} datos.ts - La hora que viene en x-signature.
 * @returns {string} Texto a firmar.
 */
const armarManifiesto = ({ dataId, requestId, ts }) =>
  (dataId ? `id:${String(dataId).toLowerCase()};` : "") +
  (requestId ? `request-id:${requestId};` : "") +
  `ts:${ts};`;

/**
 * @description Verifica que un aviso venga de Mercado Pago.
 *
 * La comparación usa timingSafeEqual: tarda lo mismo acierte o no, así nadie puede
 * adivinar la firma midiendo cuánto tarda la respuesta.
 *
 * @param {Object} aviso - Datos del aviso.
 * @param {string} [aviso.encabezadoFirma] - El encabezado x-signature.
 * @param {string} [aviso.requestId] - El encabezado x-request-id.
 * @param {string} [aviso.dataId] - El data.id de la URL.
 * @param {string} [aviso.secreto] - La clave secreta del webhook.
 * @returns {boolean} true si la firma es válida.
 */
const firmaValida = ({ encabezadoFirma, requestId, dataId, secreto }) => {
  if (!secreto) {
    return false;
  }
  const { ts, v1 } = leerFirma(encabezadoFirma);
  if (!ts || !v1) {
    return false;
  }

  const esperada = Buffer.from(
    crypto
      .createHmac("sha256", secreto)
      .update(armarManifiesto({ dataId, requestId, ts }))
      .digest("hex"),
    "hex"
  );
  const recibida = Buffer.from(v1, "hex");

  return esperada.length === recibida.length && crypto.timingSafeEqual(esperada, recibida);
};

module.exports = { firmaValida, armarManifiesto, leerFirma };
