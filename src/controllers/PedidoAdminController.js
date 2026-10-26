const { matchedData } = require("express-validator");

const { manejarErrorHttp } = require("../middlewares/errorMapper");

/**
 * @description Controlador de la consulta de pedidos del panel.
 */
class PedidoAdminController {
  /**
   * @description Inicializa el controlador inyectando el servicio.
   * @param {Object} pedidoAdminService - Instancia de PedidoAdminService.
   */
  constructor(pedidoAdminService) {
    this.servicio = pedidoAdminService;
  }

  /**
   * @description Lista los pedidos con filtros y paginación ya validados.
   * @param {import("express").Request} req - Request con los filtros en la query.
   * @param {import("express").Response} res - Response de Express.
   * @returns {Promise<void>}
   */
  listar = async (req, res) => {
    try {
      const { estadoPago, estadoPedido, pagina, limite } = matchedData(req, {
        locations: ["query"],
      });
      res
        .status(200)
        .json(await this.servicio.listar({ estadoPago, estadoPedido, pagina, limite }));
    } catch (error) {
      manejarErrorHttp(error, res);
    }
  };

  /**
   * @description Devuelve el detalle de un pedido.
   * @param {import("express").Request} req - Request con el id en la ruta.
   * @param {import("express").Response} res - Response de Express.
   * @returns {Promise<void>}
   */
  detalle = async (req, res) => {
    try {
      const { id } = matchedData(req, { locations: ["params"] });
      res.status(200).json(await this.servicio.detalle(id));
    } catch (error) {
      manejarErrorHttp(error, res);
    }
  };
}

module.exports = PedidoAdminController;
