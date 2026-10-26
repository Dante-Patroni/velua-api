/** Pedidos por página si no se pide otra cantidad. */
const LIMITE_POR_DEFECTO = 20;

/**
 * @description Fila de la lista del panel: solo lo necesario para ubicar un
 * pedido. Los datos de contacto y la dirección van solo en el detalle.
 * @param {Object} p - Pedido del repositorio.
 * @returns {Object} Fila para la lista.
 */
const aFilaPanel = (p) => ({
  id: p.id,
  numero: p.numero,
  creadoEn: p.creadoEn,
  clienteNombre: p.clienteNombre,
  total: p.total,
  medioPago: p.medioPago,
  estadoPago: p.estadoPago,
  estadoPedido: p.estadoPedido,
  metodoEntrega: p.metodoEntrega,
  expiraEn: p.expiraEn,
});

/**
 * @description Dirección de entrega, o null si el pedido es para retirar.
 * @param {Object} p - Pedido del repositorio.
 * @returns {Object|null} La dirección.
 */
const direccionDe = (p) =>
  p.metodoEntrega === "envio"
    ? {
        calle: p.direccionCalle,
        numero: p.direccionNumero,
        extra: p.direccionExtra,
        ciudad: p.direccionCiudad,
        provincia: p.direccionProvincia,
        cp: p.direccionCp,
      }
    : null;

/**
 * @description Detalle del pedido para el panel: contacto, entrega, totales con
 * sus descuentos, pago, ítems e historial. No incluye el id de preferencia de
 * Mercado Pago: es un dato interno que el panel no necesita.
 * @param {Object} p - Pedido del repositorio, con items y eventos.
 * @returns {Object} Detalle para el panel.
 */
const aDetallePanel = (p) => ({
  ...aFilaPanel(p),
  cliente: {
    nombre: p.clienteNombre,
    email: p.clienteEmail,
    telefono: p.clienteTelefono,
    documento: p.clienteDocumento,
  },
  entrega: {
    metodo: p.metodoEntrega,
    zona: p.zonaEnvio?.nombre ?? null,
    direccion: direccionDe(p),
    seguimiento: p.seguimiento,
  },
  totales: {
    subtotal: p.subtotal,
    descuentoCupon: p.descuentoCupon,
    ajusteMedioPago: p.ajustePago,
    costoEnvio: p.costoEnvio,
    total: p.total,
  },
  pago: {
    pagoId: p.mpPaymentId,
    metodo: p.mpMetodo,
    comprobanteInformadoEn: p.comprobanteInformadoEn,
  },
  notasCliente: p.notasCliente,
  notasInternas: p.notasInternas,
  items: (p.items ?? []).map((i) => ({
    producto: i.nombreProducto,
    variante: i.nombreVariante,
    sku: i.sku,
    precioUnitario: i.precioUnitario,
    cantidad: i.cantidad,
    subtotal: i.subtotal,
  })),
  eventos: (p.eventos ?? []).map((e) => ({
    campo: e.campo,
    estadoAnterior: e.estadoAnterior,
    estadoNuevo: e.estadoNuevo,
    origen: e.origen,
    usuarioId: e.usuarioId,
    detalle: e.detalle,
    creadoEn: e.creadoEn,
  })),
});

/**
 * @description Consulta de pedidos para el panel. Solo lectura: los cambios de
 * estado pasan por PedidoEstadoService.
 */
class PedidoAdminService {
  /**
   * @description Instancia el servicio.
   * @param {Object} pedidoRepository - Con listarParaPanel y buscarParaPanel.
   */
  constructor(pedidoRepository) {
    this.repositorio = pedidoRepository;
  }

  /**
   * @description Lista los pedidos, del más nuevo al más viejo.
   * @param {Object} [filtros] - Filtros opcionales.
   * @param {string|null} [filtros.estadoPago] - Estado de pago.
   * @param {string|null} [filtros.estadoPedido] - Estado de preparación.
   * @param {number} [filtros.pagina] - Página, desde 1.
   * @param {number} [filtros.limite] - Pedidos por página.
   * @returns {Promise<{datos: Object[], meta: {pagina: number, limite: number, total: number}}>}
   *   Una página de pedidos.
   */
  async listar({
    estadoPago = null,
    estadoPedido = null,
    pagina = 1,
    limite = LIMITE_POR_DEFECTO,
  } = {}) {
    const { filas, total } = await this.repositorio.listarParaPanel({
      estadoPago,
      estadoPedido,
      pagina,
      limite,
    });
    return { datos: filas.map(aFilaPanel), meta: { pagina, limite, total } };
  }

  /**
   * @description Devuelve el detalle de un pedido.
   * @param {number} id - Id del pedido.
   * @returns {Promise<Object>} El detalle.
   * @throws {Error} NO_ENCONTRADO
   */
  async detalle(id) {
    const pedido = await this.repositorio.buscarParaPanel(id);
    if (!pedido) {
      throw new Error("NO_ENCONTRADO");
    }
    return aDetallePanel(pedido);
  }
}

module.exports = { PedidoAdminService, LIMITE_POR_DEFECTO };
