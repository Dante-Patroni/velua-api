const { Model, DataTypes } = require("sequelize");

/**
 * @description Define el modelo Usuario del panel de administración.
 * @param {import("sequelize").Sequelize} sequelize - Instancia de Sequelize.
 * @returns {typeof Model} Clase del modelo Usuario.
 */
module.exports = (sequelize) => {
  class Usuario extends Model {}

  Usuario.init(
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      nombre: {
        type: DataTypes.STRING(120),
        allowNull: false,
      },
      email: {
        type: DataTypes.STRING(180),
        allowNull: false,
        unique: true,
      },
      passwordHash: {
        type: DataTypes.STRING(255),
        allowNull: false,
        field: "password_hash",
      },
      rol: {
        type: DataTypes.ENUM("admin", "operador"),
        allowNull: false,
        defaultValue: "operador",
      },
      activo: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      ultimoAcceso: {
        type: DataTypes.DATE,
        allowNull: true,
        field: "ultimo_acceso",
      },
    },
    {
      sequelize,
      modelName: "Usuario",
      tableName: "usuarios",
      timestamps: true,
      createdAt: "creado_en",
      updatedAt: false,
    }
  );

  return Usuario;
};
