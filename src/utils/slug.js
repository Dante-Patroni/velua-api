/**
 * @description Letras que la normalización Unicode no descompone y hay que
 * reemplazar a mano. Aparecen en nombres franceses como "Cœur".
 */
const LIGADURAS = { œ: "oe", Œ: "oe", æ: "ae", Æ: "ae", ß: "ss" };

/**
 * @description Convierte un texto en un slug apto para URL.
 *
 * Quita acentos, pasa a minúsculas y reemplaza todo lo que no sea letra o número
 * por guiones. Los apóstrofes, tanto el recto (') como el tipográfico (’), cuentan
 * como separador: "L’Or de Calendula" da "l-or-de-calendula".
 *
 * @param {string} texto - Texto de origen, normalmente el nombre.
 * @param {number} [largoMaximo] - Largo máximo del slug. Si se corta, se corta en un guion.
 * @returns {string} Slug normalizado. Puede ser vacío si el texto no tenía letras ni números.
 */
const generarSlug = (texto, largoMaximo = 160) => {
  let slug = String(texto ?? "")
    .replace(/[œŒæÆß]/g, (c) => LIGADURAS[c])
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (slug.length > largoMaximo) {
    const cortado = slug.slice(0, largoMaximo);
    const ultimoGuion = cortado.lastIndexOf("-");
    slug = (ultimoGuion > 0 ? cortado.slice(0, ultimoGuion) : cortado).replace(/-+$/, "");
  }

  return slug;
};

/**
 * @description Devuelve un slug que no esté en uso, agregando -2, -3... si hace falta.
 * @param {string} base - Slug ya normalizado.
 * @param {(slug: string) => Promise<boolean>} existe - Indica si un slug ya está tomado.
 * @param {number} [largoMaximo] - Largo máximo, contando el sufijo.
 * @returns {Promise<string>} Slug libre.
 * @throws {Error} DATOS_INVALIDOS si la base es vacía.
 */
const generarSlugUnico = async (base, existe, largoMaximo = 160) => {
  if (!base) {
    throw new Error("DATOS_INVALIDOS");
  }

  if (!(await existe(base))) {
    return base;
  }

  for (let n = 2; n < 1000; n++) {
    const sufijo = `-${n}`;
    const candidato = base.slice(0, largoMaximo - sufijo.length).replace(/-+$/, "") + sufijo;
    if (!(await existe(candidato))) {
      return candidato;
    }
  }

  throw new Error("CONFLICTO_DE_DATOS");
};

module.exports = { generarSlug, generarSlugUnico };
