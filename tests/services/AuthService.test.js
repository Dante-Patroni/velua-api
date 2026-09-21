const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { AuthService } = require("../../src/services/AuthService");

const SECRETO = "secreto-solo-para-tests";

// Costo bajo para que los tests corran rapido. El servicio usa el suyo.
const hashDe = (texto) => bcrypt.hashSync(texto, 4);

/**
 * Construye un usuario como lo devuelve el repositorio, con su hash.
 */
const usuarioCrudo = (cambios = {}) => ({
  id: 7,
  nombre: "Dueña de la marca",
  email: "duena@velua.com.ar",
  passwordHash: hashDe("clave-correcta"),
  rol: "admin",
  activo: true,
  ultimoAcceso: null,
  creadoEn: "2026-09-01T10:00:00.000Z",
  ...cambios,
});

describe("AuthService", () => {
  let servicio;
  let repositorio;

  beforeEach(() => {
    repositorio = {
      buscarPorEmail: jest.fn(),
      buscarPorId: jest.fn(),
      registrarAcceso: jest.fn().mockResolvedValue(undefined),
    };
    servicio = new AuthService(repositorio, { jwtSecret: SECRETO, duracion: "8h" });
  });

  describe("login", () => {
    it("devuelve un token y los datos del usuario con credenciales correctas", async () => {
      repositorio.buscarPorEmail.mockResolvedValue(usuarioCrudo());

      const { token, usuario } = await servicio.login("duena@velua.com.ar", "clave-correcta");

      expect(typeof token).toBe("string");
      expect(usuario.email).toBe("duena@velua.com.ar");
    });

    it("nunca devuelve el hash de la contraseña", async () => {
      repositorio.buscarPorEmail.mockResolvedValue(usuarioCrudo());

      const { usuario } = await servicio.login("duena@velua.com.ar", "clave-correcta");

      expect(usuario).not.toHaveProperty("passwordHash");
    });

    it("no filtra campos internos del usuario", async () => {
      repositorio.buscarPorEmail.mockResolvedValue(usuarioCrudo());

      const { usuario } = await servicio.login("duena@velua.com.ar", "clave-correcta");

      expect(usuario).not.toHaveProperty("activo");
      expect(usuario).not.toHaveProperty("ultimoAcceso");
      expect(usuario).not.toHaveProperty("creadoEn");
    });

    it("normaliza el mail a minúsculas y sin espacios antes de buscar", async () => {
      repositorio.buscarPorEmail.mockResolvedValue(usuarioCrudo());

      await servicio.login("  Duena@VELUA.com.ar  ", "clave-correcta");

      expect(repositorio.buscarPorEmail).toHaveBeenCalledWith("duena@velua.com.ar");
    });

    it("rechaza un mail inexistente con CREDENCIALES_INVALIDAS", async () => {
      repositorio.buscarPorEmail.mockResolvedValue(null);

      await expect(servicio.login("nadie@velua.com.ar", "lo-que-sea")).rejects.toThrow(
        "CREDENCIALES_INVALIDAS"
      );
    });

    it("rechaza una contraseña incorrecta con el mismo código", async () => {
      // Mismo codigo que el mail inexistente: no se puede distinguir cual fallo
      repositorio.buscarPorEmail.mockResolvedValue(usuarioCrudo());

      await expect(servicio.login("duena@velua.com.ar", "clave-mal")).rejects.toThrow(
        "CREDENCIALES_INVALIDAS"
      );
    });

    it("rechaza a un usuario inactivo aunque la contraseña sea correcta", async () => {
      repositorio.buscarPorEmail.mockResolvedValue(usuarioCrudo({ activo: false }));

      await expect(servicio.login("duena@velua.com.ar", "clave-correcta")).rejects.toThrow(
        "USUARIO_INACTIVO"
      );
    });

    it("no revela que el usuario está inactivo si la contraseña es incorrecta", async () => {
      repositorio.buscarPorEmail.mockResolvedValue(usuarioCrudo({ activo: false }));

      await expect(servicio.login("duena@velua.com.ar", "clave-mal")).rejects.toThrow(
        "CREDENCIALES_INVALIDAS"
      );
    });

    it("registra el acceso solo cuando el login sale bien", async () => {
      repositorio.buscarPorEmail.mockResolvedValue(usuarioCrudo());

      await servicio.login("duena@velua.com.ar", "clave-correcta");

      expect(repositorio.registrarAcceso).toHaveBeenCalledWith(7);
    });

    it("no registra el acceso cuando el login falla", async () => {
      repositorio.buscarPorEmail.mockResolvedValue(usuarioCrudo());

      await expect(servicio.login("duena@velua.com.ar", "clave-mal")).rejects.toThrow();

      expect(repositorio.registrarAcceso).not.toHaveBeenCalled();
    });

    it("firma un token con id, rol y permisos", async () => {
      repositorio.buscarPorEmail.mockResolvedValue(usuarioCrudo());

      const { token } = await servicio.login("duena@velua.com.ar", "clave-correcta");
      const contenido = jwt.verify(token, SECRETO);

      expect(contenido.id).toBe(7);
      expect(contenido.rol).toBe("admin");
      expect(contenido.permisos).toEqual(expect.arrayContaining(["CATALOGO_EDITAR"]));
    });

    it("no mete el hash ni el mail dentro del token", async () => {
      repositorio.buscarPorEmail.mockResolvedValue(usuarioCrudo());

      const { token } = await servicio.login("duena@velua.com.ar", "clave-correcta");
      const contenido = jwt.verify(token, SECRETO);

      expect(contenido).not.toHaveProperty("passwordHash");
      expect(contenido).not.toHaveProperty("email");
    });

    it("el token expira", async () => {
      repositorio.buscarPorEmail.mockResolvedValue(usuarioCrudo());

      const { token } = await servicio.login("duena@velua.com.ar", "clave-correcta");
      const contenido = jwt.verify(token, SECRETO);

      expect(contenido.exp).toBeGreaterThan(contenido.iat);
    });

    it("un operador no recibe permisos de dinero ni de usuarios", async () => {
      repositorio.buscarPorEmail.mockResolvedValue(usuarioCrudo({ rol: "operador" }));

      const { usuario } = await servicio.login("duena@velua.com.ar", "clave-correcta");

      expect(usuario.permisos).not.toContain("PAGOS_DEVOLVER");
      expect(usuario.permisos).not.toContain("USUARIOS_GESTIONAR");
      expect(usuario.permisos).toContain("CATALOGO_EDITAR");
    });
  });

  describe("obtenerUsuarioActual", () => {
    it("devuelve el usuario con sus permisos", async () => {
      const sinHash = usuarioCrudo();
      delete sinHash.passwordHash;
      repositorio.buscarPorId.mockResolvedValue(sinHash);

      const usuario = await servicio.obtenerUsuarioActual(7);

      expect(usuario.id).toBe(7);
      expect(usuario.permisos.length).toBeGreaterThan(0);
    });

    it("rechaza con NO_AUTORIZADO si el usuario ya no existe", async () => {
      repositorio.buscarPorId.mockResolvedValue(null);

      await expect(servicio.obtenerUsuarioActual(99)).rejects.toThrow("NO_AUTORIZADO");
    });

    it("rechaza a un usuario desactivado aunque su token siga vigente", async () => {
      // Sin esta verificacion, alguien desactivado seguiria entrando hasta que expire el token
      repositorio.buscarPorId.mockResolvedValue(usuarioCrudo({ activo: false }));

      await expect(servicio.obtenerUsuarioActual(7)).rejects.toThrow("USUARIO_INACTIVO");
    });
  });
});
