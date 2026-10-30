const { components } = require("../../src/docs/definicionBase");
const { PedidoAdminService } = require("../../src/services/PedidoAdminService");

/**
 * @description Compara un valor con un esquema del contrato y devuelve las
 * diferencias. Cubre lo que usan los esquemas de pedidos: objetos, listas,
 * enums y nullable. Una lista vacía significa que el valor cumple el contrato.
 * @param {*} valor - Valor ya serializado como JSON.
 * @param {Object} esquema - Esquema del contrato, o un $ref a uno.
 * @param {string} [ruta] - Dónde está el valor, para el mensaje.
 * @returns {string[]} Las diferencias encontradas.
 */
const diferencias = (valor, esquema, ruta = "$") => {
  const e = esquema.$ref ? components.schemas[esquema.$ref.split("/").pop()] : esquema;
  if (valor === undefined) return [`${ruta}: falta`];
  if (valor === null) return e.nullable ? [] : [`${ruta}: es null y el contrato no lo admite`];
  if (e.enum && !e.enum.includes(valor)) return [`${ruta}: "${valor}" no está en el enum`];
  if (e.type === "array") {
    if (!Array.isArray(valor)) return [`${ruta}: no es una lista`];
    return valor.flatMap((v, i) => diferencias(v, e.items, `${ruta}[${i}]`));
  }
  if (e.type === "object") {
    const declaradas = Object.keys(e.properties ?? {});
    const requeridas = e.required ?? [];
    return [
      ...Object.keys(valor)
        .filter((k) => !declaradas.includes(k))
        .map((k) => `${ruta}.${k}: no está en el contrato`),
      ...declaradas
        .filter((k) => !requeridas.includes(k))
        .map((k) => `${ruta}.${k}: declarada pero no obligatoria`),
      ...declaradas.flatMap((k) => diferencias(valor[k], e.properties[k], `${ruta}.${k}`)),
    ];
  }
  const tipo = e.type === "integer" ? "number" : e.type;
  return typeof valor === tipo ? [] : [`${ruta}: es ${typeof valor} y el contrato dice ${e.type}`];
};

/** Lo que viaja de verdad: JSON.stringify borra las claves con undefined. */
const comoJson = (valor) => JSON.parse(JSON.stringify(valor));

/** Pedido con envío y todos los campos cargados, como lo devuelve Sequelize. */
const pedidoConEnvio = () => ({
  id: 12,
  numero: "VEL-4K7Q2X",
  creadoEn: new Date("2026-10-20T15:00:00Z"),
  clienteNombre: "Lucía Fernández",
  clienteEmail: "lucia@example.com",
  clienteTelefono: "358 412-3344",
  clienteDocumento: "30111222",
  metodoEntrega: "envio",
  zonaEnvioId: 2,
  zonaEnvio: { id: 2, nombre: "Provincia de Córdoba" },
  direccionCalle: "San Martín",
  direccionNumero: "123",
  direccionExtra: "Piso 2",
  direccionCiudad: "Río Cuarto",
  direccionProvincia: "Córdoba",
  direccionCp: "5800",
  subtotal: "36500.00",
  descuentoCupon: "0.00",
  ajustePago: "3650.00",
  costoEnvio: "6500.00",
  total: "39350.00",
  estadoPago: "aprobado",
  estadoPedido: "en_preparacion",
  medioPago: "mercadopago",
  mpPreferenceId: "PREF-INTERNA-123",
  mpPaymentId: "987654",
  mpMetodo: "visa",
  expiraEn: new Date("2026-10-20T16:00:00Z"),
  comprobanteInformadoEn: null,
  seguimiento: "AR123456",
  notasCliente: "Tocar timbre",
  notasInternas: null,
  items: [
    {
      nombreProducto: "Éclat Noir",
      nombreVariante: "100 g",
      sku: "VEL-ECLAT-NOIR",
      precioUnitario: "8500.00",
      cantidad: 2,
      subtotal: "17000.00",
    },
  ],
  eventos: [
    {
      campo: "pago",
      estadoAnterior: "pendiente",
      estadoNuevo: "aprobado",
      origen: "webhook",
      usuarioId: null,
      detalle: null,
      creadoEn: new Date("2026-10-20T15:10:00Z"),
    },
  ],
});

/** Pedido para retirar, con todos los campos opcionales en null. */
const pedidoParaRetirar = () => ({
  ...pedidoConEnvio(),
  metodoEntrega: "retiro",
  zonaEnvioId: null,
  zonaEnvio: null,
  direccionCalle: null,
  direccionNumero: null,
  direccionExtra: null,
  direccionCiudad: null,
  direccionProvincia: null,
  direccionCp: null,
  clienteDocumento: null,
  medioPago: "transferencia",
  estadoPago: "pendiente",
  estadoPedido: "nuevo",
  mpPreferenceId: null,
  mpPaymentId: null,
  mpMetodo: null,
  comprobanteInformadoEn: new Date("2026-10-20T18:00:00Z"),
  seguimiento: null,
  notasCliente: null,
  items: [{ ...pedidoConEnvio().items[0], sku: null }],
  eventos: [{ ...pedidoConEnvio().eventos[0], estadoAnterior: null, estadoNuevo: "pendiente", origen: "checkout" }],
});

/**
 * @description Servicio con un repositorio falso que devuelve el pedido dado.
 * @param {Object} pedido - Pedido a devolver.
 * @returns {PedidoAdminService} El servicio.
 */
const servicioCon = (pedido) =>
  new PedidoAdminService({
    listarParaPanel: async () => ({ filas: [pedido], total: 1 }),
    buscarParaPanel: async () => pedido,
  });

describe("Contrato de pedidos del panel", () => {
  test("la fila de la lista cumple PedidoAdminFila", async () => {
    const { datos } = comoJson(await servicioCon(pedidoConEnvio()).listar());
    expect(diferencias(datos[0], components.schemas.PedidoAdminFila)).toEqual([]);
  });

  test("el detalle de un envío cumple PedidoAdminDetalle", async () => {
    const detalle = comoJson(await servicioCon(pedidoConEnvio()).detalle(12));
    expect(diferencias(detalle, components.schemas.PedidoAdminDetalle)).toEqual([]);
  });

  test("el detalle de un retiro, con los opcionales en null, cumple PedidoAdminDetalle", async () => {
    const detalle = comoJson(await servicioCon(pedidoParaRetirar()).detalle(12));
    expect(diferencias(detalle, components.schemas.PedidoAdminDetalle)).toEqual([]);
  });

  test("el detalle no expone el id de preferencia de Mercado Pago", async () => {
    const texto = JSON.stringify(await servicioCon(pedidoConEnvio()).detalle(12));
    expect(texto).not.toContain("PREF-INTERNA-123");
  });

  test("dice si hay un link de Mercado Pago, sin dar el id", async () => {
    const conLink = await servicioCon(pedidoConEnvio()).detalle(12);
    const sinLink = await servicioCon(pedidoParaRetirar()).detalle(12);

    expect(conLink.pago.tieneLinkMercadoPago).toBe(true);
    expect(sinLink.pago.tieneLinkMercadoPago).toBe(false);
    expect(JSON.stringify(conLink)).not.toContain("PREF-INTERNA-123");
  });
});