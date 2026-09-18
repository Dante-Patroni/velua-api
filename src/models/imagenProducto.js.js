const { Model, DataTypes } = require("sequelize");

/**
 * @description Define el modelo ImagenProducto y sus asociaciones.
 * @param {import('sequelize').Sequelize} sequelize - Instancia de Sequelize.
 * @returns {typeof Model} Clase del modelo ImagenProducto.
 */
module.exports = (sequelize) => {
  class ImagenProducto extends Model {
    /**
     * @description Establece la relación de la imagen con su producto.
     * @param {Object} models - Diccionario con todos los modelos inicializados.
     * @returns {void}
     */
    static associate(models) {
      ImagenProducto.belongsTo(models.Producto, {
        foreignKey: "producto_id",
        as: "producto",
      });
    }
  }

  ImagenProducto.init(
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
      url: {
        type: DataTypes.STRING(500),
        allowNull: false,
      },
      alt: {
        type: DataTypes.STRING(200),
        allowNull: true,
      },
      orden: {
        type: DataTypes.SMALLINT,
        allowNull: false,
        defaultValue: 0,
      },
      publicId: {
        type: DataTypes.STRING(200),
        allowNull: true,
        field: "public_id",
      },
    },
    {
      sequelize,
      modelName: "ImagenProducto",
      tableName: "imagenes_producto",
      timestamps: false,
    }
  );

  return ImagenProducto;
};
