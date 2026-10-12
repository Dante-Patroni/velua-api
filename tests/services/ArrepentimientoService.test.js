const {
  ArrepentimientoService,
  generarCodigo,
} = require("../../src/services/ArrepentimientoService");

const CREADO = new Date("2026-10-12T22:00:00.000Z");
const ENTRADA = {
  pedidoNumero: " vel-tv89de ",
  nombre: "  Valentina Ruiz ",
  email: " Valentina@Ejemplo.TEST ",
  telefono: "",
  motivo: "   ",
};

const crear = ({ existe = async () => false, emailAvisos = "duena@velua.test", codigos } = {}) => {
  const repositorio = {
    existeCodigo: jest.fn(existe),
    registrar: jest.fn(async (a) => ({ ...a, id: 1, creadoEn: CREADO })),
  };
  const lista = codigos ? [...codigos] : null;
  const generar = jest.fn(() => (lista ? lista.shift() : "ARR-K7Q2XM"));
  const servicio = new ArrepentimientoService(repositorio, { emailAvisos }, generar);
  return { servicio, repositorio, generar };
};

describe("ArrepentimientoService.registrar", () => {
  it("devuelve el código de trámite y la fecha, nada más", async () => {
    const { servicio } = crear();

    expect(await servicio.registrar(ENTRADA)).toEqual({ codigo: "ARR-K7Q2XM", creadoEn: CREADO });
  });

  it("normaliza los datos antes de guardar", async () => {
    const { servicio, repositorio } = crear();

    await servicio.registrar(ENTRADA);

    expect(repositorio.registrar).toHaveBeenCalledWith(
      {
        codigo: "ARR-K7Q2XM",
        pedidoNumero: "VEL-TV89DE",
        nombre: "Valentina Ruiz",
        email: "valentina@ejemplo.test",
        telefono: null,
        motivo: null,
      },
      expect.any(Array)
    );
  });

  it("sin número de pedido lo guarda en null", async () => {
    const { servicio, repositorio } = crear();

    await servicio.registrar({ nombre: "Ana", email: "ana@ejemplo.test" });

    expect(repositorio.registrar.mock.calls[0][0].pedidoNumero).toBeNull();
  });

  it("le encola a la clienta el mail con su código", async () => {
    const { servicio, repositorio } = crear();

    await servicio.registrar(ENTRADA);

    const [, emails] = repositorio.registrar.mock.calls[0];
    expect(emails[0]).toEqual({
      tipo: "arrepentimiento_recibido",
      destinatario: "valentina@ejemplo.test",
      datos: { codigo: "ARR-K7Q2XM", nombre: "Valentina Ruiz", pedidoNumero: "VEL-TV89DE" },
    });
  });

  it("le avisa a la dueña con todos los datos", async () => {
    const { servicio, repositorio } = crear();

    await servicio.registrar(ENTRADA);

    const [, emails] = repositorio.registrar.mock.calls[0];
    expect(emails[1]).toEqual(
      expect.objectContaining({
        tipo: "arrepentimiento_aviso",
        destinatario: "duena@velua.test",
        datos: expect.objectContaining({ codigo: "ARR-K7Q2XM", email: "valentina@ejemplo.test" }),
      })
    );
  });

  it("sin email de avisos configurado, encola solo el de la clienta", async () => {
    const { servicio, repositorio } = crear({ emailAvisos: null });

    await servicio.registrar(ENTRADA);

    expect(repositorio.registrar.mock.calls[0][1]).toHaveLength(1);
  });

  it("si el código ya existe, genera otro", async () => {
    const { servicio, repositorio } = crear({
      codigos: ["ARR-AAAAAA", "ARR-BBBBBB"],
      existe: async (c) => c === "ARR-AAAAAA",
    });

    const r = await servicio.registrar(ENTRADA);

    expect(r.codigo).toBe("ARR-BBBBBB");
    expect(repositorio.registrar.mock.calls[0][0].codigo).toBe("ARR-BBBBBB");
  });

  it("si no encuentra un código libre, falla sin registrar nada", async () => {
    const { servicio, repositorio, generar } = crear({ existe: async () => true });

    await expect(servicio.registrar(ENTRADA)).rejects.toThrow("CODIGO_NO_DISPONIBLE");
    expect(generar).toHaveBeenCalledTimes(5);
    expect(repositorio.registrar).not.toHaveBeenCalled();
  });
});

describe("generarCodigo", () => {
  it("es ARR- y seis caracteres del alfabeto sin confusiones", () => {
    for (let i = 0; i < 50; i++) {
      expect(generarCodigo()).toMatch(/^ARR-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/);
    }
  });
});

describe("ArrepentimientoService.listar", () => {
  const FILA = {
    id: 7,
    codigo: "ARR-K7Q2XM",
    pedidoNumero: "VEL-TV89DE",
    nombre: "Valentina Ruiz",
    email: "valentina@ejemplo.test",
    telefono: null,
    motivo: null,
    estado: "recibido",
    creadoEn: CREADO,
    campoInterno: "no se expone",
  };

  const conRepo = () => {
    const repositorio = { listar: jest.fn(async () => ({ filas: [FILA], total: 1 })) };
    return {
      servicio: new ArrepentimientoService(repositorio, { emailAvisos: null }),
      repositorio,
    };
  };

  it("sin filtros pide la primera página de 20", async () => {
    const { servicio, repositorio } = conRepo();

    await servicio.listar();

    expect(repositorio.listar).toHaveBeenCalledWith({ estado: null, pagina: 1, limite: 20 });
  });

  it("pasa el estado y la paginación pedidos", async () => {
    const { servicio, repositorio } = conRepo();

    await servicio.listar({ estado: "recibido", pagina: 2, limite: 10 });

    expect(repositorio.listar).toHaveBeenCalledWith({ estado: "recibido", pagina: 2, limite: 10 });
  });

  it("devuelve las solicitudes sin campos internos, con el meta", async () => {
    const { servicio } = conRepo();

    const r = await servicio.listar();

    const { campoInterno, ...visible } = FILA;
    expect(campoInterno).toBeDefined();
    expect(r).toEqual({ datos: [visible], meta: { pagina: 1, limite: 20, total: 1 } });
  });
});
