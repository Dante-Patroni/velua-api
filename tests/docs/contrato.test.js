const definicionBase = require("../../src/docs/definicionBase");
const contratoPublicado = require("../../docs/openapi.json");

/**
 * @description Recorre todo el contrato y junta los campos que figuran en
 * `required` pero no están declarados en `properties`. El generador de tipos
 * del frontend solo emite lo declarado, así que esos campos desaparecen.
 * @param {*} nodo - Parte del contrato a revisar.
 * @param {string} ruta - Dónde está el nodo, para el mensaje de error.
 * @param {string[]} problemas - Acumulador de problemas encontrados.
 * @returns {string[]} Los problemas, como "ruta: campo".
 */
const camposSinDeclarar = (nodo, ruta, problemas = []) => {
  if (Array.isArray(nodo)) {
    nodo.forEach((hijo, i) => camposSinDeclarar(hijo, `${ruta}[${i}]`, problemas));
    return problemas;
  }
  if (!nodo || typeof nodo !== "object") {
    return problemas;
  }
  if (Array.isArray(nodo.required)) {
    const declarados = Object.keys(nodo.properties ?? {});
    nodo.required
      .filter((campo) => !declarados.includes(campo))
      .forEach((campo) => problemas.push(`${ruta}: ${campo}`));
  }
  Object.entries(nodo).forEach(([clave, valor]) =>
    camposSinDeclarar(valor, `${ruta}.${clave}`, problemas)
  );
  return problemas;
};

describe("contrato OpenAPI", () => {
  test("los esquemas de definicionBase declaran todo lo que exigen", () => {
    expect(camposSinDeclarar(definicionBase.components, "components")).toEqual([]);
  });

  test("el openapi.json publicado declara todo lo que exige", () => {
    expect(camposSinDeclarar(contratoPublicado, "openapi")).toEqual([]);
  });
});