const { generarSlug, generarSlugUnico } = require("../utils/slug");

const LARGO_SLUG = 80;

/**
 * @description Recorta una categoría al formato que expone el panel.
 * @param {Object} categoria - Categoría cruda del repositorio.
 * @returns {Object} Categoría con los campos del contrato del panel.
 */
const mapearCategoriaAdmin = (categoria) => ({
  id: categoria.id,
  nombre: categoria.nombre,
  slug: categoria.slug,
  descripcion: categoria.descripcion ?? null,
  imagenUrl: categoria.imagenUrl ?? null,
  orden: categoria.orden,
  activa: Boolean(categoria.activa),
  cantidadProductos: Number(categoria.cantidadProductos ?? 0),
});

/**
 * @description Servicio de administración de categorías.
 */
class CategoriaAdminService {
  /**
   * @description Instancia el servicio inyectando el repositorio.
   * @param {Object} categoriaRepository - Implementación de CategoriaRepository.
   */
  constructor(categoriaRepository) {
    this.categoriaRepository = categoriaRepository;
  }

  /**
   * @description Lista todas las categorías, activas e inactivas.
   * @returns {Promise<Array<Object>>} Categorías con la cantidad de productos activos de cada una.
   */
  async listar() {
    const categorias = await this.categoriaRepository.listarTodas();
    return categorias.map(mapearCategoriaAdmin);
  }

  /**
   * @description Obtiene una categoría por id.
   * @param {number} id - Id de la categoría.
   * @returns {Promise<Object>} Categoría.
   * @throws {Error} NO_ENCONTRADO
   */
  async obtener(id) {
    const categoria = await this.categoriaRepository.buscarPorId(id);
    if (!categoria) {
      throw new Error("NO_ENCONTRADO");
    }
    return mapearCategoriaAdmin(categoria);
  }

  /**
   * @description Crea una categoría. Si no se indica slug, se genera del nombre
   * y se le agrega un sufijo si ya existe. Si se indica y está tomado, se rechaza.
   * La categoría nueva queda activa y al final del menú.
   * @param {Object} datos - Datos de la categoría.
   * @param {string} datos.nombre - Nombre visible.
   * @param {string} [datos.slug] - Slug elegido a mano.
   * @param {string} [datos.descripcion] - Descripción corta.
   * @param {string} [datos.imagenUrl] - URL de la imagen de la categoría.
   * @returns {Promise<Object>} Categoría creada.
   * @throws {Error} DATOS_INVALIDOS, CONFLICTO_DE_DATOS
   */
  async crear({ nombre, slug, descripcion, imagenUrl }) {
    const slugFinal = slug
      ? await this.#slugElegido(slug)
      : await generarSlugUnico(
          generarSlug(nombre, LARGO_SLUG),
          (s) => this.categoriaRepository.existeSlug(s),
          LARGO_SLUG
        );

    const creada = await this.categoriaRepository.crear({
      nombre: nombre.trim(),
      slug: slugFinal,
      descripcion: descripcion?.trim() || null,
      imagenUrl: imagenUrl || null,
      orden: await this.categoriaRepository.siguienteOrden(),
      activa: true,
    });

    return this.obtener(creada.id);
  }

  /**
   * @description Edita una categoría. Cambiar el nombre NO cambia el slug:
   * si se regenerara solo, cada corrección rompería los links que ya circularon.
   * @param {number} id - Id de la categoría.
   * @param {Object} cambios - Campos a modificar. Los que no vienen no se tocan.
   * @param {string} [cambios.nombre] - Nombre visible.
   * @param {string} [cambios.slug] - Slug nuevo, solo si se edita a propósito.
   * @param {string} [cambios.descripcion] - Descripción corta.
   * @param {string} [cambios.imagenUrl] - URL de la imagen de la categoría.
   * @returns {Promise<Object>} Categoría actualizada.
   * @throws {Error} NO_ENCONTRADO, DATOS_INVALIDOS, CONFLICTO_DE_DATOS
   */
  async actualizar(id, { nombre, slug, descripcion, imagenUrl }) {
    const actual = await this.categoriaRepository.buscarPorId(id);
    if (!actual) {
      throw new Error("NO_ENCONTRADO");
    }

    const aplicar = {};
    if (nombre !== undefined) aplicar.nombre = nombre.trim();
    if (descripcion !== undefined) aplicar.descripcion = descripcion?.trim() || null;
    if (imagenUrl !== undefined) aplicar.imagenUrl = imagenUrl || null;
    if (slug !== undefined && slug !== actual.slug) {
      aplicar.slug = await this.#slugElegido(slug, id);
    }

    if (Object.keys(aplicar).length > 0) {
      await this.categoriaRepository.actualizar(id, aplicar);
    }

    return this.obtener(id);
  }

  /**
   * @description Activa o desactiva una categoría. Desactivarla oculta de la
   * tienda todos sus productos, aunque cada uno siga activo: la respuesta
   * incluye cuántos son para que el panel lo pueda informar.
   * @param {number} id - Id de la categoría.
   * @param {boolean} activa - Estado nuevo.
   * @returns {Promise<Object>} Categoría con su estado nuevo.
   * @throws {Error} NO_ENCONTRADO
   */
  async cambiarEstado(id, activa) {
    const actual = await this.categoriaRepository.buscarPorId(id);
    if (!actual) {
      throw new Error("NO_ENCONTRADO");
    }

    if (Boolean(actual.activa) !== activa) {
      await this.categoriaRepository.actualizar(id, { activa });
    }

    return this.obtener(id);
  }

  /**
   * @description Reordena el menú. Exige la lista completa de categorías, sin
   * faltantes, repetidas ni ids desconocidos: un orden parcial dejaría
   * posiciones duplicadas.
   * @param {number[]} idsEnOrden - Ids de todas las categorías, en el orden deseado.
   * @returns {Promise<Array<Object>>} Categorías en el orden nuevo.
   * @throws {Error} DATOS_INVALIDOS
   */
  async reordenar(idsEnOrden) {
    const existentes = await this.categoriaRepository.listarTodas();
    const idsExistentes = new Set(existentes.map((c) => c.id));
    const idsRecibidos = new Set(idsEnOrden);

    const sinRepetidos = idsRecibidos.size === idsEnOrden.length;
    const mismaCantidad = idsRecibidos.size === idsExistentes.size;
    const todosExisten = [...idsRecibidos].every((id) => idsExistentes.has(id));

    if (!sinRepetidos || !mismaCantidad || !todosExisten) {
      throw new Error("DATOS_INVALIDOS");
    }

    await this.categoriaRepository.reordenar(idsEnOrden);
    return this.listar();
  }

  /**
   * @description Normaliza un slug elegido a mano y verifica que esté libre.
   * @param {string} slug - Slug ingresado.
   * @param {number} [excluirId] - Id de la categoría que se está editando.
   * @returns {Promise<string>} Slug normalizado.
   * @throws {Error} DATOS_INVALIDOS si queda vacío, CONFLICTO_DE_DATOS si está tomado.
   */
  async #slugElegido(slug, excluirId) {
    const normalizado = generarSlug(slug, LARGO_SLUG);
    if (!normalizado) {
      throw new Error("DATOS_INVALIDOS");
    }
    if (await this.categoriaRepository.existeSlug(normalizado, excluirId)) {
      throw new Error("CONFLICTO_DE_DATOS");
    }
    return normalizado;
  }
}

module.exports = CategoriaAdminService;
