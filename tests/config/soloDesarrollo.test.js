const { ENTORNOS_DE_DESARROLLO, exigirEntornoDeDesarrollo } = require("../../src/config/soloDesarrollo");
const catalogo = require("../../src/seeders/20260918000001-catalogo-inicial");
const pedidos = require("../../src/seeders/20261004000001-pedidos-de-prueba");
const usuario = require("../../src/seeders/20260921000001-usuario-inicial");

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