const { Model, DataTypes } = require("sequelize");

/**
 * @description Define el modelo Pedido.
 *
 * Los importes son DECIMAL, así que Sequelize los devuelve como cadena: nunca se
 * convierten a número en el camino. Los cálculos se hacen en centavos con
 * `utils/dinero`.
 *
 * @param {import("sequelize").Sequelize} sequelize - Instancia de Sequelize.
 * @returns {typeof Model} Clase del modelo Pedido.
 */
module.exports = (sequelize) => {
  class Pedido extends Model {
    /**
     * @description Declara las relaciones del pedido.
     * @param {Object} models - Diccionario de modelos.
     * @returns {void}
     */
    static associate(models) {
      Pedido.hasMany(models.PedidoItem, { as: "items", foreignKey: "pedidoId" });
      Pedido.hasMany(models.PedidoEvento, { as: "eventos", foreignKey: "pedidoId" });
      Pedido.belongsTo(models.ZonaEnvio, { as: "zonaEnvio", foreignKey: "zonaEnvioId" });
    }
  }

  Pedido.init(
    {
      id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
      numero: { type: DataTypes.STRING(20), allowNull: false, unique: true },

      clienteNombre: { type: DataTypes.STRING(140), allowNull: false },
      clienteEmail: { type: DataTypes.STRING(180), allowNull: false },
      clienteTelefono: { type: DataTypes.STRING(40), allowNull: false },
      clienteDocumento: { type: DataTypes.STRING(20), allowNull: true },

      metodoEntrega: { type: DataTypes.ENUM("envio", "retiro"), allowNull: false },
      zonaEnvioId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
      direccionCalle: { type: DataTypes.STRING(180), allowNull: true },
      direccionNumero: { type: DataTypes.STRING(20), allowNull: true },
      direccionExtra: { type: DataTypes.STRING(120), allowNull: true },
      direccionCiudad: { type: DataTypes.STRING(120), allowNull: true },
      direccionProvincia: { type: DataTypes.STRING(80), allowNull: true },
      direccionCp: { type: DataTypes.STRING(20), allowNull: true },

      subtotal: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
      descuentoCupon: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      ajustePago: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      costoEnvio: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      total: { type: DataTypes.DECIMAL(12, 2), allowNull: false },

      estadoPago: {
        type: DataTypes.ENUM("pendiente", "aprobado", "rechazado", "devuelto", "cancelado"),
        allowNull: false,
        defaultValue: "pendiente",
      },
      estadoPedido: {
        type: DataTypes.ENUM("nuevo", "en_preparacion", "enviado", "entregado", "cancelado"),
        allowNull: false,
        defaultValue: "nuevo",
      },
      medioPago: { type: DataTypes.ENUM("mercadopago", "transferencia"), allowNull: false },

      mpPreferenceId: { type: DataTypes.STRING(80), allowNull: true },
      mpPaymentId: { type: DataTypes.STRING(80), allowNull: true },
      mpMetodo: { type: DataTypes.STRING(60), allowNull: true },

      expiraEn: { type: DataTypes.DATE, allowNull: true },
      comprobanteInformadoEn: { type: DataTypes.DATE, allowNull: true },
      seguimiento: { type: DataTypes.STRING(120), allowNull: true },
      notasCliente: { type: DataTypes.STRING(500), allowNull: true },
      notasInternas: { type: DataTypes.STRING(500), allowNull: true },
    },
    {
      sequelize,
      modelName: "Pedido",
      tableName: "pedidos",
      underscored: true,
      timestamps: true,
      createdAt: "creadoEn",
      updatedAt: "actualizadoEn",
    }
  );

  return Pedido;
};
