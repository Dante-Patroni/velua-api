const SequelizePedidoRepository = require("../../src/repositories/sequelize/SequelizePedidoRepository");

/** Repositorio con Pedido.update simulado, que informa `filas` afectadas. */
const armar = (filas) => {
  const update = jest.fn().mockResolvedValue([filas]);
  const repo = new SequelizePedidoRepository({ Pedido: { update } });
  return { repo, update };
};

describe("SequelizePedidoRepository.guardarPreferencia", () => {
  it("sin anterior, guarda sin condición (como en el checkout)", async () => {
    const { repo, update } = armar(1);

    await expect(repo.guardarPreferencia(7, "pref-1")).resolves.toBe(true);
    expect(update).toHaveBeenCalledWith({ mpPreferenceId: "pref-1" }, { where: { id: 7 } });
  });

  it("con anterior null, solo guarda si no había preferencia", async () => {
    const { repo, update } = armar(1);

    await expect(repo.guardarPreferencia(7, "pref-1", { anterior: null })).resolves.toBe(true);
    expect(update).toHaveBeenCalledWith(
      { mpPreferenceId: "pref-1" },
      { where: { id: 7, mpPreferenceId: null } }
    );
  });

  it("con anterior, solo reemplaza esa preferencia", async () => {
    const { repo, update } = armar(1);

    await repo.guardarPreferencia(7, "pref-2", { anterior: "pref-1" });
    expect(update).toHaveBeenCalledWith(
      { mpPreferenceId: "pref-2" },
      { where: { id: 7, mpPreferenceId: "pref-1" } }
    );
  });

  it("si otro escribió antes (0 filas), devuelve false", async () => {
    const { repo } = armar(0);

    await expect(repo.guardarPreferencia(7, "pref-2", { anterior: null })).resolves.toBe(false);
  });
});
