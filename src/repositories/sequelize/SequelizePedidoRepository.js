const { Op } = require("sequelize");

const { PedidoRepository, PedidoTransaccion } = require("../PedidoRepository");
const { ESTADOS_PAGO_VENCIBLES } = require("../../services/transicionesPedido");

/**
 * @description Repositorio atado a una transacción de Sequelize. Todas sus
 * operaciones corren dentro de ella.
 */
class SequelizePedidoTransaccion extends PedidoTransaccion {
  /**
   * @description Instancia el repositorio transaccional.
   * @param {Object} models - Diccionario con los modelos y la instancia de sequelize.
   * @param {import("sequelize").Transaction} transaction - Transacción en curso.
   */
  constructor(models, transaction) {
    super();
    this.models = models;
    this.t = transaction;
  }

  /**
   * @description Bloquea las variantes en orden de id y las devuelve con su producto.
   *
   * La lectura con FOR UPDATE devuelve siempre el dato más reciente y, mientras dure
   * la transacción, nadie más puede modificar esas filas: el stock que se lee acá es
   * el que se va a descontar. El producto se lee aparte, sin bloquear, porque solo
   * hace falta su nombre y si está publicado.
   *
   * @param {number[]} ids - Ids de las variantes.
   * @returns {Promise<Array<Object>>} Variantes bloqueadas, con su producto.
   */
  async buscarVariantes(ids) {
    if (!Array.isArray(ids) || ids.length === 0) {
      return [];
    }

    const { sequelize } = this.models;
    const SELECT = { type: sequelize.QueryTypes.SELECT, transaction: this.t };

    const variantes = await sequelize.query(
      `SELECT id, nombre, sku, precio, stock, activa, producto_id AS productoId
         FROM variantes
        WHERE id IN (:ids)
        ORDER BY id ASC
          FOR UPDATE`,
      { ...SELECT, replacements: { ids } }
    );

    if (variantes.length === 0) {
      return [];
    }

    const productos = await sequelize.query(
      "SELECT id, nombre, slug, activo FROM productos WHERE id IN (:ids)",
      { ...SELECT, replacements: { ids: [...new Set(variantes.map((v) => v.productoId))] } }
    );
    const productoPorId = new Map(productos.map((p) => [p.id, p]));

    return variantes.map((v) => ({
      ...v,
      activa: Boolean(v.activa),
      producto: productoPorId.has(v.productoId)
        ? {
            ...productoPorId.get(v.productoId),
            activo: Boolean(productoPorId.get(v.productoId).activo),
          }
        : null,
    }));
  }

  /**
   * @description Busca una zona de envío activa.
   * @param {number} id - Id de la zona.
   * @returns {Promise<Object|null>} Zona cruda, o null.
   */
  async buscarZonaEnvio(id) {
    const zona = await this.models.ZonaEnvio.findOne({
      where: { id, activa: true },
      transaction: this.t,
    });
    return zona ? zona.toJSON() : null;
  }

  /**
   * @description Lista las zonas de envío activas.
   * @returns {Promise<Array<Object>>} Zonas crudas.
   */
  async listarZonasEnvio() {
    const zonas = await this.models.ZonaEnvio.findAll({
      where: { activa: true },
      order: [["orden", "ASC"]],
      transaction: this.t,
    });
    return zonas.map((z) => z.toJSON());
  }

  /**
   * @description Descuenta stock con la condición en la misma sentencia.
   *
   * La fila ya está bloqueada, así que en teoría siempre alcanza. La condición
   * `stock >= cantidad` es una segunda barrera: si alguna vez se llamara sin el
   * bloqueo previo, el stock no puede quedar negativo.
   *
   * @param {number} varianteId - Id de la variante.
   * @param {number} cantidad - Unidades a descontar.
   * @returns {Promise<void>}
   * @throws {Error} STOCK_INSUFICIENTE si no se pudo descontar.
   */
  async descontarStock(varianteId, cantidad) {
    const [, resultado] = await this.models.sequelize.query(
      "UPDATE variantes SET stock = stock - :cantidad WHERE id = :id AND stock >= :cantidad",
      { replacements: { id: varianteId, cantidad }, transaction: this.t }
    );

    const afectadas = resultado?.affectedRows ?? resultado;
    if (afectadas !== 1) {
      throw new Error("STOCK_INSUFICIENTE");
    }
  }

  /**
   * @description Indica si un número de pedido ya está en uso.
   * @param {string} numero - Número a verificar.
   * @returns {Promise<boolean>} true si existe.
   */
  async existeNumero(numero) {
    return (await this.models.Pedido.count({ where: { numero }, transaction: this.t })) > 0;
  }

  /**
   * @description Crea el pedido.
   * @param {Object} datos - Datos del pedido.
   * @returns {Promise<Object>} Pedido creado, con su id.
   */
  async crearPedido(datos) {
    const pedido = await this.models.Pedido.create(datos, { transaction: this.t });
    return pedido.toJSON();
  }

  /**
   * @description Crea los ítems del pedido.
   * @param {Array<Object>} items - Ítems con su pedidoId.
   * @returns {Promise<void>}
   */
  async crearItems(items) {
    await this.models.PedidoItem.bulkCreate(items, { transaction: this.t });
  }

  /**
   * @description Agrega una fila a la bitácora.
   * @param {Object} evento - Datos del evento.
   * @returns {Promise<void>}
   */
  async registrarEvento(evento) {
    await this.models.PedidoEvento.create(evento, { transaction: this.t });
  }

  /**
   * @description Deja un mail en la bandeja de salida, listo para enviar.
   * @param {Object} email - Tipo, destinatario, datos y pedido.
   * @returns {Promise<void>}
   */
  async encolarEmail(email) {
    await this.models.EmailPendiente.create(
      { enviarDesde: new Date(), ...email },
      { transaction: this.t }
    );
  }

  /**
   * @description Lee un pedido con FOR UPDATE. Mientras dure la transacción, nadie
   * más puede cambiarlo: si el webhook quiere aprobarlo al mismo tiempo, espera.
   * @param {number} id - Id del pedido.
   * @returns {Promise<Object|null>} Pedido crudo, o null.
   */
  async bloquearPedido(id) {
    const pedido = await this.models.Pedido.findByPk(id, {
      transaction: this.t,
      lock: this.t.LOCK.UPDATE,
    });
    return pedido ? pedido.toJSON() : null;
  }

  /**
   * @description Lista los ítems de un pedido.
   * @param {number} pedidoId - Id del pedido.
   * @returns {Promise<Array<{varianteId: number|null, cantidad: number}>>} Ítems.
   */
  async listarItems(pedidoId) {
    const items = await this.models.PedidoItem.findAll({
      where: { pedidoId },
      attributes: ["varianteId", "cantidad"],
      transaction: this.t,
    });
    return items.map((i) => i.toJSON());
  }

  /**
   * @description Devuelve unidades al stock de una variante.
   * @param {number} varianteId - Id de la variante.
   * @param {number} cantidad - Unidades a devolver.
   * @returns {Promise<void>}
   */
  async reponerStock(varianteId, cantidad) {
    await this.models.sequelize.query(
      "UPDATE variantes SET stock = stock + :cantidad WHERE id = :id",
      { replacements: { id: varianteId, cantidad }, transaction: this.t }
    );
  }

  /**
   * @description Guarda los estados nuevos del pedido.
   * @param {number} pedidoId - Id del pedido.
   * @param {{estadoPago?: string, estadoPedido?: string}} estados - Estados nuevos.
   * @returns {Promise<void>}
   */
  async actualizarEstados(pedidoId, estados) {
    await this.models.Pedido.update(estados, {
      where: { id: pedidoId },
      transaction: this.t,
    });
  }
}

/**
 * @description Implementación en Sequelize del repositorio de pedidos.
 */
class SequelizePedidoRepository extends PedidoRepository {
  /**
   * @description Instancia el repositorio inyectando los modelos.
   * @param {Object} models - Diccionario con los modelos y la instancia de sequelize.
   */
  constructor(models) {
    super();
    this.models = models;
  }

  /**
   * @description Ejecuta un trabajo dentro de una transacción administrada: si el
   * trabajo termina bien se confirma, y si lanza un error se deshace todo.
   * @param {(tx: SequelizePedidoTransaccion) => Promise<*>} trabajo - Trabajo a ejecutar.
   * @returns {Promise<*>} Lo que devuelva el trabajo.
   */
  transaccion(trabajo) {
    return this.models.sequelize.transaction((t) =>
      trabajo(new SequelizePedidoTransaccion(this.models, t))
    );
  }

  /**
   * @description Busca un pedido por su número público, con sus ítems.
   * @param {string} numero - Número del pedido.
   * @returns {Promise<Object|null>} Pedido crudo, o null.
   */
  async buscarPorNumero(numero) {
    const pedido = await this.models.Pedido.findOne({
      where: { numero },
      include: [{ model: this.models.PedidoItem, as: "items" }],
      order: [[{ model: this.models.PedidoItem, as: "items" }, "id", "ASC"]],
    });
    return pedido ? pedido.toJSON() : null;
  }

  /**
   * @description Lista los ids de los pedidos con la reserva vencida.
   * @param {Date} ahora - Momento de referencia.
   * @param {number} limite - Máximo de pedidos por vuelta.
   * @returns {Promise<number[]>} Ids, los más viejos primero.
   */
  async listarVencidos(ahora, limite) {
    const pedidos = await this.models.Pedido.findAll({
      attributes: ["id"],
      where: {
        estadoPago: { [Op.in]: ESTADOS_PAGO_VENCIBLES },
        expiraEn: { [Op.lte]: ahora },
        comprobanteInformadoEn: null,
      },
      order: [["expiraEn", "ASC"]],
      limit: limite,
    });
    return pedidos.map((p) => p.id);
  }

  /**
   * @description Guarda el id de la preferencia de Mercado Pago.
   * @param {number} pedidoId - Id del pedido.
   * @param {string} preferenciaId - Id de la preferencia.
   * @returns {Promise<void>}
   */
  async guardarPreferencia(pedidoId, preferenciaId) {
    await this.models.Pedido.update({ mpPreferenceId: preferenciaId }, { where: { id: pedidoId } });
  }
}

module.exports = SequelizePedidoRepository;
