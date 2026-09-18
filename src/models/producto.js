const { Model, DataTypes } = require("sequelize");

/**
 * @description Define el modelo Producto y sus asociaciones.
 * @param {import('sequelize').Sequelize} sequelize - Instancia de Sequelize.
 * @returns {typeof Model} Clase del modelo Producto.
 */
module.exports = (sequelize) => {
  class Producto extends Model {
    /**
     * @description Establece las relaciones del producto con categorías, variantes e imágenes.
     * @param {Object} models - Diccionario con todos los modelos inicializados.
     * @returns {void}
     */
    static associate(models) {
      Producto.belongsTo(models.Categoria, {
        foreignKey: "categoria_id",
        as: "categoria",
      });
      Producto.hasMany(models.Variante, {
        foreignKey: "producto_id",
        as: "variantes",
      });
      Producto.hasMany(models.ImagenProducto, {
        foreignKey: "producto_id",
        as: "imagenes",
      });
    }
  }

  Producto.init(
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      categoriaId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        field: "categoria_id",
      },
      nombre: {
        type: DataTypes.STRING(140),
        allowNull: false,
      },
      slug: {
        type: DataTypes.STRING(160),
        allowNull: false,
        unique: true,
      },
      descripcionCorta: {
        type: DataTypes.STRING(300),
        allowNull: true,
        field: "descripcion_corta",
      },
      descripcion: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      ingredientes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      modoUso: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: "modo_uso",
      },
      activo: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      destacado: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
    },
    {
      sequelize,
      modelName: "Producto",
      tableName: "productos",
      timestamps: true,
      createdAt: "creado_en",
      updatedAt: "actualizado_en",
    }
  );

  return Producto;
};
