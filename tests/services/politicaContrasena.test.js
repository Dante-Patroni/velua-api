const { motivoDeRechazo, MENSAJES_RECHAZO } = require("../../src/services/politicaContrasena");

const CONTEXTO = { actual: "la-clave-de-antes-99", email: "duena@veluanature.com.ar" };

describe("politicaContrasena", () => {
  it("acepta una frase larga que no es común", () => {
    expect(motivoDeRechazo("lavanda en el patio de atras", CONTEXTO)).toBeNull();
  });

  it("rechaza 11 caracteres y acepta 12", () => {
    expect(motivoDeRechazo("pqzw-lunar7", CONTEXTO)).toBe("MUY_CORTA");
    expect(motivoDeRechazo("pqzw-lunar-7", CONTEXTO)).toBeNull();
  });

  it("cuenta caracteres, no bytes, para el mínimo", () => {
    // 12 caracteres, 24 bytes
    expect(motivoDeRechazo("ñ".repeat(12), CONTEXTO)).toBeNull();
  });

  it("rechaza lo que no es texto", () => {
    expect(motivoDeRechazo(undefined, CONTEXTO)).toBe("MUY_CORTA");
    expect(motivoDeRechazo(123456789012, CONTEXTO)).toBe("MUY_CORTA");
  });

  it("acepta 72 bytes y rechaza 73", () => {
    expect(motivoDeRechazo("x".repeat(72), CONTEXTO)).toBeNull();
    expect(motivoDeRechazo("x".repeat(73), CONTEXTO)).toBe("MUY_LARGA");
  });

  it("mide el máximo en bytes: 37 eñes son 74 bytes", () => {
    expect(motivoDeRechazo("ñ".repeat(37), CONTEXTO)).toBe("MUY_LARGA");
  });

  it("rechaza la misma contraseña que la actual", () => {
    expect(motivoDeRechazo("la-clave-de-antes-99", CONTEXTO)).toBe("IGUAL_A_LA_ACTUAL");
  });

  it("rechaza una contraseña de la lista de comunes", () => {
    expect(motivoDeRechazo("111111111111", CONTEXTO)).toBe("MUY_COMUN");
  });

  it("compara con la lista sin distinguir mayúsculas", () => {
    expect(motivoDeRechazo("1111111111ZZ", CONTEXTO)).toBe("MUY_COMUN");
  });

  it("rechaza si contiene el usuario del mail", () => {
    expect(motivoDeRechazo("Duena-de-la-marca-2026", CONTEXTO)).toBe("CONTIENE_EL_MAIL");
  });

  it("rechaza si contiene el nombre de la marca", () => {
    expect(motivoDeRechazo("mi-tienda-VELUA-2026", CONTEXTO)).toBe("CONTIENE_EL_NOMBRE_DEL_SITIO");
  });

  it("tiene un mensaje para cada motivo", () => {
    const motivos = [
      "MUY_CORTA",
      "MUY_LARGA",
      "IGUAL_A_LA_ACTUAL",
      "MUY_COMUN",
      "CONTIENE_EL_MAIL",
      "CONTIENE_EL_NOMBRE_DEL_SITIO",
    ];
    motivos.forEach((motivo) => expect(MENSAJES_RECHAZO[motivo]).toEqual(expect.any(String)));
  });
});
