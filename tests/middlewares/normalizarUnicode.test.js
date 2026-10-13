const { normalizarUnicode, normalizarValor } = require("../../src/middlewares/normalizarUnicode");

// Escrito con escapes para que el editor no lo "arregle": son dos formas distintas.
const NFD = "Re\u0302ve de Feu"; // "e" + acento circunflejo combinable
const NFC = "R\u00eave de Feu"; // "ê" en un solo carácter

describe("normalizarValor", () => {
  it("parte de dos textos que se ven iguales pero son distintos", () => {
    expect(NFD).not.toBe(NFC);
    expect(NFD.length).toBe(NFC.length + 1);
  });

  it("lleva un texto NFD a NFC", () => {
    expect(normalizarValor(NFD)).toBe(NFC);
  });

  it("no toca un texto que ya está en NFC", () => {
    expect(normalizarValor(NFC)).toBe(NFC);
  });

  it("recorre objetos y arrays anidados", () => {
    const entrada = { nombre: NFD, variantes: [{ etiqueta: NFD }], tags: [NFD] };
    expect(normalizarValor(entrada)).toEqual({
      nombre: NFC,
      variantes: [{ etiqueta: NFC }],
      tags: [NFC],
    });
  });

  it.each([null, undefined, 42, true])("deja igual el valor %p", (valor) => {
    expect(normalizarValor(valor)).toBe(valor);
  });

  it("no normaliza la contraseña", () => {
    const { password, email } = normalizarValor({ password: NFD, email: NFD });
    expect(password).toBe(NFD);
    expect(email).toBe(NFC);
  });

  it("no contamina el prototipo con una clave __proto__", () => {
    const entrada = JSON.parse('{"__proto__": {"admin": true}}');
    normalizarValor(entrada);
    expect({}.admin).toBeUndefined();
  });
});

describe("normalizarUnicode (middleware)", () => {
  it("normaliza el body y sigue", () => {
    const req = { body: { nombre: NFD } };
    const next = jest.fn();
    normalizarUnicode(req, {}, next);
    expect(req.body.nombre).toBe(NFC);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("sigue aunque no haya body", () => {
    const req = {};
    const next = jest.fn();
    normalizarUnicode(req, {}, next);
    expect(req.body).toBeUndefined();
    expect(next).toHaveBeenCalledTimes(1);
  });
});
