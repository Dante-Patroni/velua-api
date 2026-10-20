const SequelizeUsuarioRepository = require("../../src/repositories/sequelize/SequelizeUsuarioRepository");

/**
 * @description Modelos falsos con los métodos que usa el repositorio.
 * @returns {Object} Diccionario de modelos con Usuario simulado.
 */
const crearModelos = () => ({
  Usuario: {
    findByPk: jest.fn(),
    update: jest.fn(),
  },
});

describe("SequelizeUsuarioRepository", () => {
  test("buscarSesion pide solo id, rol, activo y versionSesion, nunca el hash", async () => {
    const models = crearModelos();
    const fila = { id: 1, rol: "admin", activo: true, versionSesion: 0 };
    models.Usuario.findByPk.mockResolvedValue({ toJSON: () => fila });
    const repo = new SequelizeUsuarioRepository(models);

    const sesion = await repo.buscarSesion(1);

    expect(models.Usuario.findByPk).toHaveBeenCalledWith(1, {
      attributes: ["id", "rol", "activo", "versionSesion"],
    });
    expect(sesion).toEqual(fila);
  });

  test("buscarSesion devuelve null si el usuario no existe", async () => {
    const models = crearModelos();
    models.Usuario.findByPk.mockResolvedValue(null);
    const repo = new SequelizeUsuarioRepository(models);

    expect(await repo.buscarSesion(99)).toBeNull();
  });

  test("buscarConHash pide el hash junto con email y activo", async () => {
    const models = crearModelos();
    const fila = { id: 1, email: "a@b.com", activo: true, passwordHash: "hash" };
    models.Usuario.findByPk.mockResolvedValue({ toJSON: () => fila });
    const repo = new SequelizeUsuarioRepository(models);

    const usuario = await repo.buscarConHash(1);

    expect(models.Usuario.findByPk).toHaveBeenCalledWith(1, {
      attributes: ["id", "email", "activo", "passwordHash"],
    });
    expect(usuario).toEqual(fila);
  });

  test("cambiarContrasena guarda el hash e incrementa la versión en un solo UPDATE", async () => {
    const models = crearModelos();
    models.Usuario.update.mockResolvedValue([1]);
    const repo = new SequelizeUsuarioRepository(models);

    await repo.cambiarContrasena(7, "hash-nuevo");

    expect(models.Usuario.update).toHaveBeenCalledTimes(1);
    const [valores, opciones] = models.Usuario.update.mock.calls[0];
    expect(valores.passwordHash).toBe("hash-nuevo");
    expect(valores.versionSesion.val).toBe("version_sesion + 1");
    expect(opciones).toEqual({ where: { id: 7 } });
  });

  test("cambiarContrasena falla con NO_ENCONTRADO si no actualizó ninguna fila", async () => {
    const models = crearModelos();
    models.Usuario.update.mockResolvedValue([0]);
    const repo = new SequelizeUsuarioRepository(models);

    await expect(repo.cambiarContrasena(99, "hash")).rejects.toThrow("NO_ENCONTRADO");
  });
});