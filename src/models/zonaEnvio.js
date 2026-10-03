const { Model, DataTypes } = require("sequelize");

/**
 * @description Define el modelo ZonaEnvio, las zonas con su tarifa plana.
 * @param {import("sequelize").Sequelize} sequelize - Instancia de Sequelize.
 * @returns {typeof Model} Clase del modelo ZonaEnvio.
 */
module.exports = (sequelize) => {
  class ZonaEnvio extends Model {}

  ZonaEnvio.init(
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      nombre: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      costo: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
      },
      demoraTexto: {
        type: DataTypes.STRING(80),
        allowNull: true,
        field: "demora_texto",
      },
      activa: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      orden: {
        type: DataTypes.SMALLINT,
        allowNull: false,
        defaultValue: 0,
      },
    },
    {
      sequelize,
      modelName: "ZonaEnvio",
      tableName: "zonas_envio",
      timestamps: false,
    }
  );

  return ZonaEnvio;
};
