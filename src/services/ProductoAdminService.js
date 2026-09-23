const { generarSlug, generarSlugUnico } = require("../utils/slug");

const LARGO_SLUG = 160;

/**
 * @description Crea un error de datos inválidos con el detalle por campo.
 * @param {Object} details - Mensajes por campo.
 * @returns {Error} Error con details adjunto, que el errorMapper incluye en la respuesta.
 */
const datosInvalidos = (details) => {
  const error = new Error("DATOS_INVALIDOS");
  error.details = details;
  return error;
};

/**
 * @description Normaliza un importe a cadena con dos decimales, sin convertirlo
 * nunca a número: el redondeo en punto flotante sobre dinero es exactamente lo
 * que la regla del proyecto prohíbe.
 * @param {string|number} valor - Importe ingresado.
 * @param {string} campo - Nombre del campo, para el mensaje de error.
 * @returns {string} Importe con dos decimales, por ejemplo "8500.00".
 * @throws {Error} DATOS_INVALIDOS si no tiene forma de importe.
 */
const normalizarImporte = (valor, campo) => {
  const texto = String(valor).trim();
  if (!/^\d{1,10}([.,]\d{1,2})?$/.test(texto)) {
    throw datosInvalidos({ [campo]: "Tiene que ser un importe con hasta dos decimales" });
  }
  const [entera, decimal = ""] = texto.replace(",", ".").split(".");
  return `${entera}.${decimal.padEnd(2, "0")}`;
};

/**
 * @description Compara dos importes normalizados sin usar punto flotante.
 * @param {string} a - Primer importe.
 * @param {string} b - Segundo importe.
 * @returns {number} Negativo si a es menor, cero si son iguales, positivo si a es mayor.
 */
const compararImportes = (a, b) => {
  /**
   * @description Convierte un importe con dos decimales a su valor en centavos.
   * @param {string} v - Importe normalizado.
   * @returns {bigint} Centavos como entero grande.
   */
  const enteros = (v) => BigInt(v.replace(".", ""));

  const diferencia = enteros(a) - enteros(b);
  return diferencia === 0n ? 0 : diferencia < 0n ? -1 : 1;
};

/**
 * @description Recorta una variante al formato del panel. A diferencia de la
 * tienda, acá sí se expone el stock real y el estado.
 * @param {Object} variante - Variante cruda del repositorio.
 * @returns {Object} Variante con los campos del panel.
 */
const mapearVarianteAdmin = (variante) => ({
  id: variante.id,
  nombre: variante.nombre,
  sku: variante.sku ?? null,
  precio: variante.precio,
  precioAnterior: variante.precioAnterior ?? null,
  stock: Number(variante.stock),
  pesoGramos: variante.pesoGramos ?? null,
  activa: Boolean(variante.activa),
});

/**
 * @description Recorta un producto a la ficha que muestra el panel.
 * @param {Object} producto - Producto crudo con categoría, variantes e imágenes.
 * @returns {Object} Producto con los campos del panel.
 */
const mapearProductoAdmin = (producto) => ({
  id: producto.id,
  nombre: producto.nombre,
  slug: producto.slug,
  descripcionCorta: producto.descripcionCorta ?? null,
  descripcion: producto.descripcion ?? null,
  ingredientes: producto.ingredientes ?? null,
  modoUso: producto.modoUso ?? null,
  activo: Boolean(producto.activo),
  destacado: Boolean(producto.destacado),
  categoria: producto.categoria
    ? {
        id: producto.categoria.id,
        nombre: producto.categoria.nombre,
        slug: producto.categoria.slug,
      }
    : null,
  variantes: (producto.variantes ?? []).map(mapearVarianteAdmin),
  imagenes: (producto.imagenes ?? []).map((i) => ({
    id: i.id,
    url: i.url,
    alt: i.alt ?? null,
    orden: i.orden,
  })),
});

/**
 * @description Recorta un producto a la fila que muestra la grilla del panel.
 * @param {Object} producto - Producto crudo con sus totales.
 * @returns {Object} Fila de la grilla.
 */
const mapearFilaAdmin = (producto) => ({
  id: producto.id,
  nombre: producto.nombre,
  slug: producto.slug,
  descripcionCorta: producto.descripcionCorta ?? null,
  activo: Boolean(producto.activo),
  destacado: Boolean(producto.destacado),
  categoria: producto.categoria
    ? {
        id: producto.categoria.id,
        nombre: producto.categoria.nombre,
        slug: producto.categoria.slug,
      }
    : null,
  cantidadVariantes: Number(producto.cantidadVariantes ?? 0),
  precioDesde: producto.precioDesde ?? null,
  stockTotal: Number(producto.stockTotal ?? 0),
  cantidadImagenes: Number(producto.cantidadImagenes ?? 0),
});

/**
 * @description Servicio de administración de productos y sus variantes.
 */
class ProductoAdminService {
  /**
   * @description Instancia el servicio inyectando el repositorio.
   * @param {Object} productoRepository - Implementación de ProductoRepository.
   */
  constructor(productoRepository) {
    this.productoRepository = productoRepository;
  }

  /**
   * @description Lista productos paginados para la grilla del panel.
   * @param {Object} filtros - pagina, limite, q, categoriaId, estado y orden.
   * @returns {Promise<{datos: Array<Object>, meta: Object}>} Filas y paginación.
   */
  async listar(filtros = {}) {
    const pagina = parseInt(filtros.pagina, 10) || 1;
    const limite = parseInt(filtros.limite, 10) || 20;

    const { filas, total } = await this.productoRepository.listar(filtros);

    return { datos: filas.map(mapearFilaAdmin), meta: { pagina, limite, total } };
  }

  /**
   * @description Obtiene la ficha completa de un producto.
   * @param {number} id - Id del producto.
   * @returns {Promise<Object>} Producto con variantes e imágenes.
   * @throws {Error} NO_ENCONTRADO
   */
  async obtener(id) {
    const producto = await this.productoRepository.buscarPorId(id);
    if (!producto) {
      throw new Error("NO_ENCONTRADO");
    }
    return mapearProductoAdmin(producto);
  }

  /**
   * @description Crea un producto con sus variantes. El esquema exige al menos
   * una, así que las dos cosas se crean juntas en una transacción.
   * @param {Object} datos - Datos del producto.
   * @param {number} datos.categoriaId - Categoría a la que pertenece.
   * @param {string} datos.nombre - Nombre visible.
   * @param {string} [datos.slug] - Slug elegido a mano.
   * @param {string} [datos.descripcionCorta] - Una línea para la grilla.
   * @param {string} [datos.descripcion] - Párrafo de la ficha.
   * @param {string} [datos.ingredientes] - Listado de la etiqueta.
   * @param {string} [datos.modoUso] - Cómo se usa.
   * @param {boolean} [datos.destacado] - Si aparece en la portada.
   * @param {Array<Object>} datos.variantes - Variantes, al menos una.
   * @returns {Promise<Object>} Producto creado.
   * @throws {Error} DATOS_INVALIDOS, SIN_VARIANTES, CONFLICTO_DE_DATOS
   */
  async crear({
    categoriaId,
    nombre,
    slug,
    descripcionCorta,
    descripcion,
    ingredientes,
    modoUso,
    destacado = false,
    variantes,
  }) {
    if (!Array.isArray(variantes) || variantes.length === 0) {
      throw new Error("SIN_VARIANTES");
    }
    if (!(await this.productoRepository.existeCategoria(categoriaId))) {
      throw datosInvalidos({ categoriaId: "La categoría no existe" });
    }

    const preparadas = [];
    for (const [i, variante] of variantes.entries()) {
      preparadas.push(this.#prepararVariante(variante, i));
    }
    this.#verificarSkusRepetidos(preparadas);

    const slugFinal = slug
      ? await this.#slugElegido(slug)
      : await generarSlugUnico(
          generarSlug(nombre, LARGO_SLUG),
          (s) => this.productoRepository.existeSlug(s),
          LARGO_SLUG
        );

    const creado = await this.productoRepository.crearConVariantes(
      {
        categoriaId,
        nombre: nombre.trim(),
        slug: slugFinal,
        descripcionCorta: descripcionCorta?.trim() || null,
        descripcion: descripcion?.trim() || null,
        ingredientes: ingredientes?.trim() || null,
        modoUso: modoUso?.trim() || null,
        activo: true,
        destacado: Boolean(destacado),
      },
      preparadas
    );

    return this.obtener(creado.id);
  }

  /**
   * @description Edita los datos de un producto. No toca las variantes: cada una
   * tiene sus propios endpoints. Cambiar el nombre no cambia el slug.
   * @param {number} id - Id del producto.
   * @param {Object} cambios - Campos a modificar.
   * @param {number} [cambios.categoriaId] - Categoría nueva.
   * @param {string} [cambios.nombre] - Nombre visible.
   * @param {string} [cambios.slug] - Slug nuevo, solo si se edita a propósito.
   * @param {string} [cambios.descripcionCorta] - Una línea para la grilla.
   * @param {string} [cambios.descripcion] - Párrafo de la ficha.
   * @param {string} [cambios.ingredientes] - Listado de la etiqueta.
   * @param {string} [cambios.modoUso] - Cómo se usa.
   * @param {boolean} [cambios.destacado] - Si aparece en la portada.
   * @returns {Promise<Object>} Producto actualizado.
   * @throws {Error} NO_ENCONTRADO, DATOS_INVALIDOS, CONFLICTO_DE_DATOS
   */
  async actualizar(id, cambios) {
    const actual = await this.productoRepository.buscarPorId(id);
    if (!actual) {
      throw new Error("NO_ENCONTRADO");
    }

    const aplicar = {};
    const textos = ["nombre", "descripcionCorta", "descripcion", "ingredientes", "modoUso"];
    for (const campo of textos) {
      if (cambios[campo] !== undefined) {
        aplicar[campo] = cambios[campo]?.trim() || (campo === "nombre" ? undefined : null);
      }
    }
    if (cambios.destacado !== undefined) {
      aplicar.destacado = Boolean(cambios.destacado);
    }
    if (cambios.categoriaId !== undefined && cambios.categoriaId !== actual.categoriaId) {
      if (!(await this.productoRepository.existeCategoria(cambios.categoriaId))) {
        throw datosInvalidos({ categoriaId: "La categoría no existe" });
      }
      aplicar.categoriaId = cambios.categoriaId;
    }
    if (cambios.slug !== undefined && cambios.slug !== actual.slug) {
      aplicar.slug = await this.#slugElegido(cambios.slug, id);
    }

    if (Object.keys(aplicar).length > 0) {
      await this.productoRepository.actualizar(id, aplicar);
    }

    return this.obtener(id);
  }

  /**
   * @description Publica o despublica un producto.
   * @param {number} id - Id del producto.
   * @param {boolean} activo - Estado nuevo.
   * @returns {Promise<Object>} Producto con su estado nuevo.
   * @throws {Error} NO_ENCONTRADO
   */
  async cambiarEstado(id, activo) {
    const actual = await this.productoRepository.buscarPorId(id);
    if (!actual) {
      throw new Error("NO_ENCONTRADO");
    }
    if (Boolean(actual.activo) !== activo) {
      await this.productoRepository.actualizar(id, { activo });
    }
    return this.obtener(id);
  }

  /**
   * @description Agrega una variante a un producto existente.
   * @param {number} productoId - Id del producto.
   * @param {Object} datos - Datos de la variante.
   * @returns {Promise<Object>} Producto con la variante nueva.
   * @throws {Error} NO_ENCONTRADO, DATOS_INVALIDOS, CONFLICTO_DE_DATOS
   */
  async agregarVariante(productoId, datos) {
    const producto = await this.productoRepository.buscarPorId(productoId);
    if (!producto) {
      throw new Error("NO_ENCONTRADO");
    }

    const preparada = this.#prepararVariante(datos, 0);
    if (preparada.sku && (await this.productoRepository.existeSku(preparada.sku))) {
      throw new Error("CONFLICTO_DE_DATOS");
    }

    await this.productoRepository.crearVariante(productoId, preparada);
    return this.obtener(productoId);
  }

  /**
   * @description Edita una variante de un producto.
   * @param {number} productoId - Id del producto.
   * @param {number} varianteId - Id de la variante.
   * @param {Object} cambios - Campos a modificar.
   * @returns {Promise<Object>} Producto con la variante actualizada.
   * @throws {Error} NO_ENCONTRADO, DATOS_INVALIDOS, CONFLICTO_DE_DATOS
   */
  async actualizarVariante(productoId, varianteId, cambios) {
    const producto = await this.productoRepository.buscarPorId(productoId);
    if (!producto) {
      throw new Error("NO_ENCONTRADO");
    }

    const variante = (producto.variantes ?? []).find((v) => v.id === Number(varianteId));
    if (!variante) {
      throw new Error("NO_ENCONTRADO");
    }

    const aplicar = {};
    if (cambios.nombre !== undefined) aplicar.nombre = cambios.nombre.trim();
    if (cambios.stock !== undefined) aplicar.stock = this.#stockValido(cambios.stock);
    if (cambios.pesoGramos !== undefined) {
      aplicar.pesoGramos = cambios.pesoGramos === null ? null : Number(cambios.pesoGramos);
    }

    if (cambios.sku !== undefined) {
      const sku = cambios.sku?.trim() || null;
      if (sku && (await this.productoRepository.existeSku(sku, varianteId))) {
        throw new Error("CONFLICTO_DE_DATOS");
      }
      aplicar.sku = sku;
    }

    const precio =
      cambios.precio !== undefined ? normalizarImporte(cambios.precio, "precio") : variante.precio;
    if (cambios.precio !== undefined) {
      aplicar.precio = precio;
    }
    if (cambios.precioAnterior !== undefined) {
      aplicar.precioAnterior =
        cambios.precioAnterior === null
          ? null
          : this.#precioAnteriorValido(cambios.precioAnterior, precio);
    }

    if (Object.keys(aplicar).length > 0) {
      await this.productoRepository.actualizarVariante(varianteId, aplicar);
    }

    return this.obtener(productoId);
  }

  /**
   * @description Activa o desactiva una variante. No se borra nunca: los pedidos
   * históricos la referencian, y desactivada desaparece de la tienda sin perder
   * el vínculo. Tampoco se puede desactivar la última activa, porque dejaría un
   * producto visible que no se puede comprar.
   * @param {number} productoId - Id del producto.
   * @param {number} varianteId - Id de la variante.
   * @param {boolean} activa - Estado nuevo.
   * @returns {Promise<Object>} Producto con la variante actualizada.
   * @throws {Error} NO_ENCONTRADO, ULTIMA_VARIANTE_ACTIVA
   */
  async cambiarEstadoVariante(productoId, varianteId, activa) {
    const producto = await this.productoRepository.buscarPorId(productoId);
    if (!producto) {
      throw new Error("NO_ENCONTRADO");
    }

    const variantes = producto.variantes ?? [];
    const variante = variantes.find((v) => v.id === Number(varianteId));
    if (!variante) {
      throw new Error("NO_ENCONTRADO");
    }

    const activas = variantes.filter((v) => Boolean(v.activa));
    if (!activa && activas.length === 1 && Boolean(variante.activa)) {
      throw new Error("ULTIMA_VARIANTE_ACTIVA");
    }

    if (Boolean(variante.activa) !== activa) {
      await this.productoRepository.actualizarVariante(varianteId, { activa });
    }

    return this.obtener(productoId);
  }

  /**
   * @description Valida y normaliza los datos de una variante.
   * @param {Object} variante - Datos ingresados.
   * @param {number} indice - Posición en la lista, para el mensaje de error.
   * @returns {Object} Variante lista para guardar.
   * @throws {Error} DATOS_INVALIDOS
   */
  #prepararVariante(variante, indice) {
    const prefijo = `variantes[${indice}]`;

    if (!variante?.nombre || !String(variante.nombre).trim()) {
      throw datosInvalidos({ [`${prefijo}.nombre`]: "El nombre de la variante es obligatorio" });
    }

    const precio = normalizarImporte(variante.precio, `${prefijo}.precio`);
    const precioAnterior =
      variante.precioAnterior === undefined || variante.precioAnterior === null
        ? null
        : this.#precioAnteriorValido(variante.precioAnterior, precio, prefijo);

    return {
      nombre: String(variante.nombre).trim(),
      sku: variante.sku?.trim() || null,
      precio,
      precioAnterior,
      stock: this.#stockValido(variante.stock, prefijo),
      pesoGramos:
        variante.pesoGramos === null || variante.pesoGramos === undefined
          ? null
          : Number(variante.pesoGramos),
      activa: true,
    };
  }

  /**
   * @description Valida que el precio anterior sea mayor que el actual. Si fuera
   * igual o menor, la tienda mostraría un descuento de cero por ciento: es el
   * error que tienen en producción las dos tiendas del rubro que miramos.
   * @param {string|number} valor - Precio anterior ingresado.
   * @param {string} precio - Precio actual ya normalizado.
   * @param {string} [prefijo] - Prefijo del campo, para el mensaje de error.
   * @returns {string} Precio anterior normalizado.
   * @throws {Error} DATOS_INVALIDOS
   */
  #precioAnteriorValido(valor, precio, prefijo = "") {
    const campo = prefijo ? `${prefijo}.precioAnterior` : "precioAnterior";
    const anterior = normalizarImporte(valor, campo);
    if (compararImportes(anterior, precio) <= 0) {
      throw datosInvalidos({
        [campo]:
          "Tiene que ser mayor que el precio actual, si no la oferta sería de cero por ciento",
      });
    }
    return anterior;
  }

  /**
   * @description Valida el stock ingresado.
   * @param {number|string} valor - Stock ingresado.
   * @param {string} [prefijo] - Prefijo del campo, para el mensaje de error.
   * @returns {number} Stock como entero.
   * @throws {Error} DATOS_INVALIDOS
   */
  #stockValido(valor, prefijo = "") {
    const campo = prefijo ? `${prefijo}.stock` : "stock";
    const numero = Number(valor ?? 0);
    if (!Number.isInteger(numero) || numero < 0) {
      throw datosInvalidos({ [campo]: "Tiene que ser un número entero de cero o más" });
    }
    return numero;
  }

  /**
   * @description Verifica que no haya SKU repetidos dentro de la misma carga.
   * @param {Array<Object>} variantes - Variantes ya preparadas.
   * @returns {void}
   * @throws {Error} DATOS_INVALIDOS
   */
  #verificarSkusRepetidos(variantes) {
    const skus = variantes.map((v) => v.sku).filter(Boolean);
    if (new Set(skus).size !== skus.length) {
      throw datosInvalidos({ variantes: "Hay SKU repetidos entre las variantes" });
    }
  }

  /**
   * @description Normaliza un slug elegido a mano y verifica que esté libre.
   * @param {string} slug - Slug ingresado.
   * @param {number} [excluirId] - Id del producto que se está editando.
   * @returns {Promise<string>} Slug normalizado.
   * @throws {Error} DATOS_INVALIDOS, CONFLICTO_DE_DATOS
   */
  async #slugElegido(slug, excluirId) {
    const normalizado = generarSlug(slug, LARGO_SLUG);
    if (!normalizado) {
      throw datosInvalidos({ slug: "El slug no puede quedar vacío" });
    }
    if (await this.productoRepository.existeSlug(normalizado, excluirId)) {
      throw new Error("CONFLICTO_DE_DATOS");
    }
    return normalizado;
  }
}

module.exports = ProductoAdminService;
