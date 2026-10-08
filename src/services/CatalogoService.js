/**
 * @description Recorta una categoría a los campos que expone el contrato.
 * @param {Object} categoria - Categoría cruda del repositorio.
 * @returns {Object} Categoría con los campos del contrato.
 */
const mapearCategoria = (categoria) => ({
  id: categoria.id,
  padreId: categoria.padreId ?? null,
  nombre: categoria.nombre,
  slug: categoria.slug,
  descripcion: categoria.descripcion,
  imagenUrl: categoria.imagenUrl,
});

/**
 * @description Arma el árbol de categorías a partir de la lista plana.
 *
 * Arriba quedan las de primer nivel, en su orden, y cada una trae sus hijas en
 * `hijas`, también en su orden. Una hija cuyo padre no vino en la lista (porque
 * está desactivado) no aparece: el repositorio ya la filtra, y esto no la
 * rescata.
 *
 * @param {Array<Object>} filas - Categorías crudas, ya ordenadas.
 * @returns {Array<Object>} Categorías de primer nivel con sus hijas.
 */
const armarArbol = (filas) => {
  const hijasPorPadre = new Map();
  for (const categoria of filas) {
    if (categoria.padreId) {
      const hermanas = hijasPorPadre.get(categoria.padreId) ?? [];
      hermanas.push(mapearCategoria(categoria));
      hijasPorPadre.set(categoria.padreId, hermanas);
    }
  }

  return filas
    .filter((categoria) => !categoria.padreId)
    .map((categoria) => ({
      ...mapearCategoria(categoria),
      hijas: hijasPorPadre.get(categoria.id) ?? [],
    }));
};

/**
 * @description Servicio para la lectura del catálogo público.
 */
class CatalogoService {
  /**
   * @description Instancia el servicio inyectando el repositorio de catálogo.
   * @param {Object} catalogoRepository - Implementación de CatalogoRepository.
   */
  constructor(catalogoRepository) {
    this.catalogoRepository = catalogoRepository;
  }

  /**
   * @description Lista las categorías visibles como árbol de dos niveles.
   * @returns {Promise<Array<Object>>} Categorías de primer nivel, cada una con sus hijas.
   */
  async listarCategorias() {
    return armarArbol(await this.catalogoRepository.listarCategorias());
  }

  /**
   * @description Obtiene la grilla mapeando los datos crudos al contrato ProductoListado.
   * @param {Object} filtros - Filtros y paginación.
   * @returns {Promise<Object>} { datos, meta }
   */
  async listarProductos(filtros = {}) {
    const pagina = parseInt(filtros.pagina, 10) || 1;
    const limite = parseInt(filtros.limite, 10) || 20;

    const { filas, total } = await this.catalogoRepository.listarProductos(filtros);

    const datos = filas.map((json) => {
      let precioDesde = null;
      let precioAnteriorDesde = null;
      let hayStock = false;

      if (json.variantes && json.variantes.length > 0) {
        // Comparación matemática segura
        const masBarata = json.variantes.reduce((min, v) =>
          Number(v.precio) < Number(min.precio) ? v : min
        );

        // Asignación de la cadena original devuelta por BD
        precioDesde = masBarata.precio;
        precioAnteriorDesde = masBarata.precioAnterior || null;
        hayStock = json.variantes.some((v) => v.stock > 0);
      }

      return {
        id: json.id,
        nombre: json.nombre,
        slug: json.slug,
        descripcionCorta: json.descripcionCorta,
        categoria: mapearCategoria(json.categoria),
        // Toma la primera imagen disponible (ya vienen ordenadas por orden de BD)
        imagen:
          json.imagenes && json.imagenes.length > 0
            ? { url: json.imagenes[0].url, alt: json.imagenes[0].alt }
            : null,
        precioDesde,
        precioAnteriorDesde,
        hayStock,
        destacado: json.destacado,
      };
    });

    return {
      datos,
      meta: { pagina, limite, total },
    };
  }

  /**
   * @description Obtiene la ficha completa de un producto y la mapea al contrato.
   * @param {string} slug - Slug del producto.
   * @returns {Promise<Object>} Producto con sus variantes e imágenes.
   * @throws {Error} NO_ENCONTRADO si no existe un producto activo con ese slug.
   */
  async obtenerProductoPorSlug(slug) {
    const json = await this.catalogoRepository.obtenerProductoPorSlug(slug);

    if (!json) {
      throw new Error("NO_ENCONTRADO");
    }

    // Mapeo estricto a ProductoDetalle
    return {
      id: json.id,
      nombre: json.nombre,
      slug: json.slug,
      descripcionCorta: json.descripcionCorta,
      descripcion: json.descripcion,
      ingredientes: json.ingredientes,
      modoUso: json.modoUso,
      destacado: json.destacado,
      categoria: mapearCategoria(json.categoria),
      imagenes: json.imagenes.map((img) => ({ url: img.url, alt: img.alt })),
      variantes: json.variantes.map((v) => ({
        id: v.id,
        nombre: v.nombre,
        sku: v.sku,
        precio: v.precio, // String original
        precioAnterior: v.precioAnterior || null,
        hayStock: v.stock > 0,
      })),
    };
  }
}

module.exports = CatalogoService;
