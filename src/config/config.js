require("dotenv").config();

const base = {
  dialect: "mysql",
  seederStorage: "sequelize",
  seederStorageTableName: "SequelizeData",
  define: { underscored: true, timestamps: false },
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

  production: {
    ...base,
    use_env_variable: "DATABASE_URL",
    logging: false,
    dialectOptions: {
      ssl: { rejectUnauthorized: true },
    },
    pool: { max: 5, min: 0, acquire: 30000, idle: 10000 },
  },
};