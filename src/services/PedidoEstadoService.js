const { ESTADOS_PAGO_VENCIBLES, validarTransicion } = require("./transicionesPedido");

/**
 * @description Indica si la reserva de un pedido está vencida y se puede cancelar.
 *
 * Las tres condiciones tienen que cumplirse a la vez:
 * - el pago sigue sin aprobarse (pendiente o rechazado);
 * - el plazo ya pasó;
 * - la clienta no avisó que transfirió. Si avisó, el pedido espera a que la dueña
 *   confirme o cancele a mano desde el panel.
 *
 * @param {Object} pedido - Pedido con estadoPago, expiraEn y comprobanteInformadoEn.
 * @param {Date} ahora - Momento de referencia.
 * @returns {boolean} true si corresponde cancelarlo.
 */
const estaVencido = (pedido, ahora) =>
  ESTADOS_PAGO_VENCIBLES.includes(pedido.estadoPago) &&
  Boolean(pedido.expiraEn) &&
  new Date(pedido.expiraEn).getTime() <= ahora.getTime() &&
  !pedido.comprobanteInformadoEn;

/**
 * @description Cambia el estado de los pedidos pasando por la máquina de estados.
 *
 * Ninguna transición se hace con un update suelto: cada una valida que sea legal y
 * ejecuta sus efectos (stock, bitácora, mail) dentro de una sola transacción. Por
 * ahora implementa la cancelación por vencimiento; las demás transiciones llegan
 * con el webhook y el panel de pedidos.
 */
class PedidoEstadoService {
  /**
   * @description Instancia el servicio.
   * @param {import("../repositories/PedidoRepository").PedidoRepository} pedidoRepository - Repositorio de pedidos.
   * @param {() => Date} [ahora] - Reloj. Se inyecta para poder fijar la hora en los tests.
   */
  constructor(pedidoRepository, ahora = () => new Date()) {
    this.repositorio = pedidoRepository;
    this.ahora = ahora;
  }

  /**
   * @description Cancela un pedido cuya reserva venció y devuelve su stock.
   *
   * El pedido se vuelve a leer con candado adentro de la transacción y se revisa de
   * nuevo si sigue vencido. Entre que el job lo encontró y este momento pudo llegar
   * el pago, o la clienta pudo avisar que transfirió: en ese caso no se toca nada.
   *
   * Por la misma razón el stock se repone una sola vez: si dos llamadas compiten por
   * el mismo pedido, la segunda espera el candado, lo encuentra cancelado y sale.
   *
   * @param {number} pedidoId - Id del pedido.
   * @returns {Promise<{cancelado: boolean, numero?: string, motivo?: string}>}
   *   cancelado en true si lo canceló; si no, el motivo.
   * @throws {Error} TRANSICION_INVALIDA si el estado de preparación no admite cancelar.
   */
  async cancelarVencido(pedidoId) {
    const resultado = await this.repositorio.transaccion(async (tx) => {
      const pedido = await tx.bloquearPedido(pedidoId);
      if (!pedido) {
        return { cancelado: false, motivo: "NO_EXISTE" };
      }
      if (!estaVencido(pedido, this.ahora())) {
        return { cancelado: false, motivo: "YA_NO_CORRESPONDE" };
      }

      validarTransicion("pago", pedido.estadoPago, "cancelado");
      validarTransicion("preparacion", pedido.estadoPedido, "cancelado");

      // En orden de variante, igual que el checkout, para que dos transacciones
      // que tocan las mismas variantes no se traben entre sí.
      const items = (await tx.listarItems(pedido.id))
        .filter((i) => Number.isInteger(i.varianteId))
        .sort((a, b) => a.varianteId - b.varianteId);
      for (const item of items) {
        await tx.reponerStock(item.varianteId, item.cantidad);
      }

      await tx.actualizarEstados(pedido.id, {
        estadoPago: "cancelado",
        estadoPedido: "cancelado",
      });

      await tx.registrarEvento({
        pedidoId: pedido.id,
        campo: "pago",
        estadoAnterior: pedido.estadoPago,
        estadoNuevo: "cancelado",
        origen: "job",
        detalle: "Reserva vencida, stock devuelto",
      });
      await tx.registrarEvento({
        pedidoId: pedido.id,
        campo: "preparacion",
        estadoAnterior: pedido.estadoPedido,
        estadoNuevo: "cancelado",
        origen: "job",
      });

      // Si el encolado falla, falla todo: la cancelación se reintenta en la próxima
      // vuelta del job, con su mail.
      await tx.encolarEmail({
        pedidoId: pedido.id,
        tipo: "pedido_cancelado",
        destinatario: pedido.clienteEmail,
        datos: {
          numero: pedido.numero,
          nombre: pedido.clienteNombre,
          medioPago: pedido.medioPago,
          motivo: "vencimiento",
        },
      });

      return { cancelado: true, numero: pedido.numero };
    });

    return resultado;
  }
}

module.exports = { PedidoEstadoService, estaVencido };
