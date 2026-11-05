/**
 * Prueba de concurrencia: aviso desde el panel contra el job de vencimiento.
 *
 * Sobre un pedido por transferencia ya vencido, dispara AL MISMO TIEMPO el aviso
 * que registra la dueña desde el panel y la cancelación del job de vencimiento.
 * Tiene que ganar exactamente uno:
 *   - si gana el aviso, el pedido sigue pendiente, con el aviso y con su stock;
 *   - si gana el job, el pedido queda cancelado, sin aviso y con el stock devuelto,
 *     y el aviso responde PEDIDO_NO_PAGABLE.
 * Nunca puede quedar un pedido vivo sin su stock, ni cancelado con aviso.
 *
 * Los dos caminos bloquean la misma fila (FOR UPDATE) y deciden adentro de su
 * transacción: esto prueba esos bloqueos con MySQL real. El job no tiene ruta HTTP,
 * así que el script llama al servicio, igual que el job. Los pedidos se crean por la
 * API, como los crearía la tienda.
 *
 * Requiere el servidor corriendo, la base accesible con las variables del .env y un
 * usuario administrador.
 *
 *   node scripts/probar-aviso-contra-vencimiento.js
 *
 * Termina con código 1 si algo no se cumple, así puede correr en el CI.
 */
require("dotenv").config();

const {
  exigirEntornoDeDesarrollo,
  exigirApiLocal,
  exigirBaseLocal,
} = require("../src/config/soloDesarrollo");

const BASE = process.env.VELUA_API_URL || `http://localhost:${process.env.PORT || 3000}/api/v1`;
const NOMBRE = "Prueba de aviso contra vencimiento";
// Varias vueltas: quién gana depende del momento, y conviene ver los dos caminos.
const VUELTAS = 6;

/**
 * @description Corta la prueba con un mensaje y código de error.
 * @param {string} mensaje - Qué falló.
 * @returns {never}
 */
const fallar = (mensaje) => {
  console.error(`\n✗ ${mensaje}`);
  process.exit(1);
};

// Estas pruebas crean pedidos y cambian stock: nunca contra una base o una API
// reales. NODE_ENV y DB_HOST protegen la base (el script se conecta por el .env)
// y la URL protege la API. Va antes de cargar los modelos, que abren la conexión.
try {
  exigirEntornoDeDesarrollo(NOMBRE);
  exigirBaseLocal(NOMBRE);
  exigirApiLocal(NOMBRE, BASE);
} catch (error) {
  fallar(error.message);
}

const db = require("../src/models");
const SequelizePedidoRepository = require("../src/repositories/sequelize/SequelizePedidoRepository");
const { PedidoEstadoService } = require("../src/services/PedidoEstadoService");

/**
 * @description Hace una petición JSON a la API.
 * @param {string} ruta - Ruta relativa a la base.
 * @param {Object} [opciones] - Método, cuerpo y cookie.
 * @returns {Promise<{status: number, cuerpo: *, respuesta: Response}>} Resultado.
 */
const pedir = async (ruta, { method = "GET", body, cookie } = {}) => {
  const respuesta = await fetch(`${BASE}${ruta}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const texto = await respuesta.text();
  return { status: respuesta.status, cuerpo: texto ? JSON.parse(texto) : null, respuesta };
};

/**
 * @description Inicia sesión en el panel y devuelve la cookie.
 * @returns {Promise<string>} La cookie de sesión, lista para el encabezado.
 */
const entrarAlPanel = async () => {
  const { status, respuesta } = await pedir("/auth/login", {
    method: "POST",
    body: { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD },
  });
  if (status !== 200) fallar(`No se pudo iniciar sesión en el panel (HTTP ${status})`);

  const cookie = respuesta.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .find((c) => c.startsWith("velua_sesion="));
  if (!cookie) fallar("El login no devolvió la cookie de sesión");
  return cookie;
};

/**
 * @description Cambia el stock de una variante desde el panel.
 * @param {string} cookie - Cookie de sesión.
 * @param {number} productoId - Id del producto.
 * @param {number} varianteId - Id de la variante.
 * @param {number} stock - Stock nuevo.
 * @returns {Promise<void>}
 */
const fijarStock = async (cookie, productoId, varianteId, stock) => {
  const { status } = await pedir(`/admin/productos/${productoId}/variantes/${varianteId}`, {
    method: "PATCH",
    body: { stock },
    cookie,
  });
  if (status !== 200) fallar(`No se pudo fijar el stock en ${stock} (HTTP ${status})`);
};

/**
 * @description Lee el stock real de una variante desde la ficha del panel.
 * @param {string} cookie - Cookie de sesión.
 * @param {number} productoId - Id del producto.
 * @param {number} varianteId - Id de la variante.
 * @returns {Promise<number>} Stock actual.
 */
const leerStock = async (cookie, productoId, varianteId) => {
  const { cuerpo } = await pedir(`/admin/productos/${productoId}`, { cookie });
  return cuerpo.variantes.find((v) => v.id === varianteId).stock;
};

/**
 * @description Ejecuta una promesa y devuelve su resultado o su error, sin lanzar.
 * @param {Promise<*>} promesa - Lo que se dispara.
 * @returns {Promise<{ok: boolean, valor?: *, error?: Error}>}
 */
const capturar = (promesa) =>
  promesa.then(
    (valor) => ({ ok: true, valor }),
    (error) => ({ ok: false, error })
  );

(async () => {
  console.log(`Probando contra ${BASE}\n`);

  const servicio = new PedidoEstadoService(new SequelizePedidoRepository(db));
  const admin = await db.Usuario.findOne({ where: { email: process.env.ADMIN_EMAIL } });
  if (!admin) fallar("No encontré al usuario administrador en la base");

  // 1. Una variante con stock, con unidades de sobra para todas las vueltas
  const { cuerpo: listado } = await pedir("/productos?limite=50");
  const conStock = listado.datos.find((p) => p.hayStock);
  if (!conStock) fallar("No hay productos con stock en el catálogo");
  const { cuerpo: ficha } = await pedir(`/productos/${conStock.slug}`);
  const v = ficha.variantes.find((x) => x.hayStock);
  console.log(`Variante: ${ficha.nombre} ${v.nombre} (id ${v.id})`);

  const cookie = await entrarAlPanel();
  const stockOriginal = await leerStock(cookie, ficha.id, v.id);
  await fijarStock(cookie, ficha.id, v.id, VUELTAS);
  console.log(`Stock original ${stockOriginal}, ahora ${VUELTAS}\n`);

  const avisados = [];
  let ganoElJob = 0;

  try {
    const { status: estadoCotizacion, cuerpo: cotizacion } = await pedir("/cotizar", {
      method: "POST",
      body: { items: [{ varianteId: v.id, cantidad: 1 }], medioPago: "transferencia" },
    });
    if (estadoCotizacion !== 200) throw new Error(`/cotizar respondió ${estadoCotizacion}`);

    for (let vuelta = 1; vuelta <= VUELTAS; vuelta++) {
      // 2. Un pedido por transferencia, creado por la API
      const { status, cuerpo } = await pedir("/pedidos", {
        method: "POST",
        body: {
          items: [{ varianteId: v.id, cantidad: 1 }],
          cliente: {
            nombre: `Prueba Aviso contra Vencimiento ${vuelta}`,
            email: `aviso-vencimiento${vuelta}@ejemplo.test`,
            telefono: "358 400-0000",
          },
          entrega: { metodo: "retiro" },
          medioPago: "transferencia",
          totalEsperado: cotizacion.totales.total,
        },
      });
      if (status !== 201)
        throw new Error(`Vuelta ${vuelta}: no se creó el pedido (HTTP ${status})`);
      const pedido = await db.Pedido.findOne({ where: { numero: cuerpo.numero } });

      // 3. Vencerlo: la reserva terminó hace un minuto
      await pedido.update({ expiraEn: new Date(Date.now() - 60 * 1000) });
      const stockAntes = await leerStock(cookie, ficha.id, v.id);

      // 4. El aviso del panel y el job, al mismo tiempo. El que arranca primero
      // suele pedir el bloqueo primero: se alterna para que ganen los dos caminos.
      const avisar = () =>
        capturar(servicio.registrarAviso(pedido.id, { origen: "panel", usuarioId: admin.id }));
      const vencer = () => capturar(servicio.cancelarVencido(pedido.id));
      const [aviso, job] =
        vuelta % 2 === 0
          ? await Promise.all([avisar(), vencer()])
          : await Promise.all([vencer(), avisar()]).then(([j, a]) => [a, j]);

      // 5. Exactamente uno ganó, y el pedido quedó coherente
      await pedido.reload();
      const stockDespues = await leerStock(cookie, ficha.id, v.id);
      const ganoAviso = aviso.ok && aviso.valor.registrado === true;
      const canceloJob = job.ok && job.valor.cancelado === true;

      if (ganoAviso === canceloJob) {
        throw new Error(
          `Vuelta ${vuelta}: tenía que ganar exactamente uno (aviso ${ganoAviso}, job ${canceloJob})`
        );
      }

      if (ganoAviso) {
        if (job.valor?.motivo !== "YA_NO_CORRESPONDE")
          throw new Error(`Vuelta ${vuelta}: el job tenía que responder YA_NO_CORRESPONDE`);
        if (pedido.estadoPedido === "cancelado" || pedido.estadoPago !== "pendiente")
          throw new Error(`Vuelta ${vuelta}: ganó el aviso, pero el pedido no quedó pendiente`);
        if (pedido.comprobanteInformadoEn === null)
          throw new Error(`Vuelta ${vuelta}: ganó el aviso, pero no quedó registrado`);
        if (stockDespues !== stockAntes)
          throw new Error(`Vuelta ${vuelta}: ganó el aviso, pero se devolvió el stock`);
        avisados.push(pedido.id);
        console.log(`  vuelta ${vuelta}: ganó el aviso (el job no canceló)`);
      } else {
        if (aviso.ok || aviso.error.message !== "PEDIDO_NO_PAGABLE")
          throw new Error(`Vuelta ${vuelta}: el aviso tenía que responder PEDIDO_NO_PAGABLE`);
        if (pedido.estadoPedido !== "cancelado")
          throw new Error(`Vuelta ${vuelta}: ganó el job, pero el pedido no quedó cancelado`);
        if (pedido.comprobanteInformadoEn !== null)
          throw new Error(`Vuelta ${vuelta}: el pedido quedó cancelado con un aviso`);
        if (stockDespues !== stockAntes + 1)
          throw new Error(`Vuelta ${vuelta}: ganó el job, pero no devolvió el stock`);
        ganoElJob++;
        console.log(`  vuelta ${vuelta}: ganó el job (el aviso respondió PEDIDO_NO_PAGABLE)`);
      }
    }

    console.log(
      `\n✓ En ${VUELTAS} vueltas ganó siempre uno solo (aviso ${avisados.length}, job ${ganoElJob})`
    );
    // Quién gana depende del momento: no se falla por eso, pero se avisa si un
    // camino no se probó, para no creer que se probó lo que no.
    if (avisados.length === 0 || ganoElJob === 0) {
      console.log("⚠ Uno de los dos caminos no se ejecutó en esta corrida: volvé a correrla");
    }
  } finally {
    // 6. Cancelar los avisados (si no, nunca vencen) y devolver el stock
    for (const id of avisados) {
      await pedir(`/admin/pedidos/${id}/cancelacion`, {
        method: "POST",
        body: { motivo: "Prueba de aviso contra vencimiento", confirmaSinPago: true },
        cookie,
      });
    }
    await fijarStock(cookie, ficha.id, v.id, stockOriginal);
    console.log(`Stock restaurado a ${stockOriginal}`);
    await db.sequelize.close();
  }
})().catch((error) => fallar(error.message));
