require("dotenv").config();
const swaggerUi = require("swagger-ui-express");
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const { limitadorGlobal } = require("./middlewares/rateLimitMiddleware");

const app = express();

app.set("trust proxy", 1);

const ORIGENES = (process.env.CORS_ORIGENES || "http://localhost:5173")
  .split(",")
  .map((o) => o.trim());

/**
 * @description Decide si un origen tiene permitido consumir la API.
 * @param {string|undefined} origin - Origen de la peticion. Indefinido en llamadas sin navegador.
 * @param {Function} callback - Callback de cors, recibe (error, permitido).
 * @returns {void}
 */
const validarOrigen = (origin, callback) => {
  if (!origin || ORIGENES.includes(origin)) return callback(null, true);
  return callback(new Error("ORIGEN_NO_PERMITIDO"));
};

app.use(cors({ origin: validarOrigen, credentials: true }));

app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
const swaggerSpec = require("./docs/swagger");
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use("/api", limitadorGlobal);
app.use("/api/v1", require("./routes/catalogoRoutes"));
app.use("/api/v1", require("./routes/authRoutes"));
app.use("/api/v1", require("./routes/adminCategoriasRoutes"));
app.use("/api/v1", require("./routes/adminProductosRoutes"));
/**
 * @openapi
 * /salud:
 *   get:
 *     tags: [Sistema]
 *     summary: Estado del servicio
 *     description: >
 *       Informa version, entorno y estado de la conexion a la base.
 *       Responde 200 aunque la base este caida; el estado va en el cuerpo.
 *     responses:
 *       200:
 *         description: Estado del servicio
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Salud'
 */
/**
 * @description Informa el estado de la API y de la conexion a la base de datos.
 * @param {import("express").Request} req - Request de Express.
 * @param {import("express").Response} res - Response de Express.
 * @returns {Promise<import("express").Response>} Estado, version, entorno y base de datos.
 */
const salud = async (req, res) => {
  const { sequelize } = require("./models");
  let baseDatos;

  try {
    await sequelize.authenticate();
    baseDatos = "conectada";
  } catch {
    baseDatos = "desconectada";
  }

  return res.json({
    estado: "ok",
    version: require("../package.json").version,
    entorno: process.env.NODE_ENV || "development",
    baseDatos,
  });
};

app.get("/api/v1/salud", salud);

const { manejarErrorHttp } = require("./middlewares/errorMapper");

/**
 * @description Responde NO_ENCONTRADO en el contrato del proyecto para
 * cualquier ruta que no exista, en vez de la página HTML de Express.
 * @param {import("express").Request} req - Request de Express.
 * @param {import("express").Response} res - Response de Express.
 * @returns {import("express").Response} Respuesta 404.
 */
const rutaInexistente = (req, res) => res.status(404).json({ error: "NO_ENCONTRADO" });

/**
 * @description Manejador final de errores. Captura lo que falla fuera de los
 * controllers, como el rechazo de CORS, y lo traduce al contrato del proyecto.
 * Sin esto, Express responde HTML con la traza completa.
 * @param {Error} error - Error propagado.
 * @param {import("express").Request} req - Request de Express.
 * @param {import("express").Response} res - Response de Express.
 * @param {import("express").NextFunction} _next - Requerido por Express para reconocerlo como manejador de errores.
 * @returns {import("express").Response} Respuesta con el contrato de error.
 */
const manejadorFinal = (error, req, res, _next) => manejarErrorHttp(error, res);

app.use(rutaInexistente);
app.use(manejadorFinal);

module.exports = app;
