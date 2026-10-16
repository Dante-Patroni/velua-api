require("dotenv").config();

const base = {
  dialect: "mysql",
  seederStorage: "sequelize",
  seederStorageTableName: "SequelizeData",
  define: { underscored: true, timestamps: false },
};

// Producción: datos de conexión separados (no una URL) para que la API y las
// migraciones usen usuarios distintos sobre la misma base. Ver DECISIONES.md.
const produccion = {
  ...base,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_DATABASE,
  logging: false,
  dialectOptions: {
    ssl: { rejectUnauthorized: false },
  },
  pool: { max: 5, min: 0, acquire: 30000, idle: 10000 },
};

module.exports = {
  development: {
    ...base,
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    host: process.env.DB_HOST || "127.0.0.1",
    port: process.env.DB_PORT || 3306,
  },

  test: {
    ...base,
    username: process.env.DB_USERNAME || "root",
    password: process.env.DB_PASSWORD || "root",
    database: process.env.DB_DATABASE || "velua_test",
    host: process.env.DB_HOST || "127.0.0.1",
    port: process.env.DB_PORT || 3306,
    logging: false,
  },

  // La API en ejecución: usuario velua_app (solo SELECT, INSERT, UPDATE, DELETE).
  production: {
    ...produccion,
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
  },

  // Solo para el Pre-deploy Command de Railway: npx sequelize-cli db:migrate --env migraciones
  // Usuario velua_migraciones: permisos de estructura, solo sobre la base de Velua.
  migraciones: {
    ...produccion,
    username: process.env.DB_MIGRATION_USERNAME,
    password: process.env.DB_MIGRATION_PASSWORD,
    pool: { max: 1, min: 0, acquire: 30000, idle: 10000 },
  },
};
