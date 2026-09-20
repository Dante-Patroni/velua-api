const { manejarErrorHttp } = require("../middlewares/errorMapper");

/**
 * @description Controlador para los endpoints públicos del catálogo.
 */
class CatalogoController {
  /**
   * @description Inicializa el controlador inyectando el servicio.
   * @param {import('../services/CatalogoService')} catalogoService - Servicio del catálogo.
   */
  constructor(catalogoService) {
    this.catalogoService = catalogoService;
  }

  /**
   * @description Lista todas las categorías activas.
   * @param {import('express').Request} req - Petición HTTP.
   * @param {import('express').Response} res - Respuesta HTTP.
   * @returns {Promise<void>}
   */
  listarCategorias = async (req, res) => {
    try {
      const categorias = await this.catalogoService.listarCategorias();
      res.status(200).json({ datos: categorias });
    } catch (error) {
      manejarErrorHttp(error, res);
    }
  };

  /**
   * @description Lista los productos para la grilla con paginación y filtros.
   * @param {import('express').Request} req - Petición HTTP.
   * @param {import('express').Response} res - Respuesta HTTP.
   * @returns {Promise<void>}
   */
  listarProductos = async (req, res) => {
    try {
      // Mapeo exhaustivo de los parámetros de OpenAPI
      const filtros = {
        pagina: req.query.pagina,
        limite: req.query.limite,
        categoria: req.query.categoria, // Ahora recibe slug, no ID
        destacados: req.query.destacados === "true",
        q: req.query.q,
        orden: req.query.orden,
      };

      const resultado = await this.catalogoService.listarProductos(filtros);

      // Retorna objeto con datos y meta
      res.status(200).json(resultado);
    } catch (error) {
      manejarErrorHttp(error, res);
    }
  };

  /**
   * @description Obtiene el detalle completo de un producto por su slug.
   * @param {import('express').Request} req - Petición HTTP.
   * @param {import('express').Response} res - Respuesta HTTP.
   * @returns {Promise<void>}
   */
  obtenerProducto = async (req, res) => {
    try {
      const { slug } = req.params;
      const producto = await this.catalogoService.obtenerProductoPorSlug(slug);

      // El endpoint de detalle no lleva array ni meta, responde el objeto plano
      res.status(200).json(producto);
    } catch (error) {
      manejarErrorHttp(error, res);
    }
  };
}

module.exports = CatalogoController;
