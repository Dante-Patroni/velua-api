/**
 * Integridad del contrato: cada `$ref` de docs/openapi.json tiene que apuntar a
 * algo que existe.
 *
 * Los tests de contrato de cada módulo comparan las respuestas con sus esquemas,
 * pero no validan el documento en sí. Así pasó el CI un contrato con cuatro
 * esquemas definidos en el lugar equivocado: las rutas los referenciaban y no
 * existían, y `npm run tipos` en velua-web fallaba. Este test lo detecta.
 */
const especificacion = require("../../docs/openapi.json");

/**
 * @description Junta todos los `$ref` del documento, recorriéndolo entero.
 * @param {*} nodo - Parte del documento.
 * @param {Set<string>} [encontradas] - Referencias acumuladas.
 * @returns {Set<string>} Todas las referencias.
 */
function referencias(nodo, encontradas = new Set()) {
  if (Array.isArray(nodo)) {
    for (const elemento of nodo) referencias(elemento, encontradas);
  } else if (nodo && typeof nodo === "object") {
    for (const [clave, valor] of Object.entries(nodo)) {
      if (clave === "$ref" && typeof valor === "string") encontradas.add(valor);
      else referencias(valor, encontradas);
    }
  }
  return encontradas;
}

/**
 * @description Sigue una referencia local ("#/components/schemas/X") dentro del documento.
 * @param {string} ref - Referencia.
 * @returns {*} Lo que hay en ese lugar, o undefined si no existe.
 */
const resolver = (ref) =>
  ref
    .slice(2)
    .split("/")
    .reduce((nodo, parte) => (nodo && Object.hasOwn(nodo, parte) ? nodo[parte] : undefined), especificacion);

describe("Integridad del contrato", () => {
  test("todas las referencias son locales", () => {
    const externas = [...referencias(especificacion)].filter((ref) => !ref.startsWith("#/"));
    expect(externas).toEqual([]);
  });

  test("cada $ref apunta a algo que existe", () => {
    const rotas = [...referencias(especificacion)].filter((ref) => resolver(ref) === undefined);
    expect(rotas).toEqual([]);
  });

  test("los esquemas de preparación y cancelación están en components.schemas", () => {
    for (const nombre of [
      "PreparacionEntrada",
      "PreparacionResultado",
      "CancelacionEntrada",
      "CancelacionResultado",
    ]) {
      expect(Object.hasOwn(especificacion.components.schemas, nombre)).toBe(true);
    }
  });
});
