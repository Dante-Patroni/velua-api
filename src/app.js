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

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || ORIGENES.includes(origin)) return callback(null, true);
      return callback(new Error("ORIGEN_NO_PERMITIDO"));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

app.use("/api", limitadorGlobal);

app.get("/api/v1/salud", async (req, res) => {
  const { sequelize } = require("./models");
  let baseDatos = "desconectada";
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
});

module.exports = app;