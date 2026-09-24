const { manejarErrorHttp } = require("../middlewares/errorMapper");

/**
 * @description Controlador de las imágenes de un producto en el panel.
 */
class ImagenAdminController {
  /**
   * @description Inicializa el controlador inyectando el servicio.
   * @param {Object} imagenAdminService - Instancia de ImagenAdminService.
   */
  constructor(imagenAdminService) {
    this.servicio = imagenAdminService;
  }

  /**
   * @description Lista las imágenes de un producto.
   * @param {import("express").Request} req - Request con el id del producto.
   * @param {import("express").Response} res - Response de Express.
   * @returns {Promise<void>}
   */
  listar = async (req, res) => {
    try {
      res.status(200).json({ datos: await this.servicio.listar(req.params.id) });
    } catch (error) {
      manejarErrorHttp(error, res);
    }
  };

  /**
   * @description Sube una imagen y la agrega al final de la galería.
   * @param {import("express").Request} req - Request con el archivo en req.file.
   * @param {import("express").Response} res - Response de Express.
   * @returns {Promise<void>}
   */
  subir = async (req, res) => {
    try {
      const imagenes = await this.servicio.subir(req.params.id, req.file.buffer, req.body.alt);
      res.status(201).json({ datos: imagenes });
    } catch (error) {
      manejarErrorHttp(error, res);
    }
  };

  /**
   * @description Cambia el texto alternativo de una imagen.
   * @param {import("express").Request} req - Request con los dos ids y el alt.
   * @param {import("express").Response} res - Response de Express.
   * @returns {Promise<void>}
   */
  actualizarAlt = async (req, res) => {
    try {
      const imagenes = await this.servicio.actualizarAlt(
        req.params.id,
        req.params.imagenId,
        req.body.alt
      );
      res.status(200).json({ datos: imagenes });
    } catch (error) {
      manejarErrorHttp(error, res);
    }
  };

  /**
   * @description Borra una imagen de la base y del proveedor.
   * @param {import("express").Request} req - Request con los dos ids.
   * @param {import("express").Response} res - Response de Express.
   * @returns {Promise<void>}
   */
  borrar = async (req, res) => {
    try {
      const imagenes = await this.servicio.borrar(req.params.id, req.params.imagenId);
      res.status(200).json({ datos: imagenes });
    } catch (error) {
      manejarErrorHttp(error, res);
    }
  };

  /**
   * @description Reordena la galería de un producto.
   * @param {import("express").Request} req - Request con la lista de ids.
   * @param {import("express").Response} res - Response de Express.
   * @returns {Promise<void>}
   */
  reordenar = async (req, res) => {
    try {
      const imagenes = await this.servicio.reordenar(req.params.id, req.body.ids);
      res.status(200).json({ datos: imagenes });
    } catch (error) {
      manejarErrorHttp(error, res);
    }
  };
}

module.exports = ImagenAdminController;
