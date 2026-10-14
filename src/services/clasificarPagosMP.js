const { coincideImporte } = require("./PagoWebhookService");

/** Estados de Mercado Pago de un pago que todavía puede terminar aprobado. */
const ESTADOS_EN_CURSO = Object.freeze(["pending", "in_process", "authorized"]);

/**
 * Estados definitivos sin cobro, o con el dinero ya devuelto. Solo si todos los
 * pagos están en uno de estos se considera que no hubo cobro: cualquier otro
 * estado (por ejemplo in_mediation, un pago cobrado y en disputa) es desconocido.
 */
const ESTADOS_SIN_COBRO = Object.freeze(["rejected", "cancelled", "refunded", "charged_back"]);

/**
 * @description Clasifica los pagos que Mercado Pago tiene para un pedido. Dice
 * QUÉ hay, no qué hacer: cada caso de uso (vencimiento, reintento) aplica su
 * propia política sobre esta clasificación. Así las reglas sobre los estados de
 * Mercado Pago viven en un solo lugar.
 *
 * Función pura: no consulta ni escribe nada.
 *
 * @param {Object} datos - Datos de la clasificación.
 * @param {Object[]} datos.pagos - Pagos normalizados, del más nuevo al más viejo.
 * @param {{total: string}} datos.pedido - Pedido, para comparar el importe.
 * @returns {{tipo: string, pago?: Object, pagosAprobados?: string[]}} tipo:
 *   PAGO_APROBADO, PAGO_DUPLICADO, MONTO_NO_COINCIDE, PAGO_EN_CURSO,
 *   SIN_PAGO_APROBADO o ESTADO_DESCONOCIDO.
 */
function clasificarPagosMP({ pagos, pedido }) {
  const aprobados = pagos.filter((p) => p.estado === "approved");
  if (aprobados.length > 0) {
    const pagosAprobados = aprobados.map((p) => p.id);
    const validos = aprobados.filter((p) => coincideImporte(p, pedido));
    if (validos.length === 0) {
      return { tipo: "MONTO_NO_COINCIDE", pagosAprobados };
    }
    // El más viejo: si hubo cobro duplicado, el primero es el que vale
    const pago = validos[validos.length - 1];
    if (aprobados.length > 1) {
      return { tipo: "PAGO_DUPLICADO", pago, pagosAprobados };
    }
    return { tipo: "PAGO_APROBADO", pago };
  }

  if (pagos.some((p) => ESTADOS_EN_CURSO.includes(p.estado))) {
    return { tipo: "PAGO_EN_CURSO" };
  }

  // Sin pagos, every devuelve true: no hubo intento de pago
  if (pagos.every((p) => ESTADOS_SIN_COBRO.includes(p.estado))) {
    return { tipo: "SIN_PAGO_APROBADO" };
  }

  return { tipo: "ESTADO_DESCONOCIDO" };
}

module.exports = { clasificarPagosMP, ESTADOS_EN_CURSO, ESTADOS_SIN_COBRO };
