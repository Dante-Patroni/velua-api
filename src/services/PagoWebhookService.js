const { aCentavos } = require("../utils/dinero");

/** Estados de Mercado Pago que mueven el pedido, traducidos a los nuestros. */
const RESULTADO_POR_ESTADO = Object.freeze({ approved: "aprobado", rejected: "rechazado" });

/**
 * @description Indica si el pago cubre exactamente el total del pedido, en pesos.
 * @param {{monto: string, moneda: string}} pago - Pago normalizado.
 * @param {{total: string}} pedido - Pedido con su total.
 * @returns {boolean} true si coinciden moneda e importe al centavo.
 */
const coincideImporte = (pago, pedido) =>
  pago.moneda === "ARS" && aCentavos(pago.monto) === aCentavos(pedido.total);

/**
 * @description Procesa los avisos de pago del procesador.
 *
 * El aviso solo trae un id: todo lo demás se consulta al procesador, que es la única
 * fuente de verdad. Antes de mover el pedido verifica que el pago sea de ese pedido,
 * que el pedido se pague por ese medio y, si se aprobó, que el importe coincida.
 *
 * Distingue dos tipos de problema. Lo que no cuadra (pedido desconocido, monto
 * distinto) se anota y se devuelve: reintentar no lo arreglaría. Lo pasajero (el
 * procesador no responde) se lanza, para que el aviso se reintente.
 */
class PagoWebhookService {
  /**
   * @description Instancia el servicio.
   * @param {Object} deps - Dependencias.
   * @param {Object} deps.procesadorPagos - Implementación de ProcesadorPagos.
   * @param {Object} deps.pedidoRepository - Implementación de PedidoRepository.
   * @param {Object} deps.pedidoEstadoService - Instancia de PedidoEstadoService.
   * @param {{error: Function}} [deps.logger] - Dónde anotar lo que no cuadra.
   */
  constructor({ procesadorPagos, pedidoRepository, pedidoEstadoService, logger = console }) {
    this.procesador = procesadorPagos;
    this.repositorio = pedidoRepository;
    this.estados = pedidoEstadoService;
    this.logger = logger;
  }

  /**
   * @description Consulta un pago y, si corresponde, mueve el estado de su pedido.
   * @param {string} pagoId - Id del pago que trae el aviso.
   * @returns {Promise<{procesado: boolean, numero?: string, motivo?: string}>}
   *   procesado en true si el pedido cambió de estado; si no, el motivo.
   * @throws {Error} PROCESADOR_NO_DISPONIBLE o PROCESADOR_NO_CONFIGURADO: el aviso
   *   tiene que reintentarse.
   */
  async procesarNotificacion(pagoId) {
    const pago = await this.procesador.obtenerPago(String(pagoId));

    const resultado = RESULTADO_POR_ESTADO[pago.estado];
    if (!resultado) {
      return { procesado: false, motivo: "SIN_RESULTADO" };
    }

    const pedido = pago.referencia ? await this.repositorio.buscarPorNumero(pago.referencia) : null;
    if (!pedido) {
      this.logger.error(`[webhook] pago ${pago.id}: no hay pedido "${pago.referencia}"`);
      return { procesado: false, motivo: "PEDIDO_DESCONOCIDO" };
    }

    const { numero } = pedido;
    if (pedido.medioPago !== "mercadopago") {
      this.logger.error(`[webhook] pago ${pago.id}: ${numero} no es de Mercado Pago`);
      return { procesado: false, numero, motivo: "MEDIO_INCORRECTO" };
    }
    if (resultado === "aprobado" && !coincideImporte(pago, pedido)) {
      this.logger.error(
        `[webhook] pago ${pago.id}: ${numero} cobró ${pago.monto} ${pago.moneda} y el total es ${pedido.total} ARS`
      );
      return { procesado: false, numero, motivo: "MONTO_NO_COINCIDE" };
    }

    const r = await this.estados.registrarResultadoPago(pedido.id, {
      estado: resultado,
      pagoId: pago.id,
      metodo: pago.metodo,
    });

    if (r.motivo === "REQUIERE_REVISION") {
      this.logger.error(`[webhook] pago ${pago.id}: ${numero} aprobado sobre un pedido cerrado`);
    }

    return r.cambiado
      ? { procesado: true, numero }
      : { procesado: false, numero, motivo: r.motivo };
  }
}

module.exports = { PagoWebhookService, RESULTADO_POR_ESTADO };
