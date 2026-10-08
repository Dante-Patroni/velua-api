const { Model, DataTypes } = require("sequelize");

/**
 * @description Define el modelo Categoria y sus asociaciones.
 *
 * Las categorías tienen dos niveles: arriba la línea de producto (Jabones,
 * Cuidado capilar) y debajo, cuando hace falta, las colecciones. Una categoría
 * tiene productos o tiene hijas, nunca las dos cosas. Esas reglas las hace
 * cumplir CategoriaAdminService; el modelo solo describe la relación.
 *
 * @param {import('sequelize').Sequelize} sequelize - Instancia de Sequelize.
 * @returns {typeof Model} Clase del modelo Categoria.
 */
module.exports = (sequelize) => {
  class Categoria extends Model {
    /**
     * @description Establece las relaciones de la categoría: sus productos, su
     * categoría padre y sus hijas.
     * @param {Object} models - Diccionario con todos los modelos inicializados.
     * @returns {void}
     */
    static associate(models) {
      Categoria.hasMany(models.Producto, {
        foreignKey: "categoria_id",
        as: "productos",
      });
      Categoria.belongsTo(models.Categoria, {
        foreignKey: "padreId",
        as: "padre",
      });
      Categoria.hasMany(models.Categoria, {
        foreignKey: "padreId",
        as: "hijas",
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
      padreId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        field: "padre_id",
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
      imagenPublicId: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: "imagen_public_id",
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
