const CategoriaAdminService = require("../../src/services/CategoriaAdminService");
const { esSlugReservado } = require("../../src/utils/slugsReservados");

describe("slugs reservados", () => {
  it("catalogo y admin están reservados", () => {
    expect(esSlugReservado("catalogo")).toBe(true);
    expect(esSlugReservado("admin")).toBe(true);
  });

  it("un slug de colección común no está reservado", () => {
    expect(esSlugReservado("art-du-savon")).toBe(false);
  });

  it("no deja poner a mano un slug reservado al editar", async () => {
    const repositorio = {
      buscarPorId: jest.fn().mockResolvedValue({ id: 5, slug: "art-du-savon", padreId: null }),
      existeSlug: jest.fn().mockResolvedValue(false),
      actualizar: jest.fn(),
    };
    const servicio = new CategoriaAdminService(repositorio);

    await expect(servicio.actualizar(5, { slug: "Catálogo" })).rejects.toThrow(
      "CONFLICTO_DE_DATOS"
    );
    expect(repositorio.actualizar).not.toHaveBeenCalled();
  });
});
