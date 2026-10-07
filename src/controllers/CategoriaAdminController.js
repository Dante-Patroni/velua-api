const { manejarErrorHttp } = require("../middlewares/errorMapper");

/**
 * @description Controlador de categorías del panel de administración.
 */
class CategoriaAdminController {
  /**
   * @description Inicializa el controlador inyectando el servicio.
   * @param {Object} categoriaAdminService - Instancia de CategoriaAdminService.
   */
  constructor(categoriaAdminService) {
    this.servicio = categoriaAdminService;
  }

  /**
   * @description Lista todas las categorías, activas e inactivas.
   * @param {import("express").Request} req - Request de Express.
   * @param {import("express").Response} res - Response de Express.
   * @returns {Promise<void>}
   */
  listar = async (req, res) => {
    try {
      res.status(200).json({ datos: await this.servicio.listar() });
    } catch (error) {
      manejarErrorHttp(error, res);
    }
  };

  /**
   * @description Devuelve una categoría por id.
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
   * @description Crea una categoría.
   * @param {import("express").Request} req - Request con los datos en el cuerpo.
   * @param {import("express").Response} res - Response de Express.
   * @returns {Promise<void>}
   */
  crear = async (req, res) => {
    try {
      const { nombre, slug, descripcion, imagenUrl } = req.body;
      const categoria = await this.servicio.crear({ nombre, slug, descripcion, imagenUrl });
      res.status(201).json(categoria);
    } catch (error) {
      manejarErrorHttp(error, res);
    }
  };

  /**
   * @description Edita los campos indicados de una categoría.
   * @param {import("express").Request} req - Request con el id y los cambios.
   * @param {import("express").Response} res - Response de Express.
   * @returns {Promise<void>}
   */
  actualizar = async (req, res) => {
    try {
      const { nombre, slug, descripcion, imagenUrl } = req.body;
      const categoria = await this.servicio.actualizar(req.params.id, {
        nombre,
        slug,
        descripcion,
        imagenUrl,
      });
      res.status(200).json(categoria);
    } catch (error) {
      manejarErrorHttp(error, res);
    }
  };

  /**
   * @description Activa o desactiva una categoría.
   * @param {import("express").Request} req - Request con el id y el estado en el cuerpo.
   * @param {import("express").Response} res - Response de Express.
   * @returns {Promise<void>}
   */
  cambiarEstado = async (req, res) => {
    try {
      const categoria = await this.servicio.cambiarEstado(req.params.id, req.body.activa);
      res.status(200).json(categoria);
    } catch (error) {
      manejarErrorHttp(error, res);
    }
  };

  /**
   * @description Reordena el menú de categorías.
   * @param {import("express").Request} req - Request con la lista de ids en el cuerpo.
   * @param {import("express").Response} res - Response de Express.
   * @returns {Promise<void>}
   */
  reordenar = async (req, res) => {
    try {
      res.status(200).json({ datos: await this.servicio.reordenar(req.body.ids) });
    } catch (error) {
      manejarErrorHttp(error, res);
    }
  };

  /**
   * @description Sube o reemplaza la imagen de una categoría.
   * @param {import("express").Request} req - Request con el id y el archivo en req.file.
   * @param {import("express").Response} res - Response de Express.
   * @returns {Promise<void>}
   */
  subirImagen = async (req, res) => {
    try {
      res.status(200).json(await this.servicio.subirImagen(req.params.id, req.file.buffer));
    } catch (error) {
      manejarErrorHttp(error, res);
    }
  };

  /**
   * @description Quita la imagen de una categoría.
   * @param {import("express").Request} req - Request con el id.
   * @param {import("express").Response} res - Response de Express.
   * @returns {Promise<void>}
   */
  quitarImagen = async (req, res) => {
    try {
      res.status(200).json(await this.servicio.quitarImagen(req.params.id));
    } catch (error) {
      manejarErrorHttp(error, res);
    }
  };
}

module.exports = CategoriaAdminController;
