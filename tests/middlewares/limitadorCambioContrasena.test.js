const {
  clavePorUsuaria,
  noFueContrasenaIncorrecta,
} = require("../../src/middlewares/rateLimitMiddleware");

describe("limitador del cambio de contraseña", () => {
  it("cuenta por usuaria, no por IP", () => {
    const deUnaIp = { usuario: { id: 7 }, ip: "1.1.1.1" };
    const deOtraIp = { usuario: { id: 7 }, ip: "2.2.2.2" };

    expect(clavePorUsuaria(deUnaIp)).toBe("usuario:7");
    expect(clavePorUsuaria(deOtraIp)).toBe(clavePorUsuaria(deUnaIp));
  });

  it("separa el contador de cada usuaria", () => {
    expect(clavePorUsuaria({ usuario: { id: 7 } })).not.toBe(
      clavePorUsuaria({ usuario: { id: 8 } })
    );
  });

  it("suma al contador el intento con la contraseña actual incorrecta", () => {
    const res = { locals: { contrasenaActualIncorrecta: true } };

    expect(noFueContrasenaIncorrecta({}, res)).toBe(false);
  });

  it("no suma los rechazos de la política ni los cambios exitosos", () => {
    expect(noFueContrasenaIncorrecta({}, { locals: {} })).toBe(true);
  });
});
