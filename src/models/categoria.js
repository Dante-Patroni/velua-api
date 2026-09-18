const { Model, DataTypes } = require("sequelize");

/**
 * @description Define el modelo Categoria y sus asociaciones.
 * @param {import('sequelize').Sequelize} sequelize - Instancia de Sequelize.
 * @returns {typeof Model} Clase del modelo Categoria.
 */
module.exports = (sequelize) => {
  class Categoria extends Model {
    /**
     * @description Establece la relación de la categoría con los productos.
     * @param {Object} models - Diccionario con todos los modelos inicializados.
     * @returns {void}
     */
    static associate(models) {
      Categoria.hasMany(models.Producto, {
        foreignKey: "categoria_id",
        as: "productos",
      });
    }
  }

  Categoria.init(
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      nombre: {
        type: DataTypes.STRING(80),
        allowNull: false,
      },
      slug: {
        type: DataTypes.STRING(80),
        allowNull: false,
        unique: true,
      },
      descripcion: {
        type: DataTypes.STRING(300),
        allowNull: true,
      },
      imagenUrl: {
        type: DataTypes.STRING(500),
        allowNull: true,
        field: "imagen_url",
      },
      orden: {
        type: DataTypes.SMALLINT,
        allowNull: false,
        defaultValue: 0,
      },
      activa: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
    },
    {
      sequelize,
      modelName: "Categoria",
      tableName: "categorias",
      timestamps: true,
      createdAt: "creado_en",
      updatedAt: "actualizado_en",
    }
  );

  return Categoria;
};
