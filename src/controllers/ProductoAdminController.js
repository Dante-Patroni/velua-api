const { manejarErrorHttp } = require("../middlewares/errorMapper");

/**
 * @description Controlador de productos y variantes del panel de administración.
 */
class ProductoAdminController {
  /**
   * @description Inicializa el controlador inyectando el servicio.
   * @param {Object} productoAdminService - Instancia de ProductoAdminService.
   */
  constructor(productoAdminService) {
    this.servicio = productoAdminService;
  }

  /**
   * @description Lista productos paginados para la grilla del panel.
   * @param {import("express").Request} req - Request con los filtros en la consulta.
   * @param {import("express").Response} res - Response de Express.
   * @returns {Promise<void>}
   */
  listar = async (req, res) => {
    try {
      const filtros = {
        pagina: req.query.pagina,
        limite: req.query.limite,
        q: req.query.q,
        categoriaId: req.query.categoriaId,
        estado: req.query.estado,
        orden: req.query.orden,
      };
      res.status(200).json(await this.servicio.listar(filtros));
    } catch (error) {
      manejarErrorHttp(error, res);
    }
  };

  /**
   * @description Devuelve la ficha completa de un producto.
   * @param {import("express").Request} req - Request con el id en los parámetros.
   * @param {import("express").Response} res - Response de Express.
   * @returns {Promise<void>}
   */
  obtener = async (req, res) => {
    try {
      res.status(200).json(await this.servicio.obtener(req.params.id));
    } catch (error) {
      manejarErrorHttp(error, res);
    }
  };

  /**
   * @description Crea un producto con sus variantes.
   * @param {import("express").Request} req - Request con los datos en el cuerpo.
   * @param {import("express").Response} res - Response de Express.
   * @returns {Promise<void>}
   */
  crear = async (req, res) => {
    try {
      res.status(201).json(await this.servicio.crear(req.body));
    } catch (error) {
      manejarErrorHttp(error, res);
    }
  };

  /**
   * @description Edita los datos de un producto, sin tocar sus variantes.
   * @param {import("express").Request} req - Request con el id y los cambios.
   * @param {import("express").Response} res - Response de Express.
   * @returns {Promise<void>}
   */
  actualizar = async (req, res) => {
    try {
      res.status(200).json(await this.servicio.actualizar(req.params.id, req.body));
    } catch (error) {
      manejarErrorHttp(error, res);
    }
  };

  /**
   * @description Publica o despublica un producto.
   * @param {import("express").Request} req - Request con el id y el estado.
   * @param {import("express").Response} res - Response de Express.
   * @returns {Promise<void>}
   */
  cambiarEstado = async (req, res) => {
    try {
      res.status(200).json(await this.servicio.cambiarEstado(req.params.id, req.body.activo));
    } catch (error) {
      manejarErrorHttp(error, res);
    }
  };

  /**
   * @description Agrega una variante a un producto existente.
   * @param {import("express").Request} req - Request con el id del producto y los datos.
   * @param {import("express").Response} res - Response de Express.
   * @returns {Promise<void>}
   */
  agregarVariante = async (req, res) => {
    try {
      res.status(201).json(await this.servicio.agregarVariante(req.params.id, req.body));
    } catch (error) {
      manejarErrorHttp(error, res);
    }
  };

  /**
   * @description Edita una variante de un producto.
   * @param {import("express").Request} req - Request con los dos ids y los cambios.
   * @param {import("express").Response} res - Response de Express.
   * @returns {Promise<void>}
   */
  actualizarVariante = async (req, res) => {
    try {
      const producto = await this.servicio.actualizarVariante(
        req.params.id,
        req.params.varianteId,
        req.body
      );
      res.status(200).json(producto);
    } catch (error) {
      manejarErrorHttp(error, res);
    }
  };

  /**
   * @description Activa o desactiva una variante.
   * @param {import("express").Request} req - Request con los dos ids y el estado.
   * @param {import("express").Response} res - Response de Express.
   * @returns {Promise<void>}
   */
  cambiarEstadoVariante = async (req, res) => {
    try {
      const producto = await this.servicio.cambiarEstadoVariante(
        req.params.id,
        req.params.varianteId,
        req.body.activa
      );
      res.status(200).json(producto);
    } catch (error) {
      manejarErrorHttp(error, res);
    }
  };

  /**
   * @description Borra un producto que nunca se vendió.
   * @param {import("express").Request} req - Request con el id en los parámetros.
   * @param {import("express").Response} res - Response de Express.
   * @returns {Promise<void>}
   */
  borrar = async (req, res) => {
    try {
      await this.servicio.borrar(req.params.id);
      res.status(204).end();
    } catch (error) {
      manejarErrorHttp(error, res);
    }
  };
}

module.exports = ProductoAdminController;
