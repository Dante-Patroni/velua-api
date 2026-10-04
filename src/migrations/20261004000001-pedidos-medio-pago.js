"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  /**
   * @description Agrega a los pedidos el medio de pago elegido y la fecha en que la
   * clienta avisó que transfirió.
   *
   * `medio_pago` hace falta para tres cosas: el descuento, que depende del medio; el
   * vencimiento de la reserva, que es distinto para cada uno; y el panel, que tiene
   * que mostrarlo. Las columnas `mp_*` describen el pago de Mercado Pago una vez que
   * existe, no lo que eligió la clienta.
   *
   * `comprobante_informado_en` es una fecha y no un booleano: cumple la misma función
   * para el job de vencimientos, que no cancela los pedidos con aviso, y además dice
   * cuándo avisó, lo que sirve para ordenar qué revisar primero.
   *
   * @param {import("sequelize").QueryInterface} queryInterface - Interfaz de consultas.
   * @param {import("sequelize").Sequelize} Sequelize - Constructor con los tipos de dato.
   * @returns {Promise<void>}
   */
  async up(queryInterface, Sequelize) {
    // Sin valor por defecto a propósito: un pedido sin medio de pago es un error del
    // checkout, y un default lo escondería. La tabla todavía no tiene pedidos reales.
    await queryInterface.addColumn("pedidos", "medio_pago", {
      type: Sequelize.ENUM("mercadopago", "transferencia"),
      allowNull: false,
      after: "estado_pedido",
    });

    await queryInterface.addColumn("pedidos", "comprobante_informado_en", {
      type: Sequelize.DATE,
      allowNull: true,
      after: "expira_en",
    });
  },

  /**
   * @description Quita las dos columnas.
   * @param {import("sequelize").QueryInterface} queryInterface - Interfaz de consultas.
   * @returns {Promise<void>}
   */
  async down(queryInterface) {
    await queryInterface.removeColumn("pedidos", "comprobante_informado_en");
    await queryInterface.removeColumn("pedidos", "medio_pago");
  },
};
