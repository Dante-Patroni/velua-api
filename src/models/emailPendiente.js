const { Model, DataTypes } = require("sequelize");

/**
 * @description Define el modelo EmailPendiente: una fila de la bandeja de salida.
 *
 * Quien necesita mandar un mail inserta una fila; el job de H5 las toma y las
 * envía. Se guarda el tipo y los datos del momento, no el texto armado.
 *
 * @param {import("sequelize").Sequelize} sequelize - Instancia de Sequelize.
 * @returns {typeof Model} Clase del modelo EmailPendiente.
 */
module.exports = (sequelize) => {
  class EmailPendiente extends Model {}

  EmailPendiente.init(
    {
      id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
      pedidoId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
      tipo: { type: DataTypes.STRING(40), allowNull: false },
      destinatario: { type: DataTypes.STRING(180), allowNull: false },
      datos: { type: DataTypes.JSON, allowNull: false },
      estado: {
        type: DataTypes.ENUM("pendiente", "enviado", "fallido"),
        allowNull: false,
        defaultValue: "pendiente",
      },
      intentos: { type: DataTypes.SMALLINT.UNSIGNED, allowNull: false, defaultValue: 0 },
      ultimoError: { type: DataTypes.STRING(500), allowNull: true },
      enviarDesde: { type: DataTypes.DATE, allowNull: false },
      enviadoEn: { type: DataTypes.DATE, allowNull: true },
    },
    {
      sequelize,
      modelName: "EmailPendiente",
      tableName: "emails_pendientes",
      underscored: true,
      timestamps: true,
      createdAt: "creadoEn",
      updatedAt: false,
    }
  );

  return EmailPendiente;
};
