const { Model, DataTypes } = require("sequelize");

/**
 * @description Define el modelo PedidoItem: una línea del pedido.
 *
 * El nombre, el SKU y el precio se copian al crear el pedido y no se tocan más.
 * Si mañana cambia el precio de un jabón, el pedido de ayer tiene que seguir
 * mostrando lo que se cobró.
 *
 * @param {import("sequelize").Sequelize} sequelize - Instancia de Sequelize.
 * @returns {typeof Model} Clase del modelo PedidoItem.
 */
module.exports = (sequelize) => {
  class PedidoItem extends Model {
    /**
     * @description Declara las relaciones del ítem.
     * @param {Object} models - Diccionario de modelos.
     * @returns {void}
     */
    static associate(models) {
      PedidoItem.belongsTo(models.Pedido, { as: "pedido", foreignKey: "pedidoId" });
    }
  }

  PedidoItem.init(
    {
      id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
      pedidoId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
      // Null si la variante se borró: el ítem conserva sus datos congelados igual.
      varianteId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
      nombreProducto: { type: DataTypes.STRING(140), allowNull: false },
      nombreVariante: { type: DataTypes.STRING(80), allowNull: false },
      sku: { type: DataTypes.STRING(60), allowNull: true },
      precioUnitario: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
      cantidad: { type: DataTypes.SMALLINT.UNSIGNED, allowNull: false },
      subtotal: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    },
    {
      sequelize,
      modelName: "PedidoItem",
      tableName: "pedido_items",
      underscored: true,
      timestamps: false,
    }
  );

  return PedidoItem;
};
