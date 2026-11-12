const SequelizePedidoRepository = require("../../src/repositories/sequelize/SequelizePedidoRepository");

/**
 * @description Error como el que tira Sequelize ante un índice único repetido.
 * @param {string} indice - Nombre del índice en el mensaje.
 * @param {number} [errno=1062] - Número de error de MySQL.
 * @returns {Error} El error, con su `parent` del driver.
 */
const unicoRepetido = (indice, errno = 1062) => {
  const error = new Error("Validation error");
  error.name = "SequelizeUniqueConstraintError";
  // MySQL 8 antepone la tabla al índice; MariaDB no. Se prueban las dos formas abajo.
  error.parent = {
    errno,
    code: "ER_DUP_ENTRY",
    sqlMessage: `Duplicate entry 'x' for key '${indice}'`,
  };
  return error;
};

/**
 * @description Repositorio con Pedido.create simulado, dentro de una transacción falsa.
 * @param {Function} create - Implementación de Pedido.create.
 * @returns {SequelizePedidoRepository} El repositorio.
 */
const armar = (create) =>
  new SequelizePedidoRepository({
    Pedido: { create },
    sequelize: { transaction: (trabajo) => trabajo({}) },
  });

describe("crearPedido y la clave de venta repetida", () => {
  it.each(["pedidos.ux_pedidos_clave_venta", "ux_pedidos_clave_venta"])(
    "un 1062 sobre %s se traduce a CLAVE_VENTA_DUPLICADA",
    async (indice) => {
      const repo = armar(jest.fn().mockRejectedValue(unicoRepetido(indice)));

      await expect(repo.transaccion((tx) => tx.crearPedido({}))).rejects.toThrow(
        "CLAVE_VENTA_DUPLICADA"
      );
    }
  );

  it("un 1062 sobre otro índice (el número de pedido) sigue tal cual", async () => {
    const original = unicoRepetido("pedidos.numero");
    const repo = armar(jest.fn().mockRejectedValue(original));

    await expect(repo.transaccion((tx) => tx.crearPedido({}))).rejects.toBe(original);
  });

  it("otro errno con el nombre del índice en el mensaje sigue tal cual", async () => {
    // En MariaDB, el driver etiqueta el 4025 de la CHECK con un nombre de MySQL: se
    // decide por el número, nunca por el nombre del código.
    const original = unicoRepetido("ux_pedidos_clave_venta", 4025);
    const repo = armar(jest.fn().mockRejectedValue(original));

    await expect(repo.transaccion((tx) => tx.crearPedido({}))).rejects.toBe(original);
  });

  it("sin error, devuelve el pedido creado", async () => {
    const repo = armar(jest.fn().mockResolvedValue({ toJSON: () => ({ id: 3 }) }));

    await expect(repo.transaccion((tx) => tx.crearPedido({}))).resolves.toEqual({ id: 3 });
  });
});

describe("buscarPorClaveVenta", () => {
  it("busca por la clave y pide solo lo que hace falta", async () => {
    const findOne = jest.fn().mockResolvedValue({ toJSON: () => ({ id: 3, huellaVenta: "ab" }) });
    const repo = new SequelizePedidoRepository({ Pedido: { findOne } });

    await expect(repo.buscarPorClaveVenta("clave")).resolves.toEqual({ id: 3, huellaVenta: "ab" });
    expect(findOne).toHaveBeenCalledWith({
      where: { claveVenta: "clave" },
      attributes: ["id", "numero", "total", "estadoPago", "medioPago", "huellaVenta"],
    });
  });

  it("si no existe, null", async () => {
    const repo = new SequelizePedidoRepository({
      Pedido: { findOne: jest.fn().mockResolvedValue(null) },
    });

    await expect(repo.buscarPorClaveVenta("clave")).resolves.toBeNull();
  });
});
