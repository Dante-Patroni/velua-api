const { ENTORNOS_DE_DESARROLLO, exigirEntornoDeDesarrollo } = require("../../src/config/soloDesarrollo");
const catalogo = require("../../src/seeders/20260918000001-catalogo-inicial");
const pedidos = require("../../src/seeders/20261004000001-pedidos-de-prueba");
const usuario = require("../../src/seeders/20260921000001-usuario-inicial");
const operador = require("../../src/seeders/20261103000001-usuario-operador-prueba");

describe("exigirEntornoDeDesarrollo", () => {
  test("permite desarrollo y pruebas", () => {
    expect(() => exigirEntornoDeDesarrollo("x", { NODE_ENV: "development" })).not.toThrow();
    expect(() => exigirEntornoDeDesarrollo("x", { NODE_ENV: "test" })).not.toThrow();
  });

  test("rechaza producción", () => {
    expect(() => exigirEntornoDeDesarrollo("x", { NODE_ENV: "production" })).toThrow();
  });

  test("rechaza si NODE_ENV no está definido: falla cerrado", () => {
    expect(() => exigirEntornoDeDesarrollo("x", {})).toThrow(/sin definir/);
  });

  test("rechaza cualquier otro valor, aunque se parezca", () => {
    for (const NODE_ENV of ["staging", "Production", "Development", " development", ""]) {
      expect(() => exigirEntornoDeDesarrollo("x", { NODE_ENV })).toThrow();
    }
  });

  test("el mensaje dice qué se intentó y en qué entorno", () => {
    expect(() => exigirEntornoDeDesarrollo("Vaciar el catálogo", { NODE_ENV: "production" })).toThrow(
      "Vaciar el catálogo: solo se permite con NODE_ENV=development o test (ahora: production)",
    );
  });

  test("la lista no se puede modificar", () => {
    expect(() => ENTORNOS_DE_DESARROLLO.push("production")).toThrow(TypeError);
  });
});

describe("seeders en producción", () => {
  const original = process.env.NODE_ENV;
  const queryInterface = () => ({
    bulkInsert: jest.fn(),
    bulkDelete: jest.fn(),
    sequelize: { query: jest.fn(async () => [{ id: 1 }]), QueryTypes: { SELECT: "SELECT" } },
  });

  beforeEach(() => {
    process.env.NODE_ENV = "production";
  });
  afterEach(() => {
    process.env.NODE_ENV = original;
  });

  test("el catálogo de ejemplo no se carga", async () => {
    const qi = queryInterface();
    await expect(catalogo.up(qi)).rejects.toThrow("production");
    expect(qi.bulkInsert).not.toHaveBeenCalled();
  });

  test("el catálogo no se vacía", async () => {
    const qi = queryInterface();
    await expect(catalogo.down(qi)).rejects.toThrow("production");
    expect(qi.bulkDelete).not.toHaveBeenCalled();
  });

  test("los pedidos de prueba no se cargan ni se borran", async () => {
    const qi = queryInterface();
    await expect(pedidos.up(qi)).rejects.toThrow("production");
    await expect(pedidos.down(qi)).rejects.toThrow("production");
    expect(qi.bulkInsert).not.toHaveBeenCalled();
    expect(qi.bulkDelete).not.toHaveBeenCalled();
  });

  test("el usuario inicial no se borra", async () => {
    const qi = queryInterface();
    await expect(usuario.down(qi)).rejects.toThrow("production");
    expect(qi.bulkDelete).not.toHaveBeenCalled();
  });

  test("el operador de prueba no se crea ni se borra", async () => {
    const qi = queryInterface();
    await expect(operador.up(qi)).rejects.toThrow("production");
    await expect(operador.down(qi)).rejects.toThrow("production");
    expect(qi.bulkInsert).not.toHaveBeenCalled();
    expect(qi.bulkDelete).not.toHaveBeenCalled();
  });

  test("el usuario inicial se puede seguir creando en una base nueva", async () => {
    const qi = queryInterface();
    const antes = { ...process.env };
    Object.assign(process.env, {
      ADMIN_NOMBRE: "Dueña",
      ADMIN_EMAIL: "duena@ejemplo.test",
      ADMIN_PASSWORD: "una-frase-larga-de-prueba",
    });
    try {
      await expect(usuario.up(qi)).resolves.toBeUndefined();
    } finally {
      for (const clave of ["ADMIN_NOMBRE", "ADMIN_EMAIL", "ADMIN_PASSWORD"]) {
        if (clave in antes) process.env[clave] = antes[clave];
        else delete process.env[clave];
      }
    }
  });
});

describe("operador de prueba", () => {
  const VARIABLES = ["OPERADOR_EMAIL", "OPERADOR_PASSWORD"];
  let antes;
  const queryInterface = (existentes = []) => ({
    bulkInsert: jest.fn(),
    bulkDelete: jest.fn(),
    sequelize: { query: jest.fn(async () => existentes), QueryTypes: { SELECT: "SELECT" } },
  });

  beforeEach(() => {
    antes = { ...process.env };
    Object.assign(process.env, {
      NODE_ENV: "test",
      OPERADOR_EMAIL: "  Operador@Velua.TEST ",
      OPERADOR_PASSWORD: "clave-de-operador-solo-para-ci",
    });
  });
  afterEach(() => {
    for (const clave of [...VARIABLES, "NODE_ENV"]) {
      if (clave in antes) process.env[clave] = antes[clave];
      else delete process.env[clave];
    }
  });

  test("crea un operador con el mail normalizado y la contraseña hasheada", async () => {
    const qi = queryInterface();

    await operador.up(qi);

    const [[fila]] = qi.bulkInsert.mock.calls[0].slice(1);
    expect(fila).toMatchObject({ email: "operador@velua.test", rol: "operador", activo: true });
    expect(fila.password_hash).not.toContain("clave-de-operador");
  });

  test("si ya existe, no lo duplica", async () => {
    const qi = queryInterface([{ id: 3 }]);

    await operador.up(qi);

    expect(qi.bulkInsert).not.toHaveBeenCalled();
  });

  test.each(VARIABLES)("sin %s falla con un mensaje claro y no crea nada", async (variable) => {
    delete process.env[variable];
    const qi = queryInterface();

    await expect(operador.up(qi)).rejects.toThrow("Faltan OPERADOR_EMAIL u OPERADOR_PASSWORD");
    expect(qi.bulkInsert).not.toHaveBeenCalled();
  });

  test("con una contraseña corta falla y no crea nada", async () => {
    process.env.OPERADOR_PASSWORD = "corta";
    const qi = queryInterface();

    await expect(operador.up(qi)).rejects.toThrow("OPERADOR_PASSWORD");
    expect(qi.bulkInsert).not.toHaveBeenCalled();
  });

  test("al borrar, solo toca un usuario con rol operador", async () => {
    const qi = queryInterface();

    await operador.down(qi);

    expect(qi.bulkDelete).toHaveBeenCalledWith(
      "usuarios",
      { email: "operador@velua.test", rol: "operador" },
      {}
    );
  });
});
