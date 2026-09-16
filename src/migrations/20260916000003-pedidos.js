"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  /**
   * @description Crea las tablas de pedidos y sus ítems con precios congelados.
   * @param {import("sequelize").QueryInterface} queryInterface - Interfaz de consultas.
   * @param {import("sequelize").Sequelize} Sequelize - Constructor con los tipos de dato.
   * @returns {Promise<void>}
   */
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("pedidos", {
      id: {
        type: Sequelize.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      numero: { type: Sequelize.STRING(20), allowNull: false, unique: true },

      cliente_nombre: { type: Sequelize.STRING(140), allowNull: false },
      cliente_email: { type: Sequelize.STRING(180), allowNull: false },
      cliente_telefono: { type: Sequelize.STRING(40), allowNull: false },
      cliente_documento: { type: Sequelize.STRING(20), allowNull: true },

      metodo_entrega: {
        type: Sequelize.ENUM("envio", "retiro"),
        allowNull: false,
        defaultValue: "envio",
      },
      zona_envio_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
        references: { model: "zonas_envio", key: "id" },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },
      direccion_calle: { type: Sequelize.STRING(180), allowNull: true },
      direccion_numero: { type: Sequelize.STRING(20), allowNull: true },
      direccion_extra: { type: Sequelize.STRING(120), allowNull: true },
      direccion_ciudad: { type: Sequelize.STRING(120), allowNull: true },
      direccion_provincia: { type: Sequelize.STRING(80), allowNull: true },
      direccion_cp: { type: Sequelize.STRING(20), allowNull: true },

      subtotal: { type: Sequelize.DECIMAL(12, 2), allowNull: false },
      descuento_cupon: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      ajuste_pago: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      costo_envio: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      total: { type: Sequelize.DECIMAL(12, 2), allowNull: false },

      estado_pago: {
        type: Sequelize.ENUM("pendiente", "aprobado", "rechazado", "devuelto", "cancelado"),
        allowNull: false,
        defaultValue: "pendiente",
      },
      estado_pedido: {
        type: Sequelize.ENUM("nuevo", "en_preparacion", "enviado", "entregado", "cancelado"),
        allowNull: false,
        defaultValue: "nuevo",
      },

      mp_preference_id: { type: Sequelize.STRING(80), allowNull: true },
      mp_payment_id: { type: Sequelize.STRING(80), allowNull: true },
      mp_metodo: { type: Sequelize.STRING(60), allowNull: true },

      expira_en: { type: Sequelize.DATE, allowNull: true },
      seguimiento: { type: Sequelize.STRING(120), allowNull: true },
      notas_cliente: { type: Sequelize.STRING(500), allowNull: true },
      notas_internas: { type: Sequelize.STRING(500), allowNull: true },

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

    await queryInterface.addIndex("pedidos", ["estado_pago"], { name: "ix_pedidos_estado_pago" });
    await queryInterface.addIndex("pedidos", ["creado_en"], { name: "ix_pedidos_creado" });
    await queryInterface.addIndex("pedidos", ["cliente_email"], { name: "ix_pedidos_email" });
    await queryInterface.addIndex("pedidos", ["mp_payment_id"], { name: "ix_pedidos_mp_payment" });
    await queryInterface.addIndex("pedidos", ["expira_en"], { name: "ix_pedidos_expira" });

    await queryInterface.createTable("pedido_items", {
      id: {
        type: Sequelize.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      pedido_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        references: { model: "pedidos", key: "id" },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      variante_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
        references: { model: "variantes", key: "id" },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },

      nombre_producto: { type: Sequelize.STRING(140), allowNull: false },
      nombre_variante: { type: Sequelize.STRING(80), allowNull: false },
      sku: { type: Sequelize.STRING(60), allowNull: true },
      precio_unitario: { type: Sequelize.DECIMAL(12, 2), allowNull: false },
      cantidad: { type: Sequelize.SMALLINT.UNSIGNED, allowNull: false },
      subtotal: { type: Sequelize.DECIMAL(12, 2), allowNull: false },
    });

    await queryInterface.addIndex("pedido_items", ["pedido_id"], { name: "ix_items_pedido" });

    await queryInterface.sequelize.query(
      "ALTER TABLE pedido_items ADD CONSTRAINT ck_items_cantidad CHECK (cantidad > 0)"
    );
  },

  /**
   * @description Elimina las tablas de pedidos y sus tipos ENUM asociados.
   * @param {import("sequelize").QueryInterface} queryInterface - Interfaz de consultas.
   * @returns {Promise<void>}
   */
  async down(queryInterface) {
    await queryInterface.dropTable("pedido_items");
    await queryInterface.dropTable("pedidos");
  },
};