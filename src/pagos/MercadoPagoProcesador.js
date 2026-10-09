const { MercadoPagoConfig, Preference, Payment } = require("mercadopago");

const ProcesadorPagos = require("./ProcesadorPagos");

/** Si Mercado Pago no responde en este tiempo, se corta: la clienta no espera eterno. */
const TIMEOUT_MS = 8000;

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
    // Mercado Pago pide la zona horaria explícita
    expiration_date_to: expiraEn.toISOString().replace("Z", "+00:00"),
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
   * @description Consulta un pago por su id.
   * @param {string} pagoId - Id del pago en Mercado Pago.
   * @returns {Promise<Object>} Pago normalizado.
   * @throws {Error} PROCESADOR_NO_CONFIGURADO, PROCESADOR_NO_DISPONIBLE
   */
  async obtenerPago(pagoId) {
    const p = await this.#llamar(() => this.pagos.get({ id: pagoId }));
    return normalizarPago(p);
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
