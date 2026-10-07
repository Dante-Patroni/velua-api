const SequelizePedidoRepository = require("../repositories/sequelize/SequelizePedidoRepository");
const { PedidoEstadoService } = require("../services/PedidoEstadoService");

/** Cada cuánto corre el job: cinco minutos. */
const INTERVALO_MS = 5 * 60 * 1000;

/**
 * Máximo de pedidos por vuelta. Si alguna vez hubiera más vencidos, los que quedan
 * se cancelan en la vuelta siguiente: así una vuelta nunca se hace eterna.
 */
const LIMITE_POR_VUELTA = 50;

/**
 * @description Job que cancela los pedidos cuya reserva venció sin pago.
 *
 * Cada vuelta pide la lista de candidatos y cancela uno por uno, cada uno en su
 * propia transacción: si uno falla, los demás siguen, y el que falló se reintenta
 * en la vuelta siguiente.
 */
class VencimientoReservas {
  /**
   * @description Instancia el job.
   * @param {Object} deps - Dependencias.
   * @param {Object} deps.pedidoRepository - Repositorio con listarVencidos.
   * @param {Object} deps.pedidoEstadoService - Servicio con cancelarVencido.
   * @param {Object} [deps.logger] - Con info y error. Por defecto, la consola.
   * @param {() => Date} [deps.ahora] - Reloj.
   * @param {number} [deps.limite] - Máximo de pedidos por vuelta.
   */
  constructor({
    pedidoRepository,
    pedidoEstadoService,
    logger = console,
    ahora = () => new Date(),
    limite = LIMITE_POR_VUELTA,
  }) {
    this.repositorio = pedidoRepository;
    this.servicio = pedidoEstadoService;
    this.logger = logger;
    this.ahora = ahora;
    this.limite = limite;
    this.corriendo = false;
    this.timer = null;
  }

  /**
   * @description Ejecuta una vuelta completa. Nunca lanza: los errores se anotan
   * en el log y en el resumen, para que un problema no tire abajo el servidor.
   *
   * Si la vuelta anterior todavía no terminó, esta no hace nada. En Railway corre
   * una sola instancia de la API, así que alcanza con una bandera en memoria.
   *
   * @returns {Promise<{salteada?: boolean, revisados: number, cancelados: number,
   *   descartados: number, errores: number}>} Resumen de la vuelta.
   */
  async ejecutarVuelta() {
    const resumen = { revisados: 0, cancelados: 0, descartados: 0, errores: 0 };

    if (this.corriendo) {
      return { salteada: true, ...resumen };
    }
    this.corriendo = true;

    try {
      const ids = await this.repositorio.listarVencidos(this.ahora(), this.limite);

      for (const id of ids) {
        resumen.revisados++;
        try {
          const r = await this.servicio.cancelarVencido(id);
          if (r.cancelado) {
            resumen.cancelados++;
            this.logger.info(`[vencimientos] ${r.numero} cancelado, stock devuelto`);
          } else {
            // Se pagó o se informó el comprobante entre la búsqueda y el candado
            resumen.descartados++;
          }
        } catch (error) {
          resumen.errores++;
          this.logger.error(`[vencimientos] pedido ${id}: ${error.message}`);
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
  return new VencimientoReservas({
    pedidoRepository,
    pedidoEstadoService: new PedidoEstadoService(pedidoRepository),
  });
};

module.exports = {
  VencimientoReservas,
  crearVencimientoReservas,
  INTERVALO_MS,
  LIMITE_POR_VUELTA,
};
