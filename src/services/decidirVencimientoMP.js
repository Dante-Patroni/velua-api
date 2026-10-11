const { coincideImporte } = require("./PagoWebhookService");

/** Estados de Mercado Pago de un pago que todavía puede terminar aprobado. */
const ESTADOS_EN_CURSO = Object.freeze(["pending", "in_process", "authorized"]);

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
 * @param {Object} datos - Datos de la decisión.
 * @param {Object[]} datos.pagos - Pagos normalizados, del más nuevo al más viejo.
 * @param {{total: string, creadoEn: Date|string}} datos.pedido - Pedido vencido.
 * @param {Date} datos.ahora - Momento de la decisión.
 * @param {number} datos.topeHoras - Cuánto se espera a un pago en curso, contado
 *   desde la creación del pedido.
 * @returns {{accion: string, motivo: string, pago?: Object, hasta?: Date}}
 *   accion: aprobar, postergar, revisar o cancelar.
 */
function decidirVencimientoMP({ pagos, pedido, ahora, topeHoras }) {
  const aprobados = pagos.filter((p) => p.estado === "approved");
  if (aprobados.length > 0) {
    const validos = aprobados.filter((p) => coincideImporte(p, pedido));
    if (validos.length === 0) {
      return { accion: "revisar", motivo: "MONTO_NO_COINCIDE" };
    }
    // El más viejo: si hubo cobro duplicado, el primero es el que vale
    const pago = validos[validos.length - 1];
    const motivo = aprobados.length > 1 ? "PAGO_DUPLICADO" : "PAGO_APROBADO";
    return { accion: "aprobar", motivo, pago };
  }

  if (pagos.some((p) => ESTADOS_EN_CURSO.includes(p.estado))) {
    const limite = new Date(pedido.creadoEn).getTime() + topeHoras * HORA_MS;
    if (ahora.getTime() >= limite) {
      return { accion: "revisar", motivo: "PAGO_EN_CURSO_SIN_RESOLVER" };
    }
    const hasta = new Date(Math.min(ahora.getTime() + POSTERGAR_MS, limite));
    return { accion: "postergar", motivo: "PAGO_EN_CURSO", hasta };
  }

  return { accion: "cancelar", motivo: "SIN_PAGO_APROBADO" };
}

module.exports = { decidirVencimientoMP, ESTADOS_EN_CURSO };
