/**
 * @description Interfaz del repositorio de pedidos.
 *
 * Tiene dos caras. Afuera de una transacción, solo consulta. Adentro, el método
 * `transaccion` le pasa al trabajo un repositorio atado a esa transacción, con todo
 * lo que hace falta para crear un pedido: si cualquier paso falla, no queda nada.
 *
 * Así el servicio decide qué va junto sin saber qué es una transacción de Sequelize.
 */
class PedidoRepository {
  /**
   * @description Ejecuta un trabajo dentro de una transacción. Si el trabajo lanza
   * un error, se deshace todo lo que hizo.
   * @param {(tx: Object) => Promise<*>} _trabajo - Recibe un repositorio transaccional.
   * @returns {Promise<*>} Lo que devuelva el trabajo.
   */
  async transaccion(_trabajo) {
    throw new Error("Metodo transaccion no implementado");
  }

  /**
   * @description Busca un pedido por su número público, con sus ítems.
   * @param {string} _numero - Número del pedido, por ejemplo "VEL-4K7Q2X".
   * @returns {Promise<Object|null>} Pedido crudo, o null si no existe.
   */
  async buscarPorNumero(_numero) {
    throw new Error("Metodo buscarPorNumero no implementado");
  }
}

/**
 * @description Interfaz del repositorio que se usa dentro de una transacción.
 *
 * Los tres primeros métodos tienen la misma forma que los de CotizacionRepository:
 * por eso el cotizador puede trabajar sobre las filas bloqueadas sin enterarse.
 */
class PedidoTransaccion {
  /**
   * @description Bloquea las variantes y las devuelve con su producto. El bloqueo
   * se toma en orden ascendente de id: si dos compras bloquean las mismas filas en
   * distinto orden, se traban entre sí.
   * @param {number[]} _ids - Ids de las variantes.
   * @returns {Promise<Array<Object>>} Variantes bloqueadas, con su producto.
   */
  async buscarVariantes(_ids) {
    throw new Error("Metodo buscarVariantes no implementado");
  }

  /**
   * @description Busca una zona de envío activa.
   * @param {number} _id - Id de la zona.
   * @returns {Promise<Object|null>} Zona, o null.
   */
  async buscarZonaEnvio(_id) {
    throw new Error("Metodo buscarZonaEnvio no implementado");
  }

  /**
   * @description Lista las zonas de envío activas.
   * @returns {Promise<Array<Object>>} Zonas.
   */
  async listarZonasEnvio() {
    throw new Error("Metodo listarZonasEnvio no implementado");
  }

  /**
   * @description Descuenta stock de una variante.
   * @param {number} _varianteId - Id de la variante.
   * @param {number} _cantidad - Unidades a descontar.
   * @returns {Promise<void>}
   * @throws {Error} STOCK_INSUFICIENTE si no alcanza.
   */
  async descontarStock(_varianteId, _cantidad) {
    throw new Error("Metodo descontarStock no implementado");
  }

  /**
   * @description Indica si un número de pedido ya está en uso.
   * @param {string} _numero - Número a verificar.
   * @returns {Promise<boolean>} true si existe.
   */
  async existeNumero(_numero) {
    throw new Error("Metodo existeNumero no implementado");
  }

  /**
   * @description Crea el pedido.
   * @param {Object} _datos - Datos del pedido.
   * @returns {Promise<Object>} Pedido creado, con su id.
   */
  async crearPedido(_datos) {
    throw new Error("Metodo crearPedido no implementado");
  }

  /**
   * @description Crea los ítems del pedido.
   * @param {Array<Object>} _items - Ítems con su pedidoId.
   * @returns {Promise<void>}
   */
  async crearItems(_items) {
    throw new Error("Metodo crearItems no implementado");
  }

  /**
   * @description Agrega una fila a la bitácora del pedido.
   * @param {Object} _evento - Datos del evento.
   * @returns {Promise<void>}
   */
  async registrarEvento(_evento) {
    throw new Error("Metodo registrarEvento no implementado");
  }

  /**
   * @description Deja un mail en la bandeja de salida.
   * @param {Object} _email - Tipo, destinatario y datos.
   * @returns {Promise<void>}
   */
  async encolarEmail(_email) {
    throw new Error("Metodo encolarEmail no implementado");
  }
}

module.exports = { PedidoRepository, PedidoTransaccion };
