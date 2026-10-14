const { MercadoPagoConfig, Preference, Payment } = require("mercadopago");

const ProcesadorPagos = require("./ProcesadorPagos");

/** Si Mercado Pago no responde en este tiempo, se corta: la clienta no espera eterno. */
const TIMEOUT_MS = 8000;

/** Pagos por página al buscar por referencia (el máximo habitual de Mercado Pago). */
const LIMITE_BUSQUEDA = 30;

/**
 * Tope de páginas. Un pedido real tiene uno o dos pagos: si se llega acá, algo
 * anda mal y es mejor fallar que devolver una lista incompleta en silencio.
 */
const MAX_PAGINAS_BUSQUEDA = 10;

/**
 * @description Arma el cuerpo de la preferencia. Es una función pura para poder
 * probarla sin llamar a Mercado Pago.
 *
 * Se manda un único ítem con el total del pedido, y no los ítems sueltos: los
 * descuentos, el ajuste por medio de pago y el envío ya están calculados, y
 * repartirlos por línea podría dar una diferencia de centavos con el total real.
 *
 * @param {Object} pedido - Datos del pedido.
 * @param {string} pedido.numero - Número del pedido.
 * @param {string} pedido.total - Total como cadena decimal.
 * @param {string} pedido.email - Mail de la clienta.
 * @param {Date} pedido.expiraEn - Vencimiento de la reserva.
 * @param {Object} urls - URLs públicas.
 * @param {string} urls.urlWeb - URL de la tienda.
 * @param {string} urls.urlApi - URL de la API.
 * @returns {Object} Cuerpo para Preference.create.
 */
const armarPreferencia = ({ numero, total, email, expiraEn }, { urlWeb, urlApi }) => {
  const vuelta = `${urlWeb}/pedido/${numero}`;
  // Mercado Pago pide la zona horaria explícita
  const vence = expiraEn.toISOString().replace("Z", "+00:00");
  const cuerpo = {
    items: [
      {
        id: numero,
        title: `Pedido ${numero} · Velua`,
        quantity: 1,
        unit_price: Number(total),
        currency_id: "ARS",
      },
    ],
    payer: { email },
    external_reference: numero,
    back_urls: { success: vuelta, failure: vuelta, pending: vuelta },
    statement_descriptor: "VELUA",
    expires: true,
    // El checkout deja de aceptar pagos cuando vence la reserva
    expiration_date_to: vence,
    // Los cupones en efectivo también vencen con la reserva: si no, se podrían
    // pagar días después, con el pedido cancelado y el stock liberado
    date_of_expiration: vence,
    // Medios lentos (Rapipago, Pago Fácil, cajeros) excluidos hasta que la marca
    // decida si acepta efectivo. Ver DECISIONES.md
    payment_methods: {
      excluded_payment_types: [{ id: "ticket" }, { id: "atm" }],
    },
  };

  // Mercado Pago rechaza auto_return y el webhook si las URLs no son públicas y
  // https. En local se omiten: la vuelta funciona igual con el botón "Volver".
  if (vuelta.startsWith("https://")) {
    cuerpo.auto_return = "approved";
  }
  if (urlApi?.startsWith("https://")) {
    cuerpo.notification_url = `${urlApi}/api/v1/webhooks/mercadopago`;
  }

  return cuerpo;
};

/**
 * @description Traduce un pago de Mercado Pago al formato del contrato.
 * @param {Object} p - Pago tal como lo devuelve el SDK.
 * @returns {Object} Pago normalizado, con el monto como cadena decimal.
 */
const normalizarPago = (p) => ({
  id: String(p.id),
  estado: p.status,
  detalle: p.status_detail ?? null,
  referencia: p.external_reference ?? null,
  monto: Number(p.transaction_amount).toFixed(2),
  moneda: p.currency_id,
  metodo: p.payment_method_id ?? null,
});

/**
 * @description Implementación de ProcesadorPagos con Checkout Pro de Mercado Pago.
 */
class MercadoPagoProcesador extends ProcesadorPagos {
  /**
   * @description Instancia el procesador. Sin access token no falla al arrancar,
   * para no tirar abajo la API en entornos sin Mercado Pago: falla al usarlo.
   * @param {Object} [opciones] - Configuración.
   * @param {string} [opciones.accessToken] - Por defecto, MP_ACCESS_TOKEN.
   * @param {string} [opciones.urlWeb] - Por defecto, URL_WEB.
   * @param {string} [opciones.urlApi] - Por defecto, URL_API.
   * @param {Object} [opciones.clientes] - { preferencias, pagos } simulados, para tests.
   */
  constructor({
    accessToken = process.env.MP_ACCESS_TOKEN,
    urlWeb = process.env.URL_WEB,
    urlApi = process.env.URL_API,
    clientes = null,
  } = {}) {
    super();
    this.urls = { urlWeb, urlApi };
    this.configurado = Boolean(accessToken) || Boolean(clientes);

    if (clientes) {
      this.preferencias = clientes.preferencias;
      this.pagos = clientes.pagos;
    } else if (accessToken) {
      const config = new MercadoPagoConfig({ accessToken, options: { timeout: TIMEOUT_MS } });
      this.preferencias = new Preference(config);
      this.pagos = new Payment(config);
    }
  }

  /**
   * @description Crea la preferencia de Checkout Pro.
   * @param {Object} pedido - numero, total, email, expiraEn.
   * @returns {Promise<{preferenciaId: string, urlPago: string}>} Id y URL de pago.
   * @throws {Error} PROCESADOR_NO_CONFIGURADO, PROCESADOR_NO_DISPONIBLE
   */
  async crearPreferencia(pedido) {
    const r = await this.#llamar(() =>
      this.preferencias.create({ body: armarPreferencia(pedido, this.urls) })
    );
    return { preferenciaId: r.id, urlPago: r.init_point };
  }

  /**
   * @description Lee una preferencia ya creada, para reusar su link en vez de
   * crear otra. Una sola preferencia por pedido es lo que evita que haya dos
   * checkouts pagables a la vez.
   *
   * Un 404 se distingue de Mercado Pago caído: dice que la preferencia no existe,
   * y quien llama puede crear una nueva. Una caída, en cambio, no da link.
   *
   * @param {string} preferenciaId - Id de la preferencia.
   * @returns {Promise<{urlPago: string, venceEn: Date|null}>} Link y vencimiento.
   * @throws {Error} PROCESADOR_NO_CONFIGURADO, PREFERENCIA_NO_ENCONTRADA,
   *   PROCESADOR_NO_DISPONIBLE
   */
  async obtenerPreferencia(preferenciaId) {
    let r;
    try {
      r = await this.#llamar(() => this.preferencias.get({ preferenceId: preferenciaId }));
    } catch (error) {
      if (error.cause?.status === 404) {
        const e = new Error("PREFERENCIA_NO_ENCONTRADA");
        e.cause = error.cause;
        throw e;
      }
      throw error;
    }
    return {
      urlPago: r.init_point,
      venceEn: r.expiration_date_to ? new Date(r.expiration_date_to) : null,
    };
  }

  /**
   * @description Consulta un pago por su id.
   *
   * Un 404 no es lo mismo que Mercado Pago caído: dice que ese pago no existe en
   * la cuenta de estas credenciales. Se distingue para el log y para quien decida
   * si reintentar; no implica que el pago esté rechazado.
   *
   * @param {string} pagoId - Id del pago en Mercado Pago.
   * @returns {Promise<Object>} Pago normalizado.
   * @throws {Error} PROCESADOR_NO_CONFIGURADO, PAGO_NO_ENCONTRADO, PROCESADOR_NO_DISPONIBLE
   */
  async obtenerPago(pagoId) {
    let p;
    try {
      p = await this.#llamar(() => this.pagos.get({ id: pagoId }));
    } catch (error) {
      if (error.cause?.status === 404) {
        const noEncontrado = new Error("PAGO_NO_ENCONTRADO");
        noEncontrado.cause = error.cause;
        throw noEncontrado;
      }
      throw error;
    }
    return normalizarPago(p);
  }

  /**
   * @description Busca todos los pagos de un pedido por su referencia, recorriendo
   * todas las páginas, del más nuevo al más viejo.
   *
   * Sin pagos devuelve [] (no es un error). Solo ve los pagos de la cuenta de
   * estas credenciales.
   *
   * @param {string} referencia - Número de pedido (external_reference).
   * @returns {Promise<Object[]>} Pagos normalizados.
   * @throws {Error} PROCESADOR_NO_CONFIGURADO, PROCESADOR_NO_DISPONIBLE, BUSQUEDA_INCOMPLETA
   */
  async buscarPagosPorReferencia(referencia) {
    const pagos = [];
    let offset = 0;
    let pagina = 0;
    let total;
    do {
      if (pagina === MAX_PAGINAS_BUSQUEDA) {
        throw new Error("BUSQUEDA_INCOMPLETA");
      }
      const r = await this.#llamar(() =>
        this.pagos.search({
          options: {
            external_reference: referencia,
            sort: "date_created",
            criteria: "desc",
            limit: LIMITE_BUSQUEDA,
            offset,
          },
        })
      );
      pagos.push(...(r.results ?? []));
      total = r.paging?.total ?? 0;
      offset += LIMITE_BUSQUEDA;
      pagina += 1;
    } while (offset < total);
    return pagos.map(normalizarPago);
  }

  /**
   * @description Ejecuta una llamada al SDK y traduce cualquier falla a un código
   * de dominio. El error original queda en `cause` para el log.
   * @param {() => Promise<Object>} llamada - Llamada al SDK.
   * @returns {Promise<Object>} Respuesta del SDK.
   */
  async #llamar(llamada) {
    if (!this.configurado) {
      throw new Error("PROCESADOR_NO_CONFIGURADO");
    }
    try {
      return await llamada();
    } catch (causa) {
      const error = new Error("PROCESADOR_NO_DISPONIBLE");
      error.cause = causa;
      throw error;
    }
  }
}

module.exports = { MercadoPagoProcesador, armarPreferencia, normalizarPago };
