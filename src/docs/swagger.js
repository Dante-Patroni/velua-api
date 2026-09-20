const swaggerJsdoc = require("swagger-jsdoc");
const definicionBase = require("./definicionBase");

/**
 * @description Contrato OpenAPI completo.
 *
 * Combina la definicion base (info, servers, componentes) con los `paths` que
 * salen de los comentarios `@openapi` de los archivos de rutas. Asi la
 * documentacion vive pegada al codigo que documenta y no puede quedar vieja
 * sin que alguien lo note.
 *
 * El archivo `docs/openapi.json`, que consume el frontend para generar sus
 * tipos, se produce desde aca con `npm run openapi`. No se edita a mano.
 */
const swaggerSpec = swaggerJsdoc({
  definition: definicionBase,
  apis: ["./src/routes/*.js", "./src/app.js"],
});

module.exports = swaggerSpec;
