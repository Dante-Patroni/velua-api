const { MercadoPagoProcesador } = require("./MercadoPagoProcesador");

/**
 * Procesador de pagos de la API: una sola instancia para todas las rutas y el job.
 *
 * La cotización decide si ofrece Mercado Pago con `configurado`, y la creación
 * del pedido lo rechaza con el mismo dato. Si cada una armara su propio
 * procesador, hoy coincidirían por casualidad (leen la misma variable de
 * entorno), pero el día que el criterio cambie en uno solo, la tienda ofrecería
 * un medio que después rechaza. Con un solo objeto, coinciden siempre.
 */
const procesadorPagos = new MercadoPagoProcesador();

module.exports = { procesadorPagos };
