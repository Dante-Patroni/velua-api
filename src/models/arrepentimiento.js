const { Model, DataTypes } = require("sequelize");

/**
 * @description Define el modelo Arrepentimiento: una solicitud de revocación de una
 * compra hecha con el botón de arrepentimiento (Resolución 424/2020).
 *
 * El número de pedido se guarda como texto, sin clave foránea: la clienta puede no
 * tenerlo o escribirlo mal, y la solicitud se registra igual. La dueña la vincula
 * con el pedido a mano.
 *
 * @param {import("sequelize").Sequelize} sequelize - Instancia de Sequelize.
 * @returns {typeof Model} Clase del modelo Arrepentimiento.
 */
module.exports = (sequelize) => {
  class Arrepentimiento extends Model {}

  Arrepentimiento.init(
    {
      id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
      codigo: { type: DataTypes.STRING(30), allowNull: false, unique: true },
      pedidoNumero: { type: DataTypes.STRING(20), allowNull: true },
      nombre: { type: DataTypes.STRING(140), allowNull: false },
      email: { type: DataTypes.STRING(180), allowNull: false },
      telefono: { type: DataTypes.STRING(40), allowNull: true },
      motivo: { type: DataTypes.STRING(600), allowNull: true },
      estado: {
        type: DataTypes.ENUM("recibido", "en_gestion", "resuelto"),
        allowNull: false,
        defaultValue: "recibido",
      },
    },
    {
      sequelize,
      modelName: "Arrepentimiento",
      tableName: "arrepentimientos",
      underscored: true,
      timestamps: true,
      createdAt: "creadoEn",
      updatedAt: false,
    }
  );

  return Arrepentimiento;
};
