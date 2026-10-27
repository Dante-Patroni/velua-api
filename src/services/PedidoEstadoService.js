const {
  ESTADOS_PAGO_VENCIBLES,
  esTransicionValida,
  validarTransicion,
} = require("./transicionesPedido");

/** Resultados del procesador que mueven el estado de pago. */
const RESULTADOS_PAGO = Object.freeze(["aprobado", "rechazado"]);

/** Estados de preparación a los que se avanza a mano desde el panel. */
const AVANCES_PREPARACION = Object.freeze(["en_preparacion", "enviado", "entregado"]);

/** Estados de pago en los que se puede cancelar a mano. Un pago aprobado se devuelve (t13c). */
const PAGOS_CANCELABLES = Object.freeze(["pendiente", "rechazado"]);

/**
 * @description Devuelve al stock las unidades de un pedido, en orden de variante,
 * igual que el checkout bloquea, para que dos transacciones no se traben.
 * @param {Object} tx - Repositorio transaccional.
 * @param {number} pedidoId - Id del pedido.
 * @returns {Promise<void>}
 */
const reponerStockDelPedido = async (tx, pedidoId) => {
  const items = (await tx.listarItems(pedidoId))
    .filter((i) => Number.isInteger(i.varianteId))
    .sort((a, b) => a.varianteId - b.varianteId);
  for (const item of items) {
    await tx.reponerStock(item.varianteId, item.cantidad);
  }
};

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
 * ejecuta sus efectos (stock, bitácora, mail) dentro de una sola transacción.
 * Implementa la cancelación por vencimiento y el resultado de un pago online;
 * las transiciones manuales llegan con el panel de pedidos.
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

      await reponerStockDelPedido(tx, pedido.id);

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

  /**
   * @description Registra el resultado de un pago online: aprobado o rechazado.
   *
   * Es idempotente: el procesador puede avisar varias veces lo mismo, y repetir un
   * resultado ya registrado no vuelve a encolar el mail ni a escribir nada.
   *
   * Nunca lanza por un aviso que no corresponde, porque el webhook lo reintentaría
   * para siempre. Devuelve el motivo:
   * - YA_REGISTRADO: el pedido ya estaba en ese estado.
   * - FUERA_DE_ORDEN: un rechazo que llega después de la aprobación. Se ignora.
   * - REQUIERE_REVISION: un pago aprobado sobre un pedido cancelado. Se cobró sin
   *   pedido: queda en la bitácora para que la dueña lo devuelva a mano.
   * - PAGO_DUPLICADO: un pago aprobado distinto del que ya aprobó el pedido. Se
   *   anota con los dos ids; no se vuelve a aprobar.
   *
   * @param {number} pedidoId - Id del pedido.
   * @param {Object} pago - Resultado del procesador.
   * @param {"aprobado"|"rechazado"} pago.estado - Resultado.
   * @param {string} pago.pagoId - Id del pago en el procesador.
   * @param {string|null} [pago.metodo] - Medio usado, por ejemplo "visa".
   * @param {string} [pago.origen] - Quién lo registra, para la bitácora: "webhook"
   * (por defecto) o "job" (reconciliación).
   * @returns {Promise<{cambiado: boolean, numero?: string, motivo?: string}>}
   *   cambiado en true si movió el estado; si no, el motivo.
   * @throws {Error} Si el estado no es aprobado ni rechazado: error de programación.
   */
  async registrarResultadoPago(pedidoId, { estado, pagoId, metodo = null, origen = "webhook" }) {
    if (!RESULTADOS_PAGO.includes(estado)) {
      throw new Error(`Resultado de pago desconocido: ${estado}`);
    }

    const resultado = await this.repositorio.transaccion(async (tx) => {
      const pedido = await tx.bloquearPedido(pedidoId);
      if (!pedido) {
        return { cambiado: false, motivo: "NO_EXISTE" };
      }
      const { numero } = pedido;

      if (pedido.estadoPago === estado) {
        // Aprobado con OTRO pago: la clienta pudo haber pagado dos veces (por ejemplo,
        // reintentó antes de ver la confirmación). No se aplica de nuevo: se anota
        // con los dos ids para que la dueña revise y devuelva uno.
        const otroPago =
          estado === "aprobado" &&
          pedido.mpPaymentId &&
          String(pedido.mpPaymentId) !== String(pagoId);
        if (otroPago) {
          await tx.registrarEvento({
            pedidoId: pedido.id,
            campo: "pago",
            estadoAnterior: pedido.estadoPago,
            estadoNuevo: pedido.estadoPago,
            origen,
            detalle: `Posible cobro duplicado: pago ${pagoId} aprobado y el pedido ya estaba aprobado con el pago ${pedido.mpPaymentId}. Revisar y devolver uno`,
          });
          return { cambiado: false, numero, motivo: "PAGO_DUPLICADO" };
        }
        return { cambiado: false, numero, motivo: "YA_REGISTRADO" };
      }

      if (!esTransicionValida("pago", pedido.estadoPago, estado)) {
        if (estado !== "aprobado") {
          return { cambiado: false, numero, motivo: "FUERA_DE_ORDEN" };
        }
        // Plata cobrada sobre un pedido que ya no existe para la tienda: el stock
        // se devolvió y el pedido no se prepara. No se reabre solo; lo decide la dueña.
        await tx.registrarEvento({
          pedidoId: pedido.id,
          campo: "pago",
          estadoAnterior: pedido.estadoPago,
          estadoNuevo: pedido.estadoPago,
          origen,
          detalle: `Pago ${pagoId} aprobado sobre un pedido ${pedido.estadoPago}: revisar y devolver el dinero`,
        });
        return { cambiado: false, numero, motivo: "REQUIERE_REVISION" };
      }

      await tx.actualizarEstados(pedido.id, { estadoPago: estado });
      await tx.guardarDatosPago(pedido.id, {
        mpPaymentId: String(pagoId),
        mpMetodo: metodo,
        // Aprobado: el pedido deja de vencer. Rechazado: sigue el plazo original,
        // así la clienta puede reintentar mientras el stock esté apartado.
        ...(estado === "aprobado" ? { expiraEn: null } : {}),
      });

      await tx.registrarEvento({
        pedidoId: pedido.id,
        campo: "pago",
        estadoAnterior: pedido.estadoPago,
        estadoNuevo: estado,
        origen,
        detalle: `Pago ${pagoId}${metodo ? ` (${metodo})` : ""}`,
      });

      // Si el encolado falla, falla todo y el procesador vuelve a avisar.
      await tx.encolarEmail({
        pedidoId: pedido.id,
        tipo: estado === "aprobado" ? "pago_confirmado" : "pago_rechazado",
        destinatario: pedido.clienteEmail,
        datos: {
          numero,
          nombre: pedido.clienteNombre,
          total: pedido.total,
          ...(estado === "rechazado" && pedido.expiraEn
            ? { expiraEn: new Date(pedido.expiraEn).toISOString() }
            : {}),
        },
      });

      return { cambiado: true, numero };
    });

    return resultado;
  }

  /**
   * @description Posterga el vencimiento de un pedido que tiene un pago en curso.
   *
   * Lo usa la reconciliación cuando Mercado Pago tiene un pago que todavía puede
   * aprobarse: el stock sigue apartado y el pedido se vuelve a mirar más tarde.
   * Igual que cancelarVencido, relee el pedido con candado: si mientras tanto se
   * aprobó, no le vuelve a poner un vencimiento.
   *
   * @param {number} pedidoId - Id del pedido.
   * @param {Object} opciones - Datos de la postergación.
   * @param {Date} opciones.hasta - Nuevo vencimiento.
   * @param {string} opciones.motivo - Por qué se posterga, para la bitácora.
   * @returns {Promise<{postergado: boolean, numero?: string, motivo?: string}>}
   *   postergado en true si movió el vencimiento; si no, el motivo.
   */
  async postergarVencimiento(pedidoId, { hasta, motivo }) {
    const resultado = await this.repositorio.transaccion(async (tx) => {
      const pedido = await tx.bloquearPedido(pedidoId);
      if (!pedido) {
        return { postergado: false, motivo: "NO_EXISTE" };
      }
      if (!estaVencido(pedido, this.ahora())) {
        return { postergado: false, numero: pedido.numero, motivo: "YA_NO_CORRESPONDE" };
      }

      await tx.guardarDatosPago(pedido.id, { expiraEn: hasta });
      await tx.registrarEvento({
        pedidoId: pedido.id,
        campo: "pago",
        estadoAnterior: pedido.estadoPago,
        estadoNuevo: pedido.estadoPago,
        origen: "job",
        detalle: `Vencimiento postergado hasta ${hasta.toISOString()}: ${motivo}`,
      });

      return { postergado: true, numero: pedido.numero };
    });

    return resultado;
  }

  /**
   * @description Deja un pedido para que la dueña lo revise a mano.
   *
   * Si el pedido todavía vence, deja de vencer: el stock queda apartado hasta que
   * alguien decida, en lugar de liberarse solo. Si ya no vence (por ejemplo, se
   * aprobó y hubo un cobro duplicado), solo anota el motivo en la bitácora.
   *
   * @param {number} pedidoId - Id del pedido.
   * @param {Object} opciones - Datos de la revisión.
   * @param {string} opciones.motivo - Qué hay que revisar, para la bitácora.
   * @returns {Promise<{marcado: boolean, numero?: string, motivo?: string}>}
   *   marcado en true si lo anotó; si no, el motivo.
   */
  async marcarRevision(pedidoId, { motivo }) {
    const resultado = await this.repositorio.transaccion(async (tx) => {
      const pedido = await tx.bloquearPedido(pedidoId);
      if (!pedido) {
        return { marcado: false, motivo: "NO_EXISTE" };
      }

      if (pedido.expiraEn && ESTADOS_PAGO_VENCIBLES.includes(pedido.estadoPago)) {
        await tx.guardarDatosPago(pedido.id, { expiraEn: null });
      }
      await tx.registrarEvento({
        pedidoId: pedido.id,
        campo: "pago",
        estadoAnterior: pedido.estadoPago,
        estadoNuevo: pedido.estadoPago,
        origen: "job",
        detalle: `Requiere revisión: ${motivo}`,
      });

      return { marcado: true, numero: pedido.numero };
    });

    return resultado;
  }

  /**
 * @description Avanza la preparación de un pedido desde el panel.
 *
 * Reglas de docs/maquina-estados.md: solo se avanza con el pago aprobado, y a
 * "enviado" hace falta el código de seguimiento si el método es envío. Repetir el
 * estado actual (un doble clic) no hace nada y no es un error.
 *
 * @param {number} pedidoId - Id del pedido.
 * @param {Object} cambio - Datos del cambio.
 * @param {string} cambio.hacia - en_preparacion, enviado o entregado.
 * @param {string|null} [cambio.seguimiento] - Código del correo, ya validado.
 * @param {number} cambio.usuarioId - Quién lo hace, para la bitácora.
 * @returns {Promise<{cambiado: boolean, numero: string, motivo?: string}>} Si el estado cambió y el número del pedido; motivo YA_REGISTRADO si ya estaba en ese estado.
 * @throws {Error} NO_ENCONTRADO, TRANSICION_INVALIDA, PAGO_NO_APROBADO, SEGUIMIENTO_REQUERIDO
 */
  async cambiarEstadoPreparacion(pedidoId, { hacia, seguimiento = null, usuarioId }) {
    if (!AVANCES_PREPARACION.includes(hacia)) {
      throw new Error("TRANSICION_INVALIDA");
    }

    const resultado = await this.repositorio.transaccion(async (tx) => {
      const pedido = await tx.bloquearPedido(pedidoId);
      if (!pedido) {
        throw new Error("NO_ENCONTRADO");
      }
      const { numero } = pedido;

      if (pedido.estadoPedido === hacia) {
        return { cambiado: false, numero, motivo: "YA_REGISTRADO" };
      }
      validarTransicion("preparacion", pedido.estadoPedido, hacia);
      if (pedido.estadoPago !== "aprobado") {
        throw new Error("PAGO_NO_APROBADO");
      }

      const conSeguimiento = hacia === "enviado" && pedido.metodoEntrega === "envio";
      if (conSeguimiento && !seguimiento) {
        throw new Error("SEGUIMIENTO_REQUERIDO");
      }

      await tx.actualizarEstados(pedido.id, { estadoPedido: hacia });
      if (conSeguimiento) {
        await tx.guardarSeguimiento(pedido.id, seguimiento);
      }

      await tx.registrarEvento({
        pedidoId: pedido.id,
        campo: "preparacion",
        estadoAnterior: pedido.estadoPedido,
        estadoNuevo: hacia,
        origen: "panel",
        usuarioId,
        detalle: conSeguimiento ? `Seguimiento ${seguimiento}` : null,
      });

      if (hacia === "enviado") {
        await tx.encolarEmail({
          pedidoId: pedido.id,
          tipo: "pedido_enviado",
          destinatario: pedido.clienteEmail,
          datos: {
            numero,
            nombre: pedido.clienteNombre,
            metodoEntrega: pedido.metodoEntrega,
            seguimiento: conSeguimiento ? seguimiento : null,
          },
        });
      }

      return { cambiado: true, numero };
    });

    return resultado;
  }

  /**
   * @description Cancela a mano un pedido sin pagar y devuelve su stock.
   *
   * Solo pedidos con el pago pendiente o rechazado: uno aprobado se devuelve con su
   * dinero (t13c). Si la clienta avisó que transfirió, hace falta confirmar que el
   * dinero no llegó: el aviso no prueba que haya llegado, pero tampoco que no.
   * Cancelar dos veces no repone dos veces: la segunda encuentra el pedido cancelado.
   *
   * @param {number} pedidoId - Id del pedido.
   * @param {Object} cancelacion - Datos de la cancelación.
   * @param {string} cancelacion.motivo - Por qué, para la bitácora. Obligatorio.
   * @param {boolean} [cancelacion.confirmaSinPago] - Verificó que la transferencia avisada no llegó.
   * @param {number} cancelacion.usuarioId - Quién cancela, para la bitácora.
   * @returns {Promise<{cancelado: boolean, numero: string, motivo?: string}>} Si se canceló y el número del pedido; motivo YA_CANCELADO si ya estaba cancelado.
   * @throws {Error} DATOS_INVALIDOS, NO_ENCONTRADO, PEDIDO_PAGADO, COMPROBANTE_INFORMADO, TRANSICION_INVALIDA
   */
  async cancelarManual(pedidoId, { motivo, confirmaSinPago = false, usuarioId }) {
    const motivoLimpio = String(motivo ?? "").trim();
    if (motivoLimpio.length === 0) {
      throw new Error("DATOS_INVALIDOS");
    }

    const resultado = await this.repositorio.transaccion(async (tx) => {
      const pedido = await tx.bloquearPedido(pedidoId);
      if (!pedido) {
        throw new Error("NO_ENCONTRADO");
      }
      const { numero } = pedido;

      if (pedido.estadoPago === "cancelado" && pedido.estadoPedido === "cancelado") {
        return { cancelado: false, numero, motivo: "YA_CANCELADO" };
      }
      if (pedido.estadoPago === "aprobado") {
        throw new Error("PEDIDO_PAGADO");
      }
      if (!PAGOS_CANCELABLES.includes(pedido.estadoPago)) {
        throw new Error("TRANSICION_INVALIDA");
      }
      if (pedido.estadoPedido !== "nuevo") {
        throw new Error("TRANSICION_INVALIDA");
      }
      if (pedido.comprobanteInformadoEn && !confirmaSinPago) {
        throw new Error("COMPROBANTE_INFORMADO");
      }

      validarTransicion("pago", pedido.estadoPago, "cancelado");
      validarTransicion("preparacion", pedido.estadoPedido, "cancelado");

      await reponerStockDelPedido(tx, pedido.id);
      await tx.actualizarEstados(pedido.id, {
        estadoPago: "cancelado",
        estadoPedido: "cancelado",
      });

      const confirmacion = pedido.comprobanteInformadoEn
        ? " Comprobante informado: se confirmó que el dinero no llegó."
        : "";
      await tx.registrarEvento({
        pedidoId: pedido.id,
        campo: "pago",
        estadoAnterior: pedido.estadoPago,
        estadoNuevo: "cancelado",
        origen: "panel",
        usuarioId,
        detalle: `Cancelado a mano, stock devuelto. Motivo: ${motivoLimpio}.${confirmacion}`,
      });
      await tx.registrarEvento({
        pedidoId: pedido.id,
        campo: "preparacion",
        estadoAnterior: pedido.estadoPedido,
        estadoNuevo: "cancelado",
        origen: "panel",
        usuarioId,
      });

      await tx.encolarEmail({
        pedidoId: pedido.id,
        tipo: "pedido_cancelado",
        destinatario: pedido.clienteEmail,
        datos: {
          numero,
          nombre: pedido.clienteNombre,
          medioPago: pedido.medioPago,
          motivo: "tienda",
        },
      });

      return { cancelado: true, numero };
    });

    return resultado;
  }
}

module.exports = { PedidoEstadoService, estaVencido };
