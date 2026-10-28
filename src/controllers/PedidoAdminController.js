const { matchedData } = require("express-validator");

const { manejarErrorHttp } = require("../middlewares/errorMapper");

/**
 * @description Controlador de los pedidos del panel: consulta y cambios de estado.
 */
class PedidoAdminController {
  /**
   * @description Inicializa el controlador inyectando los servicios.
   * @param {Object} pedidoAdminService - Instancia de PedidoAdminService.
   * @param {Object} [pedidoEstadoService] - Instancia de PedidoEstadoService.
   */
  constructor(pedidoAdminService, pedidoEstadoService) {
    this.servicio = pedidoAdminService;
    this.estados = pedidoEstadoService;
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


  /**
   * @description Avanza la preparación de un pedido. Quién lo hace sale de la
   * sesión, nunca del body.
   * @param {import("express").Request} req - Request con el id y el estado nuevo.
   * @param {import("express").Response} res - Response de Express.
   * @returns {Promise<void>}
   */
  cambiarPreparacion = async (req, res) => {
    try {
      const { id } = matchedData(req, { locations: ["params"] });
      const { estado, seguimiento } = matchedData(req, { locations: ["body"] });
      const resultado = await this.estados.cambiarEstadoPreparacion(id, {
        hacia: estado,
        seguimiento: seguimiento ?? null,
        usuarioId: req.usuario.id,
      });
      res.status(200).json(resultado);
    } catch (error) {
      manejarErrorHttp(error, res);
    }
  };

  /**
   * @description Cancela a mano un pedido sin pagar. Quién lo hace sale de la
   * sesión, nunca del body.
   * @param {import("express").Request} req - Request con el id, el motivo y la confirmación.
   * @param {import("express").Response} res - Response de Express.
   * @returns {Promise<void>}
   */
  cancelar = async (req, res) => {
    try {
      const { id } = matchedData(req, { locations: ["params"] });
      const { motivo, confirmaSinPago } = matchedData(req, { locations: ["body"] });
      const resultado = await this.estados.cancelarManual(id, {
        motivo,
        confirmaSinPago: confirmaSinPago === true,
        usuarioId: req.usuario.id,
      });
      res.status(200).json(resultado);
    } catch (error) {
      manejarErrorHttp(error, res);
    }
  };
}

module.exports = PedidoAdminController;
