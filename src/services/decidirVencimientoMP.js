const { clasificarPagosMP, ESTADOS_EN_CURSO, ESTADOS_SIN_COBRO } = require("./clasificarPagosMP");

const HORA_MS = 60 * 60 * 1000;

/** Cada cuánto se vuelve a mirar un pedido con un pago en curso. */
const POSTERGAR_MS = HORA_MS;

/**
 * @description Decide qué hacer con un pedido de Mercado Pago vencido, según los
 * pagos que Mercado Pago tiene para su referencia.
 *
 * Es una función pura: no consulta ni escribe nada. Así la política se prueba y se
 * cambia sin tocar el job. Ante la duda nunca cancela: retener el stock un rato
 * más es mejor que cancelar un pedido pagado.
 *
 * La clasificación de los pagos está en clasificarPagosMP; acá solo la política.
 *
 * @param {Object} datos - Datos de la decisión.
 * @param {Object[]} datos.pagos - Pagos normalizados, del más nuevo al más viejo.
 * @param {{total: string, creadoEn: Date|string}} datos.pedido - Pedido vencido.
 * @param {Date} datos.ahora - Momento de la decisión.
 * @param {number} datos.topeHoras - Cuánto se espera a un pago en curso, contado
 *   desde la creación del pedido.
 * @returns {{accion: string, motivo: string, pago?: Object, hasta?: Date,
 *   pagosAprobados?: string[]}} accion: aprobar, postergar, revisar o cancelar.
 *   pagosAprobados lista los ids cuando hay algo que revisar con los cobros.
 */
function decidirVencimientoMP({ pagos, pedido, ahora, topeHoras }) {
  const { tipo, ...detalle } = clasificarPagosMP({ pagos, pedido });

  switch (tipo) {
    case "PAGO_APROBADO":
    case "PAGO_DUPLICADO":
      return { accion: "aprobar", motivo: tipo, ...detalle };

    case "MONTO_NO_COINCIDE":
      return { accion: "revisar", motivo: tipo, ...detalle };

    case "PAGO_EN_CURSO": {
      const limite = new Date(pedido.creadoEn).getTime() + topeHoras * HORA_MS;
      if (ahora.getTime() >= limite) {
        return { accion: "revisar", motivo: "PAGO_EN_CURSO_SIN_RESOLVER" };
      }
      const hasta = new Date(Math.min(ahora.getTime() + POSTERGAR_MS, limite));
      return { accion: "postergar", motivo: tipo, hasta };
    }

    case "SIN_PAGO_APROBADO":
      return { accion: "cancelar", motivo: tipo };

    default:
      // ESTADO_DESCONOCIDO o un tipo nuevo: ante la duda, revisión
      return { accion: "revisar", motivo: "ESTADO_DESCONOCIDO" };
  }
}

module.exports = { decidirVencimientoMP, ESTADOS_EN_CURSO, ESTADOS_SIN_COBRO };
