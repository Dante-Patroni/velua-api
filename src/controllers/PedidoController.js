const { manejarErrorHttp } = require("../middlewares/errorMapper");

/**
 * @description Controlador público de pedidos: crear uno y consultar su estado.
 */
class PedidoController {
  /**
   * @description Inicializa el controlador inyectando el servicio.
   * @param {Object} checkoutService - Instancia de CheckoutService.
   */
  constructor(checkoutService) {
    this.servicio = checkoutService;
  }

  /**
   * @description Crea un pedido con el stock apartado.
   * @param {import("express").Request} req - Request con el checkout en el cuerpo.
   * @param {import("express").Response} res - Response de Express.
   * @returns {Promise<void>}
   */
  crear = async (req, res) => {
    try {
      const { items, cliente, entrega, medioPago, totalEsperado, notas } = req.body;
      const pedido = await this.servicio.crearPedido({
        items,
        cliente,
        entrega,
        medioPago,
        totalEsperado,
        notas,
      });
      res.status(201).json(pedido);
    } catch (error) {
      manejarErrorHttp(error, res);
    }
  };

  /**
   * @description Devuelve el estado de un pedido, sin datos personales.
   * @param {import("express").Request} req - Request con el número en la ruta.
   * @param {import("express").Response} res - Response de Express.
   * @returns {Promise<void>}
   */
  consultar = async (req, res) => {
    try {
      res.status(200).json(await this.servicio.consultarPorNumero(req.params.numero));
    } catch (error) {
      manejarErrorHttp(error, res);
    }
  };
}

module.exports = PedidoController;
