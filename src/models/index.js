"use strict";

const fs = require("fs");
const path = require("path");
const Sequelize = require("sequelize");
const { instalarGuardaSqlMode } = require("../config/sqlMode");

const basename = path.basename(__filename);
const env = process.env.NODE_ENV || "development";
const config = require(path.join(__dirname, "..", "config", "config.js"))[env];

const db = {};

let sequelize;
if (config.use_env_variable) {
  sequelize = new Sequelize(process.env[config.use_env_variable], config);
} else {
  sequelize = new Sequelize(config.database, config.username, config.password, config);
}

// Antes de cualquier consulta: cada conexión nueva verifica que el sql_mode no anule
// el escape de Sequelize (NO_BACKSLASH_ESCAPES). Ver src/config/sqlMode.js.
instalarGuardaSqlMode(sequelize);

fs.readdirSync(__dirname)
  .filter(
    (file) =>
      file.indexOf(".") !== 0 &&
      file !== basename &&
      file.slice(-3) === ".js" &&
      file.indexOf(".test.js") === -1
  )
  .forEach((file) => {
    const model = require(path.join(__dirname, file))(sequelize, Sequelize.DataTypes);
    db[model.name] = model;
  });

Object.keys(db).forEach((modelName) => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
