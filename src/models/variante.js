const { Model, DataTypes } = require("sequelize");

/**
 * @description Define el modelo Variante y sus asociaciones.
 * @param {import('sequelize').Sequelize} sequelize - Instancia de Sequelize.
 * @returns {typeof Model} Clase del modelo Variante.
 */
module.exports = (sequelize) => {
  class Variante extends Model {
    /**
     * @description Establece la relación de la variante con su producto.
     * @param {Object} models - Diccionario con todos los modelos inicializados.
     * @returns {void}
     */
    static associate(models) {
      Variante.belongsTo(models.Producto, {
        foreignKey: "producto_id",
        as: "producto",
      });
    }
  }

  Variante.init(
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      productoId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        field: "producto_id",
      },
      nombre: {
        type: DataTypes.STRING(80),
        allowNull: false,
      },
      sku: {
        type: DataTypes.STRING(60),
        allowNull: true,
        unique: true,
      },
      precio: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
      },
      precioAnterior: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: true,
        field: "precio_anterior",
      },
      stock: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      pesoGramos: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        field: "peso_gramos",
      },
      activa: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
    },
    {
      sequelize,
      modelName: "Variante",
      tableName: "variantes",
      timestamps: true,
      createdAt: "creado_en",
      updatedAt: "actualizado_en",
    }
  );

  return Variante;
};
