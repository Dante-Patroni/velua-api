"use strict";

const { aCentavos, aImporte } = require("../utils/dinero");

/**
 * @description Números de los pedidos de prueba. Fijos y reconocibles, a diferencia
 * de los reales, que son aleatorios: así el `down` sabe exactamente qué borrar.
 */
const NUMEROS = ["VEL-SEED1", "VEL-SEED2", "VEL-SEED3", "VEL-SEED4", "VEL-SEED5", "VEL-SEED6"];

/**
 * @description Ids de pago falsos de Mercado Pago, para las notificaciones de prueba.
 */
const PAGOS_MP = ["SEED-PAY-1", "SEED-PAY-2"];

const HORA = 60 * 60 * 1000;

/**
 * @description Fecha relativa a ahora.
 * @param {number} horas - Horas a sumar; negativo para el pasado.
 * @returns {Date} La fecha resultante.
 */
const dentroDe = (horas) => new Date(Date.now() + horas * HORA);

/**
 * @description Los seis pedidos, cada uno representando un estado que la pantalla de
 * pedidos tiene que saber mostrar. Las clientas usan el dominio .test, que está
 * reservado y nunca existe en internet: ningún mail de prueba puede llegarle a nadie.
 */
const PEDIDOS = [
  {
    numero: "VEL-SEED1",
    cliente: { nombre: "Lucía Fernández", email: "lucia@ejemplo.test", telefono: "358 412-3344" },
    entrega: { metodo: "envio", zona: "Provincia de Córdoba" },
    direccion: {
      calle: "Av. Colón",
      numero: "1250",
      ciudad: "Córdoba",
      provincia: "Córdoba",
      cp: "5000",
    },
    medioPago: "mercadopago",
    pago: "aprobado",
    preparacion: "en_preparacion",
    items: [
      { slug: "eclat-noir", cantidad: 2 },
      { slug: "rose-eternelle", cantidad: 1 },
    ],
    hace: 30,
    mpPago: "SEED-PAY-1",
    eventos: [
      { campo: "pago", de: null, a: "pendiente", origen: "checkout", hace: 30 },
      { campo: "pago", de: "pendiente", a: "aprobado", origen: "webhook", hace: 29.9 },
      {
        campo: "preparacion",
        de: "nuevo",
        a: "en_preparacion",
        origen: "panel",
        hace: 20,
        usuario: true,
      },
    ],
  },
  {
    numero: "VEL-SEED2",
    cliente: { nombre: "Martina Gómez", email: "martina@ejemplo.test", telefono: "11 5566-7788" },
    entrega: { metodo: "envio", zona: "Resto del país" },
    direccion: {
      calle: "Calle 50",
      numero: "830",
      ciudad: "La Plata",
      provincia: "Buenos Aires",
      cp: "1900",
    },
    medioPago: "mercadopago",
    pago: "aprobado",
    preparacion: "enviado",
    seguimiento: "AR123456789",
    items: [{ slug: "soleil-d-ete", cantidad: 3 }],
    hace: 96,
    mpPago: "SEED-PAY-2",
    eventos: [
      { campo: "pago", de: null, a: "pendiente", origen: "checkout", hace: 96 },
      { campo: "pago", de: "pendiente", a: "aprobado", origen: "webhook", hace: 95.9 },
      {
        campo: "preparacion",
        de: "nuevo",
        a: "en_preparacion",
        origen: "panel",
        hace: 80,
        usuario: true,
      },
      {
        campo: "preparacion",
        de: "en_preparacion",
        a: "enviado",
        origen: "panel",
        hace: 50,
        usuario: true,
        detalle: "Seguimiento AR123456789",
      },
    ],
  },
  {
    // Pendiente con aviso y el plazo YA vencido: el job no lo tiene que cancelar,
    // porque la clienta avisó que pagó. Es el caso que protege la decisión.
    numero: "VEL-SEED3",
    cliente: { nombre: "Sofía Ramírez", email: "sofia@ejemplo.test", telefono: "358 498-1122" },
    entrega: { metodo: "envio", zona: "Provincia de Córdoba" },
    direccion: {
      calle: "San Martín",
      numero: "455",
      ciudad: "Villa María",
      provincia: "Córdoba",
      cp: "5900",
    },
    medioPago: "transferencia",
    pago: "pendiente",
    preparacion: "nuevo",
    items: [{ slug: "belle-ame", cantidad: 1 }],
    hace: 50,
    expiraEn: -2,
    comprobanteHace: 45,
    eventos: [
      { campo: "pago", de: null, a: "pendiente", origen: "checkout", hace: 50 },
      { campo: "aviso", de: null, a: "comprobante_informado", origen: "cliente", hace: 45 },
    ],
  },
  {
    // Pendiente, sin aviso y por vencer: el panel lo tiene que destacar.
    numero: "VEL-SEED4",
    cliente: {
      nombre: "Valentina Ruiz",
      email: "valentina@ejemplo.test",
      telefono: "358 401-9988",
    },
    entrega: { metodo: "envio", zona: "Río Cuarto y alrededores" },
    direccion: {
      calle: "Constitución",
      numero: "1020",
      ciudad: "Río Cuarto",
      provincia: "Córdoba",
      cp: "5800",
    },
    medioPago: "transferencia",
    pago: "pendiente",
    preparacion: "nuevo",
    items: [
      { slug: "velours", cantidad: 1 },
      { slug: "chocolat-de-coco", cantidad: 1 },
    ],
    hace: 45,
    expiraEn: 3,
    eventos: [{ campo: "pago", de: null, a: "pendiente", origen: "checkout", hace: 45 }],
  },
  {
    // Cancelado por vencimiento: la reserva venció sin pago.
    numero: "VEL-SEED5",
    cliente: { nombre: "Camila Torres", email: "camila@ejemplo.test", telefono: "351 344-5566" },
    entrega: { metodo: "envio", zona: "Provincia de Córdoba" },
    direccion: {
      calle: "Belgrano",
      numero: "78",
      ciudad: "Córdoba",
      provincia: "Córdoba",
      cp: "5000",
    },
    medioPago: "mercadopago",
    pago: "cancelado",
    preparacion: "cancelado",
    items: [{ slug: "eden", cantidad: 2 }],
    hace: 72,
    expiraEn: -71,
    eventos: [
      { campo: "pago", de: null, a: "pendiente", origen: "checkout", hace: 72 },
      {
        campo: "pago",
        de: "pendiente",
        a: "cancelado",
        origen: "job",
        hace: 71,
        detalle: "Reserva vencida, stock devuelto",
      },
      { campo: "preparacion", de: "nuevo", a: "cancelado", origen: "job", hace: 71 },
    ],
  },
  {
    // Transferencia confirmada a mano desde el panel, con retiro en persona.
    numero: "VEL-SEED6",
    cliente: { nombre: "Julieta Sosa", email: "julieta@ejemplo.test", telefono: "358 455-6677" },
    entrega: { metodo: "retiro", zona: null },
    direccion: null,
    medioPago: "transferencia",
    pago: "aprobado",
    preparacion: "nuevo",
    items: [{ slug: "l-or-de-calendula", cantidad: 2 }],
    hace: 10,
    comprobanteHace: 8,
    eventos: [
      { campo: "pago", de: null, a: "pendiente", origen: "checkout", hace: 10 },
      { campo: "aviso", de: null, a: "comprobante_informado", origen: "cliente", hace: 8 },
      {
        campo: "pago",
        de: "pendiente",
        a: "aprobado",
        origen: "panel",
        hace: 6,
        usuario: true,
        detalle: "Confirmado a mano: transferencia recibida",
      },
    ],
  },
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  /**
   * @description Carga seis pedidos de prueba que cubren los estados que la pantalla
   * de pedidos tiene que saber mostrar, con su bitácora.
   *
   * No toca el stock: son datos de prueba, no ventas. Si descontaran stock, el
   * catálogo dejaría de coincidir con su propio seed.
   *
   * @param {import("sequelize").QueryInterface} queryInterface - Interfaz de consultas.
   * @returns {Promise<void>}
   * @throws {Error} Si falta un producto o una zona del seed del catálogo.
   */
  async up(queryInterface) {
    if (process.env.NODE_ENV === "production") {
      // Pedidos falsos en producción aparecerían como ventas reales en el panel.
      return;
    }

    const seq = queryInterface.sequelize;
    const SELECT = { type: seq.QueryTypes.SELECT };

    const existentes = await seq.query("SELECT numero FROM pedidos WHERE numero IN (:numeros)", {
      ...SELECT,
      replacements: { numeros: NUMEROS },
    });
    if (existentes.length > 0) {
      return;
    }

    const slugs = [...new Set(PEDIDOS.flatMap((p) => p.items.map((i) => i.slug)))];
    const variantes = await seq.query(
      `SELECT v.id, v.nombre AS variante, v.sku, v.precio, p.slug, p.nombre AS producto
         FROM variantes v
         JOIN productos p ON p.id = v.producto_id
        WHERE p.slug IN (:slugs)`,
      { ...SELECT, replacements: { slugs } }
    );
    const porSlug = new Map(variantes.map((v) => [v.slug, v]));

    const faltan = slugs.filter((s) => !porSlug.has(s));
    if (faltan.length > 0) {
      throw new Error(`Faltan productos del seed del catálogo: ${faltan.join(", ")}`);
    }

    const zonas = await seq.query("SELECT id, nombre, costo FROM zonas_envio", SELECT);
    const zonaPorNombre = new Map(zonas.map((z) => [z.nombre, z]));

    const [usuario] = await seq.query("SELECT id FROM usuarios ORDER BY id LIMIT 1", SELECT);
    const usuarioId = usuario?.id ?? null;

    // Pedidos, con los totales calculados en centavos igual que el cotizador.
    const filas = PEDIDOS.map((p) => {
      const zona = p.entrega.zona ? zonaPorNombre.get(p.entrega.zona) : null;
      if (p.entrega.zona && !zona) {
        throw new Error(`Falta la zona de envío del seed: ${p.entrega.zona}`);
      }

      const subtotal = p.items.reduce(
        (suma, i) => suma + aCentavos(porSlug.get(i.slug).precio) * i.cantidad,
        0
      );
      const envio = zona ? aCentavos(zona.costo) : 0;

      return {
        numero: p.numero,
        cliente_nombre: p.cliente.nombre,
        cliente_email: p.cliente.email,
        cliente_telefono: p.cliente.telefono,
        metodo_entrega: p.entrega.metodo,
        zona_envio_id: zona?.id ?? null,
        direccion_calle: p.direccion?.calle ?? null,
        direccion_numero: p.direccion?.numero ?? null,
        direccion_ciudad: p.direccion?.ciudad ?? null,
        direccion_provincia: p.direccion?.provincia ?? null,
        direccion_cp: p.direccion?.cp ?? null,
        subtotal: aImporte(subtotal),
        descuento_cupon: "0.00",
        ajuste_pago: "0.00",
        costo_envio: aImporte(envio),
        total: aImporte(subtotal + envio),
        estado_pago: p.pago,
        estado_pedido: p.preparacion,
        medio_pago: p.medioPago,
        mp_payment_id: p.mpPago ?? null,
        expira_en: p.expiraEn === undefined ? null : dentroDe(p.expiraEn),
        comprobante_informado_en:
          p.comprobanteHace === undefined ? null : dentroDe(-p.comprobanteHace),
        seguimiento: p.seguimiento ?? null,
        creado_en: dentroDe(-p.hace),
        actualizado_en: dentroDe(-p.hace),
      };
    });

    await queryInterface.bulkInsert("pedidos", filas);

    const creados = await seq.query("SELECT id, numero FROM pedidos WHERE numero IN (:numeros)", {
      ...SELECT,
      replacements: { numeros: NUMEROS },
    });
    const idPorNumero = new Map(creados.map((c) => [c.numero, c.id]));

    // Ítems con nombre y precio congelados, como los dejaría el checkout.
    await queryInterface.bulkInsert(
      "pedido_items",
      PEDIDOS.flatMap((p) =>
        p.items.map((i) => {
          const v = porSlug.get(i.slug);
          return {
            pedido_id: idPorNumero.get(p.numero),
            variante_id: v.id,
            nombre_producto: v.producto,
            nombre_variante: v.variante,
            sku: v.sku,
            precio_unitario: v.precio,
            cantidad: i.cantidad,
            subtotal: aImporte(aCentavos(v.precio) * i.cantidad),
          };
        })
      )
    );

    // La historia de cada pedido.
    await queryInterface.bulkInsert(
      "pedido_eventos",
      PEDIDOS.flatMap((p) =>
        p.eventos.map((e) => ({
          pedido_id: idPorNumero.get(p.numero),
          campo: e.campo,
          estado_anterior: e.de,
          estado_nuevo: e.a,
          origen: e.origen,
          usuario_id: e.usuario ? usuarioId : null,
          detalle: e.detalle ?? null,
          creado_en: dentroDe(-e.hace),
        }))
      )
    );

    // Las notificaciones de Mercado Pago de los dos pagos aprobados, ya procesadas.
    await queryInterface.bulkInsert(
      "notificaciones_pago",
      PEDIDOS.filter((p) => p.mpPago).map((p) => ({
        proveedor: "mercadopago",
        id_externo: p.mpPago,
        tipo: "payment",
        pedido_id: idPorNumero.get(p.numero),
        recibido_en: dentroDe(-p.hace + 0.1),
        procesado_en: dentroDe(-p.hace + 0.1),
      }))
    );
  },

  /**
   * @description Borra los pedidos de prueba y todo lo que cuelga de ellos.
   *
   * Los ítems y la bitácora se van solos por la clave foránea en cascada. Los mails
   * y las notificaciones no: su clave queda en null al borrar el pedido, así que se
   * borran antes, en forma explícita.
   *
   * @param {import("sequelize").QueryInterface} queryInterface - Interfaz de consultas.
   * @returns {Promise<void>}
   */
  async down(queryInterface) {
    const seq = queryInterface.sequelize;

    const ids = (
      await seq.query("SELECT id FROM pedidos WHERE numero IN (:numeros)", {
        type: seq.QueryTypes.SELECT,
        replacements: { numeros: NUMEROS },
      })
    ).map((f) => f.id);

    if (ids.length > 0) {
      await queryInterface.bulkDelete("emails_pendientes", { pedido_id: ids });
    }

    await queryInterface.bulkDelete("notificaciones_pago", {
      proveedor: "mercadopago",
      id_externo: PAGOS_MP,
    });

    await queryInterface.bulkDelete("pedidos", { numero: NUMEROS });
  },
};
