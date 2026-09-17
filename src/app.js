require("dotenv").config();

const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const swaggerUi = require("swagger-ui-express");

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

module.exports = app;
