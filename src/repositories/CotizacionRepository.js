/**
 * @description Interfaz del repositorio que usa el cotizador.
 *
 * Es de solo lectura: cotizar no modifica nada. El descuento de stock y la
 * creación del pedido son otra cosa y viven en el repositorio de pedidos.
 */
class CotizacionRepository {
  /**
   * @description Busca varias variantes de una sola vez, con los datos que el
   * cotizador necesita: precio, stock, si está activa, y a qué producto
   * pertenece para poder nombrarla en los mensajes.
   *
   * Es una sola consulta y no una por variante: un carrito de ocho productos
   * serían ocho viajes a la base.
   *
   * @param {number[]} _ids - Ids de las variantes.
   * @returns {Promise<Array<Object>>} Variantes encontradas, con su producto.
   *   Las que no existen simplemente no vienen.
   */
  async buscarVariantes(_ids) {
    throw new Error("Metodo buscarVariantes no implementado");
  }

  /**
   * @description Busca una zona de envío activa por id.
   * @param {number} _id - Id de la zona.
   * @returns {Promise<Object|null>} Zona con su costo, o null si no existe o está inactiva.
   */
  async buscarZonaEnvio(_id) {
    throw new Error("Metodo buscarZonaEnvio no implementado");
  }

  /**
   * @description Lista las zonas de envío activas, para que el checkout las
   * muestre.
   * @returns {Promise<Array<Object>>} Zonas ordenadas.
   */
  async listarZonasEnvio() {
    throw new Error("Metodo listarZonasEnvio no implementado");
  }
}

module.exports = CotizacionRepository;
