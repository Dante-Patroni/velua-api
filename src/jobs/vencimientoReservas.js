const SequelizePedidoRepository = require("../repositories/sequelize/SequelizePedidoRepository");
const { PedidoEstadoService } = require("../services/PedidoEstadoService");
const { PagoWebhookService } = require("../services/PagoWebhookService");
const { decidirVencimientoMP } = require("../services/decidirVencimientoMP");
const { MercadoPagoProcesador } = require("../pagos/MercadoPagoProcesador");

/** Cada cuánto corre el job: cinco minutos. */
const INTERVALO_MS = 5 * 60 * 1000;

/**
 * Máximo de pedidos por vuelta. Si alguna vez hubiera más vencidos, los que quedan
 * se cancelan en la vuelta siguiente: así una vuelta nunca se hace eterna.
 */
const LIMITE_POR_VUELTA = 50;

/**
 * Margen después del vencimiento antes de consultar a Mercado Pago. Un pago hecho
 * en los últimos segundos puede tardar en aparecer en la búsqueda.
 */
const GRACIA_MP_MS = 15 * 60 * 1000;

/** Cuánto se espera a un pago en curso, desde que se creó el pedido. */
const TOPE_PAGO_EN_CURSO_HORAS = 48;

/**
 * @description Job que resuelve los pedidos cuya reserva venció sin pago.
 *
 * Transferencia: se cancela y se devuelve el stock. Mercado Pago: antes de cancelar
 * se le pregunta a Mercado Pago si el pedido tiene pagos, porque el aviso del
 * webhook puede no haber llegado; se aprueba, se posterga, se manda a revisión o se
 * cancela según decidirVencimientoMP. Ante la duda, nunca cancela.
 *
 * Cada pedido se resuelve en su propia transacción: si uno falla, los demás siguen,
 * y el que falló se reintenta en la vuelta siguiente.
 */
class VencimientoReservas {
  /**
   * @description Instancia el job.
   * @param {Object} deps - Dependencias.
   * @param {Object} deps.pedidoRepository - Repositorio con listarVencidos.
   * @param {Object} deps.pedidoEstadoService - Servicio con cancelarVencido,
   *   postergarVencimiento y marcarRevision.
   * @param {Object} [deps.procesadorPagos] - Con buscarPagosPorReferencia. Sin él,
   *   los pedidos de Mercado Pago se cancelan como los de transferencia.
   * @param {Object} [deps.pagoService] - Con aplicarPago. Requerido si hay procesador.
   * @param {Object} [deps.logger] - Con info y error. Por defecto, la consola.
   * @param {() => Date} [deps.ahora] - Reloj.
   * @param {number} [deps.limite] - Máximo de pedidos por vuelta.
   * @param {number} [deps.graciaMs] - Margen antes de consultar a Mercado Pago.
   * @param {number} [deps.topeHoras] - Espera máxima a un pago en curso.
   */
  constructor({
    pedidoRepository,
    pedidoEstadoService,
    procesadorPagos = null,
    pagoService = null,
    logger = console,
    ahora = () => new Date(),
    limite = LIMITE_POR_VUELTA,
    graciaMs = GRACIA_MP_MS,
    topeHoras = TOPE_PAGO_EN_CURSO_HORAS,
  }) {
    this.repositorio = pedidoRepository;
    this.servicio = pedidoEstadoService;
    this.procesador = procesadorPagos;
    this.pagos = pagoService;
    this.logger = logger;
    this.ahora = ahora;
    this.limite = limite;
    this.graciaMs = graciaMs;
    this.topeHoras = topeHoras;
    this.corriendo = false;
    this.timer = null;
  }

  /**
   * @description Ejecuta una vuelta completa. Nunca lanza: los errores se anotan
   * en el log y en el resumen, para que un problema no tire abajo el servidor.
   *
   * Si la vuelta anterior todavía no terminó, esta no hace nada. En Railway corre
   * una sola instancia de la API, así que alcanza con una bandera en memoria; la
   * protección de fondo contra dos procesos es el candado de cada transacción.
   *
   * @returns {Promise<{salteada?: boolean, revisados: number, cancelados: number,
   *   descartados: number, errores: number}>} Resumen de la vuelta. descartados
   *   cuenta todo lo que no se canceló: ya no correspondía, se aprobó, se postergó,
   *   quedó en revisión o está en el margen de gracia.
   */
  async ejecutarVuelta() {
    const resumen = { revisados: 0, cancelados: 0, descartados: 0, errores: 0 };

    if (this.corriendo) {
      return { salteada: true, ...resumen };
    }
    this.corriendo = true;

    try {
      const pedidos = await this.repositorio.listarVencidos(this.ahora(), this.limite);

      for (const pedido of pedidos) {
        resumen.revisados++;
        try {
          if (pedido.medioPago === "mercadopago" && this.procesador) {
            await this.#reconciliarMercadoPago(pedido, resumen);
          } else {
            await this.#cancelar(pedido, resumen);
          }
        } catch (error) {
          resumen.errores++;
          this.logger.error(`[vencimientos] pedido ${pedido.id}: ${error.message}`);
        }
      }
    } catch (error) {
      resumen.errores++;
      this.logger.error(`[vencimientos] no se pudo listar: ${error.message}`);
    } finally {
      this.corriendo = false;
    }

    return resumen;
  }

  /**
   * @description Cancela un pedido vencido y devuelve su stock.
   * @param {{id: number}} pedido - Pedido vencido.
   * @param {Object} resumen - Resumen de la vuelta, que se actualiza.
   * @returns {Promise<void>}
   */
  async #cancelar(pedido, resumen) {
    const r = await this.servicio.cancelarVencido(pedido.id);
    if (r.cancelado) {
      resumen.cancelados++;
      this.logger.info(`[vencimientos] ${r.numero} cancelado, stock devuelto`);
    } else {
      // Se pagó o se informó el comprobante entre la búsqueda y el candado
      resumen.descartados++;
    }
  }

  /**
   * @description Resuelve un pedido de Mercado Pago vencido según lo que Mercado
   * Pago tiene para su referencia. La consulta va fuera de toda transacción: nunca
   * se bloquea la base esperando a un servicio externo.
   * @param {{id: number, numero: string, total: string, creadoEn: Date,
   *   expiraEn: Date}} pedido - Pedido vencido.
   * @param {Object} resumen - Resumen de la vuelta, que se actualiza.
   * @returns {Promise<void>}
   */
  async #reconciliarMercadoPago(pedido, resumen) {
    const ahora = this.ahora();
    if (ahora.getTime() < new Date(pedido.expiraEn).getTime() + this.graciaMs) {
      resumen.descartados++;
      this.logger.info(
        `[vencimientos] ${pedido.numero}: en el margen de gracia, se revisa en la próxima vuelta`
      );
      return;
    }

    let pagos;
    try {
      pagos = await this.procesador.buscarPagosPorReferencia(pedido.numero);
    } catch (error) {
      resumen.errores++;
      this.logger.error(
        `[vencimientos] ${pedido.numero}: no se pudo consultar Mercado Pago (${error.message}); no se cancela`
      );
      return;
    }

    const d = decidirVencimientoMP({ pagos, pedido, ahora, topeHoras: this.topeHoras });
    const ids = d.pagosAprobados ? ` (pagos ${d.pagosAprobados.join(", ")})` : "";

    if (d.accion === "aprobar") {
      const r = await this.pagos.aplicarPago(d.pago, { origen: "job" });
      if (d.motivo === "PAGO_DUPLICADO") {
        await this.servicio.marcarRevision(pedido.id, { motivo: `${d.motivo}${ids}` });
        this.logger.error(`[vencimientos] ${pedido.numero}: posible cobro duplicado${ids}`);
      }
      resumen.descartados++;
      this.logger.info(
        `[vencimientos] ${pedido.numero}: pago ${d.pago.id} aprobado por reconciliación (${r.procesado ? "aplicado" : r.motivo})`
      );
      return;
    }

    if (d.accion === "postergar") {
      await this.servicio.postergarVencimiento(pedido.id, { hasta: d.hasta, motivo: d.motivo });
      resumen.descartados++;
      this.logger.info(
        `[vencimientos] ${pedido.numero}: pago en curso, se posterga hasta ${d.hasta.toISOString()}`
      );
      return;
    }

    if (d.accion === "revisar") {
      await this.servicio.marcarRevision(pedido.id, { motivo: `${d.motivo}${ids}` });
      resumen.descartados++;
      this.logger.error(`[vencimientos] ${pedido.numero}: requiere revisión, ${d.motivo}${ids}`);
      return;
    }

    await this.#cancelar(pedido, resumen);
  }

  /**
   * @description Arranca el job: una vuelta enseguida, para no esperar cinco
   * minutos después de un deploy, y después una cada intervalo.
   * @param {number} [intervalo] - Milisegundos entre vueltas.
   * @returns {void}
   */
  iniciar(intervalo = INTERVALO_MS) {
    if (this.timer) {
      return;
    }
    this.ejecutarVuelta();
    this.timer = setInterval(() => this.ejecutarVuelta(), intervalo);
    // No mantiene vivo el proceso: si el servidor se apaga, el job se apaga con él
    this.timer.unref();
  }

  /**
   * @description Detiene el job.
   * @returns {void}
   */
  detener() {
    clearInterval(this.timer);
    this.timer = null;
  }
}

/**
 * @description Arma el job con las dependencias reales.
 * @param {Object} db - Modelos y conexión de Sequelize.
 * @returns {VencimientoReservas} Job listo para iniciar.
 */
const crearVencimientoReservas = (db) => {
  const pedidoRepository = new SequelizePedidoRepository(db);
  const pedidoEstadoService = new PedidoEstadoService(pedidoRepository);
  const procesadorPagos = new MercadoPagoProcesador();
  return new VencimientoReservas({
    pedidoRepository,
    pedidoEstadoService,
    procesadorPagos,
    pagoService: new PagoWebhookService({
      procesadorPagos,
      pedidoRepository,
      pedidoEstadoService,
    }),
  });
};

module.exports = {
  VencimientoReservas,
  crearVencimientoReservas,
  INTERVALO_MS,
  LIMITE_POR_VUELTA,
  GRACIA_MP_MS,
  TOPE_PAGO_EN_CURSO_HORAS,
};
