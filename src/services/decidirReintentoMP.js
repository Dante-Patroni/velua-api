const { clasificarPagosMP } = require("./clasificarPagosMP");

/**
 * @description Decide si es seguro dar un link de pago para un pedido que ya
 * existe, según los pagos que Mercado Pago tiene para su referencia.
 *
 * La política es más estricta que la del vencimiento: ante cualquier pago que
 * pueda terminar en cobro, o ante la duda, no se da otro link. Dar un link de
 * más puede cobrar dos veces; no darlo solo hace esperar.
 *
 * Función pura: no consulta ni escribe nada. Quien la usa aplica el pago o marca
 * la revisión según lo que devuelve.
 *
 * @param {Object} datos - Datos de la decisión.
 * @param {Object[]} datos.pagos - Pagos normalizados, del más nuevo al más viejo.
 * @param {{total: string}} datos.pedido - Pedido, para comparar el importe.
 * @returns {{permitir: boolean, codigo?: string, motivo: string,
 *   pagoAAplicar?: Object, revisar: boolean, pagosAprobados?: string[]}}
 *   permitir: si se puede dar el link. codigo: el error para la clienta si no.
 *   pagoAAplicar: pago aprobado que hay que registrar. revisar: si hay que
 *   marcar el pedido para revisión.
 */
function decidirReintentoMP({ pagos, pedido }) {
  const { tipo, pago, pagosAprobados } = clasificarPagosMP({ pagos, pedido });

  switch (tipo) {
    case "SIN_PAGO_APROBADO":
      return { permitir: true, motivo: tipo, revisar: false };

    case "PAGO_APROBADO":
      return {
        permitir: false,
        codigo: "PEDIDO_YA_PAGADO",
        motivo: tipo,
        pagoAAplicar: pago,
        revisar: false,
      };

    case "PAGO_DUPLICADO":
      // Para la clienta está pago. Internamente hay que devolver un cobro.
      return {
        permitir: false,
        codigo: "PEDIDO_YA_PAGADO",
        motivo: tipo,
        pagoAAplicar: pago,
        revisar: true,
        pagosAprobados,
      };

    case "MONTO_NO_COINCIDE":
      return {
        permitir: false,
        codigo: "PEDIDO_EN_REVISION",
        motivo: tipo,
        revisar: true,
        pagosAprobados,
      };

    case "PAGO_EN_CURSO":
      return { permitir: false, codigo: "PAGO_EN_PROCESO", motivo: tipo, revisar: false };

    default:
      // ESTADO_DESCONOCIDO o un tipo nuevo: no dar link y que alguien lo mire
      return {
        permitir: false,
        codigo: "PEDIDO_EN_REVISION",
        motivo: "ESTADO_DESCONOCIDO",
        revisar: true,
      };
  }
}

module.exports = { decidirReintentoMP };
