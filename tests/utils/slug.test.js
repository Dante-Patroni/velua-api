const { generarSlug, generarSlugUnico } = require("../../src/utils/slug");

describe("generarSlug", () => {
  it("pasa a minúsculas y separa con guiones", () => {
    expect(generarSlug("Jabón de Avena")).toBe("jabon-de-avena");
  });

  it("quita los acentos franceses", () => {
    expect(generarSlug("Éclat Doré")).toBe("eclat-dore");
    expect(generarSlug("Rêve de Feu")).toBe("reve-de-feu");
    expect(generarSlug("Belle Âme")).toBe("belle-ame");
    expect(generarSlug("Brise Fruitée")).toBe("brise-fruitee");
  });

  it("trata el apóstrofe tipográfico como separador", () => {
    expect(generarSlug("L’Or de Calendula")).toBe("l-or-de-calendula");
    expect(generarSlug("Jardin d’Agrumes")).toBe("jardin-d-agrumes");
  });

  it("trata el apóstrofe recto igual que el tipográfico", () => {
    expect(generarSlug("L'Or de Calendula")).toBe(generarSlug("L’Or de Calendula"));
  });

  it("reemplaza las ligaduras que Unicode no descompone", () => {
    expect(generarSlug("Cœur de Rose")).toBe("coeur-de-rose");
  });

  it("colapsa espacios y símbolos repetidos en un solo guion", () => {
    expect(generarSlug("  Jabón  --  Lavanda & Miel!  ")).toBe("jabon-lavanda-miel");
  });

  it("devuelve cadena vacía si no hay letras ni números", () => {
    expect(generarSlug("¡¡!!")).toBe("");
    expect(generarSlug("")).toBe("");
    expect(generarSlug(null)).toBe("");
  });

  it("corta en un guion cuando supera el largo máximo", () => {
    const slug = generarSlug("jabon de avena y miel con lavanda", 20);
    expect(slug.length).toBeLessThanOrEqual(20);
    expect(slug.endsWith("-")).toBe(false);
    expect(slug).toBe("jabon-de-avena-y");
  });

  it("produce exactamente los slugs del seed del catálogo", () => {
    // Si esto falla, un producto creado desde el panel tendria un slug
    // distinto al que habria tenido cargado por seed.
    const casos = {
      "Éclat Doré": "eclat-dore",
      "Ciel de Soie": "ciel-de-soie",
      "Belle Âme": "belle-ame",
      "Chocolat de Coco": "chocolat-de-coco",
      "Rose Éternelle": "rose-eternelle",
      Velours: "velours",
      "Amande Sereine": "amande-sereine",
      Éden: "eden",
      "Éclat Noir": "eclat-noir",
      "Jardin d’Agrumes": "jardin-d-agrumes",
      "Brise de Menthe": "brise-de-menthe",
      "Soleil d’Été": "soleil-d-ete",
      "Rêve de Feu": "reve-de-feu",
      "L’Or de Calendula": "l-or-de-calendula",
      "Brise Fruitée": "brise-fruitee",
    };
    for (const [nombre, esperado] of Object.entries(casos)) {
      expect(generarSlug(nombre)).toBe(esperado);
    }
  });
});

describe("generarSlugUnico", () => {
  it("devuelve la base si está libre", async () => {
    const existe = jest.fn().mockResolvedValue(false);

    await expect(generarSlugUnico("velours", existe)).resolves.toBe("velours");
  });

  it("agrega -2 si la base está tomada", async () => {
    const tomados = new Set(["velours"]);
    const existe = async (s) => tomados.has(s);

    await expect(generarSlugUnico("velours", existe)).resolves.toBe("velours-2");
  });

  it("sigue sumando hasta encontrar uno libre", async () => {
    const tomados = new Set(["velours", "velours-2", "velours-3"]);
    const existe = async (s) => tomados.has(s);

    await expect(generarSlugUnico("velours", existe)).resolves.toBe("velours-4");
  });

  it("respeta el largo máximo contando el sufijo", async () => {
    const base = "a".repeat(80);
    const existe = async (s) => s === base;

    const slug = await generarSlugUnico(base, existe, 80);

    expect(slug.length).toBeLessThanOrEqual(80);
    expect(slug.endsWith("-2")).toBe(true);
  });

  it("rechaza una base vacía con DATOS_INVALIDOS", async () => {
    await expect(generarSlugUnico("", async () => false)).rejects.toThrow("DATOS_INVALIDOS");
  });
});
