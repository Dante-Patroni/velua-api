"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  /**
   * @description Crea la bitácora de los pedidos: una fila por cada cambio de estado.
   *
   * Con la transferencia manual, alguien va a confirmar pagos a mano. Si alguna vez
   * hay un reclamo, "el sistema dice pagado" no alcanza: hace falta saber quién lo
   * confirmó, cuándo, y desde dónde.
   *
   * Las filas no se editan ni se borran: la bitácora solo crece.
   *
   * @param {import("sequelize").QueryInterface} queryInterface - Interfaz de consultas.
   * @param {import("sequelize").Sequelize} Sequelize - Constructor con los tipos de dato.
   * @returns {Promise<void>}
   */
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("pedido_eventos", {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
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
      // Cuál de las dos máquinas cambió. "aviso" es para lo que no cambia un estado
      // pero conviene registrar, como el "ya transferí" de la clienta.
      campo: {
        type: Sequelize.ENUM("pago", "preparacion", "aviso"),
        allowNull: false,
      },
      // Null en el primer evento, cuando el pedido se crea.
      estado_anterior: { type: Sequelize.STRING(30), allowNull: true },
      estado_nuevo: { type: Sequelize.STRING(30), allowNull: false },
      origen: {
        type: Sequelize.ENUM("checkout", "webhook", "job", "panel", "cliente"),
        allowNull: false,
      },
      // Solo cuando el cambio lo hizo una persona desde el panel.
      usuario_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
        references: { model: "usuarios", key: "id" },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },
      detalle: { type: Sequelize.STRING(500), allowNull: true },
      creado_en: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    });

    await queryInterface.addIndex("pedido_eventos", ["pedido_id", "creado_en"], {
      name: "ix_eventos_pedido",
    });
  },

  /**
   * @description Elimina la bitácora.
   * @param {import("sequelize").QueryInterface} queryInterface - Interfaz de consultas.
   * @returns {Promise<void>}
   */
  async down(queryInterface) {
    await queryInterface.dropTable("pedido_eventos");
  },
};
