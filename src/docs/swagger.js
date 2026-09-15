const swaggerJsdoc = require("swagger-jsdoc");

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "API Velua",
      version: "1.0.0",
      description:
        "API de la tienda online de Velua, cosmetica natural artesanal. " +
        "Los endpoints del catalogo y del checkout son publicos. " +
        "Los de /admin requieren sesion.",
      contact: {
        name: "Dante Patroni",
        url: "https://github.com/Dante-Patroni/velua-api",
      },
    },
    servers: [
      {
        url: "http://localhost:3000/api/v1",
        description: "Desarrollo",
      },
      {
        url: "https://api.velua.com.ar/api/v1",
        description: "Produccion",
      },
    ],
    components: {
      securitySchemes: {
        cookieAuth: {
          type: "apiKey",
          in: "cookie",
          name: "velua_sesion",
        },
      },
      schemas: {
        Error: {
          type: "object",
          properties: {
            error: { type: "string", example: "STOCK_INSUFICIENTE" },
            details: {
              type: "object",
              additionalProperties: { type: "string" },
              example: { email: "El email no es valido" },
            },
          },
          required: ["error"],
        },
        Paginacion: {
          type: "object",
          properties: {
            datos: { type: "array", items: {} },
            meta: {
              type: "object",
              properties: {
                pagina: { type: "integer", example: 1 },
                limite: { type: "integer", example: 20 },
                total: { type: "integer", example: 47 },
              },
            },
          },
        },
      },
    },
  },
  apis: ["./src/routes/*.js", "./src/docs/*.yaml"],
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;