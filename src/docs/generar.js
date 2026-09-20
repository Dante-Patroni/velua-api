const fs = require("fs");
const path = require("path");

const swaggerSpec = require("./swagger");

const DESTINO = path.join(__dirname, "..", "..", "docs", "openapi.json");

/**
 * @description Escribe el contrato OpenAPI en docs/openapi.json.
 *
 * Ese archivo es el que consume el frontend con `openapi-typescript` para
 * generar sus tipos, asi que tiene que estar commiteado y al dia. Correr este
 * script cada vez que se agregue o cambie un endpoint, y commitear el
 * resultado en el mismo PR.
 *
 * @returns {void}
 * @throws {Error} Si el contrato no tiene paths, senal de que los comentarios
 * `@openapi` no se estan leyendo.
 */
function generar() {
  const cantidadRutas = Object.keys(swaggerSpec.paths || {}).length;

  if (cantidadRutas === 0) {
    throw new Error(
      "El contrato generado no tiene rutas. Revisar el array `apis` de src/docs/swagger.js."
    );
  }

  fs.writeFileSync(DESTINO, JSON.stringify(swaggerSpec, null, 2) + "\n", "utf8");

  // eslint-disable-next-line no-console
  console.log(`Contrato generado con ${cantidadRutas} rutas en docs/openapi.json`);
}

generar();
