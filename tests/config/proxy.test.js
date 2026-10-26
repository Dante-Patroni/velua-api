const { leerSaltosProxy, SALTOS_POR_DEFECTO } = require("../../src/config/proxy");

describe("leerSaltosProxy", () => {
  test("sin valor usa el de siempre", () => {
    expect(leerSaltosProxy(undefined)).toBe(SALTOS_POR_DEFECTO);
    expect(leerSaltosProxy("")).toBe(SALTOS_POR_DEFECTO);
    expect(SALTOS_POR_DEFECTO).toBe(1);
  });

  test("acepta un entero de 0 a 3", () => {
    expect(leerSaltosProxy("0")).toBe(0);
    expect(leerSaltosProxy("2")).toBe(2);
    expect(leerSaltosProxy(" 2 ")).toBe(2);
    expect(leerSaltosProxy("3")).toBe(3);
  });

  test.each(["true", "4", "-1", "1.5", "2e0", "0x2", "abc", "loopback", "1,2"])(
    "rechaza %p: la API no arranca",
    (valor) => {
      expect(() => leerSaltosProxy(valor)).toThrow("TRUST_PROXY_SALTOS");
    }
  );
});