/**
 * Slugs que la tienda usa para sus propias rutas de primer nivel.
 *
 * Las colecciones viven en `/:slug`, así que una categoría con alguno de estos
 * slugs quedaría tapada por la ruta fija. Cada ruta nueva de primer nivel en
 * velua-web se agrega acá.
 */
const SLUGS_RESERVADOS = new Set([
  // Panel
  "admin",
  // Tienda (rutasTienda.tsx en velua-web)
  "productos",
  "buscar",
  "carrito",
  "checkout",
  "pedido",
  "la-marca",
  "arrepentimiento",
  "terminos",
  "privacidad",
  "cambios",
  "catalogo",
]);

/**
 * @description Indica si un slug está reservado por la tienda.
 * @param {string} slug - Slug ya normalizado.
 * @returns {boolean} true si no se puede usar para una categoría.
 */
const esSlugReservado = (slug) => SLUGS_RESERVADOS.has(slug);

module.exports = { SLUGS_RESERVADOS, esSlugReservado };