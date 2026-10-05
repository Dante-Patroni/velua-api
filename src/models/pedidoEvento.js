const { Model, DataTypes } = require("sequelize");

/**
 * @description Define el modelo PedidoEvento: una fila de la bitácora del pedido.
 * La bitácora solo crece: sus filas no se editan ni se borran.
 * @param {import("sequelize").Sequelize} sequelize - Instancia de Sequelize.
 * @returns {typeof Model} Clase del modelo PedidoEvento.
 */
module.exports = (sequelize) => {
  class PedidoEvento extends Model {
    /**
     * @description Declara las relaciones del evento.
     * @param {Object} models - Diccionario de modelos.
     * @returns {void}
     */
    static associate(models) {
      PedidoEvento.belongsTo(models.Pedido, { as: "pedido", foreignKey: "pedidoId" });
    }
  }

  PedidoEvento.init(
    {
      id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
      pedidoId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
      campo: { type: DataTypes.ENUM("pago", "preparacion", "aviso"), allowNull: false },
      estadoAnterior: { type: DataTypes.STRING(30), allowNull: true },
      estadoNuevo: { type: DataTypes.STRING(30), allowNull: false },
      origen: {
        type: DataTypes.ENUM("checkout", "webhook", "job", "panel", "cliente"),
        allowNull: false,
      },
      usuarioId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
      detalle: { type: DataTypes.STRING(500), allowNull: true },
    },
    {
      sequelize,
      modelName: "PedidoEvento",
      tableName: "pedido_eventos",
      underscored: true,
      timestamps: true,
      createdAt: "creadoEn",
      updatedAt: false,
    }
  );

  return PedidoEvento;
};
