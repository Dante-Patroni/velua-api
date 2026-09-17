"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  /**
   * @description Crea las tablas del catálogo: categorías, productos, variantes e imágenes.
   * @param {import("sequelize").QueryInterface} queryInterface - Interfaz de consultas.
   * @param {import("sequelize").Sequelize} Sequelize - Constructor con los tipos de dato.
   * @returns {Promise<void>}
   */
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("categorias", {
      id: {
        type: Sequelize.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      nombre: { type: Sequelize.STRING(80), allowNull: false },
      slug: { type: Sequelize.STRING(80), allowNull: false, unique: true },
      descripcion: { type: Sequelize.STRING(300), allowNull: true },
      imagen_url: { type: Sequelize.STRING(500), allowNull: true },
      orden: { type: Sequelize.SMALLINT, allowNull: false, defaultValue: 0 },
      activa: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      creado_en: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      actualizado_en: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"),
      },
    });

    await queryInterface.createTable("productos", {
      id: {
        type: Sequelize.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      categoria_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        references: { model: "categorias", key: "id" },
        onDelete: "RESTRICT",
        onUpdate: "CASCADE",
      },
      nombre: { type: Sequelize.STRING(140), allowNull: false },
      slug: { type: Sequelize.STRING(160), allowNull: false, unique: true },
      descripcion_corta: { type: Sequelize.STRING(300), allowNull: true },
      descripcion: { type: Sequelize.TEXT, allowNull: true },
      ingredientes: { type: Sequelize.TEXT, allowNull: true },
      modo_uso: { type: Sequelize.TEXT, allowNull: true },
      activo: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      destacado: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      creado_en: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      actualizado_en: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"),
      },
    });

    await queryInterface.addIndex("productos", ["activo", "destacado"], {
      name: "ix_productos_activo",
    });

    await queryInterface.createTable("variantes", {
      id: {
        type: Sequelize.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      producto_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        references: { model: "productos", key: "id" },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      nombre: { type: Sequelize.STRING(80), allowNull: false },
      sku: { type: Sequelize.STRING(60), allowNull: true, unique: true },
      precio: { type: Sequelize.DECIMAL(12, 2), allowNull: false },
      precio_anterior: { type: Sequelize.DECIMAL(12, 2), allowNull: true },
      stock: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      peso_gramos: { type: Sequelize.INTEGER.UNSIGNED, allowNull: true },
      activa: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      creado_en: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      actualizado_en: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"),
      },
    });

    await queryInterface.sequelize.query(
      "ALTER TABLE variantes ADD CONSTRAINT ck_variantes_precio CHECK (precio >= 0)"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE variantes ADD CONSTRAINT ck_variantes_stock CHECK (stock >= 0)"
    );

    await queryInterface.createTable("imagenes_producto", {
      id: {
        type: Sequelize.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      producto_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        references: { model: "productos", key: "id" },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      url: { type: Sequelize.STRING(500), allowNull: false },
      alt: { type: Sequelize.STRING(200), allowNull: true },
      orden: { type: Sequelize.SMALLINT, allowNull: false, defaultValue: 0 },
    });

    await queryInterface.addIndex("imagenes_producto", ["producto_id", "orden"], {
      name: "ix_imagenes_producto",
    });
  },

  /**
   * @description Revierte las tablas del catálogo en orden inverso al de creación.
   * @param {import("sequelize").QueryInterface} queryInterface - Interfaz de consultas.
   * @returns {Promise<void>}
   */
  async down(queryInterface) {
    await queryInterface.dropTable("imagenes_producto");
    await queryInterface.dropTable("variantes");
    await queryInterface.dropTable("productos");
    await queryInterface.dropTable("categorias");
  },
};
