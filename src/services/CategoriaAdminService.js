const { generarSlug, generarSlugUnico } = require("../utils/slug");
const { esSlugReservado } = require("../utils/slugsReservados");

const LARGO_SLUG = 80;

/**
 * @description Carpeta donde se guardan las imágenes de las colecciones en el
 * proveedor. Separada de la de productos para poder revisarlas por separado.
 */
const CARPETA_IMAGENES = "velua/categorias";

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
  padreId: categoria.padreId ?? null,
  orden: categoria.orden,
  activa: Boolean(categoria.activa),
  cantidadProductos: Number(categoria.cantidadProductos ?? 0),
  cantidadHijas: Number(categoria.cantidadHijas ?? 0),
});

/**
 * @description Servicio de administración de categorías.
 */
class CategoriaAdminService {
  /**
   * @description Instancia el servicio inyectando sus dependencias.
   * @param {Object} categoriaRepository - Implementación de CategoriaRepository.
   * @param {Object} [imagenStorage] - Implementación de ImagenStorage. Solo la usan
   *   subirImagen y quitarImagen.
   */
  constructor(categoriaRepository, imagenStorage = null) {
    this.categoriaRepository = categoriaRepository;
    this.imagenStorage = imagenStorage;
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
   * @param {number|null} [datos.padreId] - Categoría padre, o null para el primer nivel.
   * @returns {Promise<Object>} Categoría creada.
   * @throws {Error} DATOS_INVALIDOS, CONFLICTO_DE_DATOS, CATEGORIA_PADRE_INVALIDA,
   *   CATEGORIA_CON_PRODUCTOS
   */
  async crear({ nombre, slug, descripcion, imagenUrl, padreId }) {
    if (padreId) {
      await this.#validarPadre(null, padreId);
    }

    const slugFinal = slug
      ? await this.#slugElegido(slug)
      : await generarSlugUnico(
          generarSlug(nombre, LARGO_SLUG),
          (s) => esSlugReservado(s) || this.categoriaRepository.existeSlug(s),
          LARGO_SLUG
        );

    const creada = await this.categoriaRepository.crear({
      nombre: nombre.trim(),
      slug: slugFinal,
      descripcion: descripcion?.trim() || null,
      imagenUrl: imagenUrl || null,
      padreId: padreId || null,
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
   * @param {number|null} [cambios.padreId] - Categoría padre nueva, o null para
   *   pasarla al primer nivel.
   * @returns {Promise<Object>} Categoría actualizada.
   * @throws {Error} NO_ENCONTRADO, DATOS_INVALIDOS, CONFLICTO_DE_DATOS,
   *   CATEGORIA_PADRE_INVALIDA, CATEGORIA_CON_HIJAS, CATEGORIA_CON_PRODUCTOS
   */
  async actualizar(id, { nombre, slug, descripcion, imagenUrl, padreId }) {
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
    if (padreId !== undefined && (padreId || null) !== (actual.padreId ?? null)) {
      // Pasar al primer nivel siempre se puede; ir debajo de otra, se valida
      if (padreId) {
        await this.#validarPadre(actual, padreId);
      }
      aplicar.padreId = padreId || null;
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
   * @description Sube la imagen de una categoría, reemplazando la anterior si había.
   *
   * La subida al proveedor no entra en la base, así que el orden importa: primero
   * se sube la nueva, después se guarda, y recién al final se borra la vieja. Si
   * guardar falla, se borra la recién subida para no dejar un huérfano. Si borrar
   * la vieja falla, no se informa error: la categoría ya quedó bien y un archivo
   * huérfano molesta menos que una operación que parece fallida y no lo fue.
   *
   * @param {number} id - Id de la categoría.
   * @param {Buffer} archivo - Contenido del archivo ya validado.
   * @returns {Promise<Object>} Categoría con la imagen nueva.
   * @throws {Error} NO_ENCONTRADO, ERROR_AL_SUBIR
   */
  async subirImagen(id, archivo) {
    const actual = await this.categoriaRepository.buscarPorId(id);
    if (!actual) {
      throw new Error("NO_ENCONTRADO");
    }

    const { url, publicId } = await this.imagenStorage.subir(archivo, CARPETA_IMAGENES);

    try {
      await this.categoriaRepository.actualizar(id, {
        imagenUrl: url,
        imagenPublicId: publicId,
      });
    } catch (error) {
      await this.#borrarRemotoSinFallar(publicId);
      throw error;
    }

    if (actual.imagenPublicId) {
      await this.#borrarRemotoSinFallar(actual.imagenPublicId);
    }

    return this.obtener(id);
  }

  /**
   * @description Quita la imagen de una categoría. Primero la base, después el
   * proveedor: si el borrado remoto falla, queda un huérfano, pero nunca una
   * colección apuntando a una imagen que ya no existe.
   * @param {number} id - Id de la categoría.
   * @returns {Promise<Object>} Categoría sin imagen.
   * @throws {Error} NO_ENCONTRADO
   */
  async quitarImagen(id) {
    const actual = await this.categoriaRepository.buscarPorId(id);
    if (!actual) {
      throw new Error("NO_ENCONTRADO");
    }

    await this.categoriaRepository.actualizar(id, { imagenUrl: null, imagenPublicId: null });

    if (actual.imagenPublicId) {
      await this.#borrarRemotoSinFallar(actual.imagenPublicId);
    }

    return this.obtener(id);
  }

  /**
   * @description Verifica que una categoría pueda ir debajo de otra.
   *
   * Hace cumplir las dos reglas del árbol: solo hay dos niveles, y una categoría
   * tiene productos o tiene hijas, nunca las dos cosas. MySQL no puede expresar
   * ninguna de las dos, así que viven acá.
   *
   * @param {Object|null} categoria - La categoría que se mueve, o null si se está creando.
   * @param {number} padreId - Id de la categoría padre propuesta.
   * @returns {Promise<void>}
   * @throws {Error} CATEGORIA_PADRE_INVALIDA si el padre no existe, es ella misma o
   *   ya es hija de otra; CATEGORIA_CON_HIJAS si la que se mueve tiene hijas;
   *   CATEGORIA_CON_PRODUCTOS si el padre tiene productos.
   */
  async #validarPadre(categoria, padreId) {
    if (categoria && Number(padreId) === Number(categoria.id)) {
      throw new Error("CATEGORIA_PADRE_INVALIDA");
    }

    const padre = await this.categoriaRepository.buscarPorId(padreId);
    if (!padre) {
      throw new Error("CATEGORIA_PADRE_INVALIDA");
    }
    // Si el padre ya cuelga de otra, quedarían tres niveles
    if (padre.padreId) {
      throw new Error("CATEGORIA_PADRE_INVALIDA");
    }
    // Y si la que se mueve tiene hijas, también
    if (categoria && Number(categoria.cantidadHijas ?? 0) > 0) {
      throw new Error("CATEGORIA_CON_HIJAS");
    }
    if (await this.categoriaRepository.tieneProductos(padreId)) {
      throw new Error("CATEGORIA_CON_PRODUCTOS");
    }
  }

  /**
   * @description Borra un archivo del proveedor sin propagar errores.
   * @param {string} publicId - Identificador remoto.
   * @returns {Promise<void>}
   */
  async #borrarRemotoSinFallar(publicId) {
    try {
      await this.imagenStorage.borrar(publicId);
    } catch {
      // Queda un archivo huérfano en el proveedor: se acepta antes que fallar
    }
  }

  /**
   * @description Normaliza un slug elegido a mano y verifica que esté libre.
   * @param {string} slug - Slug ingresado.
   * @param {number} [excluirId] - Id de la categoría que se está editando.
   * @returns {Promise<string>} Slug normalizado.
   * @throws {Error} DATOS_INVALIDOS si queda vacío, CONFLICTO_DE_DATOS si está tomado o reservado por la tienda.
   */
  async #slugElegido(slug, excluirId) {
    const normalizado = generarSlug(slug, LARGO_SLUG);
    if (!normalizado) {
      throw new Error("DATOS_INVALIDOS");
    }
    if (esSlugReservado(normalizado)) {
      throw new Error("CONFLICTO_DE_DATOS");
    }
    if (await this.categoriaRepository.existeSlug(normalizado, excluirId)) {
      throw new Error("CONFLICTO_DE_DATOS");
    }
    return normalizado;
  }
}

module.exports = CategoriaAdminService;
