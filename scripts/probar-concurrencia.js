/**
 * Prueba de concurrencia del checkout.
 *
 * Dispara varios pedidos AL MISMO TIEMPO por la última unidad de una variante y
 * verifica que gane exactamente uno. Los tests unitarios no pueden probar esto: el
 * repositorio en memoria no tiene bloqueos, y lo que se prueba acá son los bloqueos
 * de MySQL. Newman tampoco sirve, porque manda los requests de a uno.
 *
 * Requiere el servidor corriendo y un usuario administrador en la base.
 *
 *   node scripts/probar-concurrencia.js
 *
 * Termina con código 1 si algo no se cumple, así puede correr en el CI.
 */
require("dotenv").config();

const BASE = process.env.VELUA_API_URL || `http://localhost:${process.env.PORT || 3000}/api/v1`;
const SIMULTANEOS = 5;

/**
 * @description Corta la prueba con un mensaje y código de error.
 * @param {string} mensaje - Qué falló.
 * @returns {never}
 */
const fallar = (mensaje) => {
  console.error(`\n✗ ${mensaje}`);
  process.exit(1);
};

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
 * @description Inicia sesión en el panel y devuelve la cookie para las siguientes
 * peticiones.
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

(async () => {
  console.log(`Probando contra ${BASE}\n`);

  // 1. Una variante con stock, tomada del catálogo público
  const { cuerpo: listado } = await pedir("/productos?limite=50");
  const conStock = listado.datos.find((p) => p.hayStock);
  if (!conStock) fallar("No hay productos con stock en el catálogo");

  const { cuerpo: ficha } = await pedir(`/productos/${conStock.slug}`);
  const v = ficha.variantes.find((x) => x.hayStock);
  console.log(`Variante: ${ficha.nombre} ${v.nombre} (id ${v.id})`);

  // 2. Dejarla con una sola unidad
  const cookie = await entrarAlPanel();
  const stockOriginal = await leerStock(cookie, ficha.id, v.id);
  await fijarStock(cookie, ficha.id, v.id, 1);
  console.log(`Stock original ${stockOriginal}, ahora 1\n`);

  try {
    // 3. El total que vería la clienta, con retiro y sin descuento
    const { cuerpo: cotizacion } = await pedir("/cotizar", {
      method: "POST",
      body: { items: [{ varianteId: v.id, cantidad: 1 }], medioPago: "mercadopago" },
    });

    const pedido = (n) => ({
      items: [{ varianteId: v.id, cantidad: 1 }],
      cliente: {
        nombre: `Concurrencia ${n}`,
        email: `concurrencia${n}@ejemplo.test`,
        telefono: "358 400-0000",
      },
      entrega: { metodo: "retiro" },
      medioPago: "mercadopago",
      totalEsperado: cotizacion.totales.total,
    });

    // 4. Cinco pedidos al mismo tiempo por la misma unidad
    console.log(`Disparando ${SIMULTANEOS} pedidos simultáneos por la última unidad...`);
    const resultados = await Promise.all(
      Array.from({ length: SIMULTANEOS }, (_, i) =>
        pedir("/pedidos", { method: "POST", body: pedido(i + 1) })
      )
    );

    resultados.forEach((r, i) =>
      console.log(
        `  pedido ${i + 1}: HTTP ${r.status}  ${r.cuerpo?.numero ?? r.cuerpo?.error ?? ""}`
      )
    );

    // 5. Verificaciones
    const ganadores = resultados.filter((r) => r.status === 201);
    const rechazos = resultados.filter((r) => r.status !== 201);
    const motivosValidos = [
      "CARRITO_SIN_ITEMS_VALIDOS",
      "CARRITO_DESACTUALIZADO",
      "STOCK_INSUFICIENTE",
    ];
    const stockFinal = await leerStock(cookie, ficha.id, v.id);

    console.log(
      `\nGanadores: ${ganadores.length} · Rechazados: ${rechazos.length} · Stock final: ${stockFinal}`
    );

    if (ganadores.length !== 1)
      fallar(`Tenía que ganar exactamente uno y ganaron ${ganadores.length}`);
    if (stockFinal !== 0) fallar(`El stock tenía que quedar en 0 y quedó en ${stockFinal}`);

    const raros = rechazos.filter((r) => !motivosValidos.includes(r.cuerpo?.error));
    if (raros.length > 0) {
      fallar(
        `Hubo rechazos por un motivo inesperado: ${raros.map((r) => r.cuerpo?.error).join(", ")}`
      );
    }

    console.log("\n✓ Ganó exactamente uno y el stock no quedó negativo");
  } finally {
    // 6. Siempre devolver el stock, pase lo que pase
    await fijarStock(cookie, ficha.id, v.id, stockOriginal);
    console.log(`Stock restaurado a ${stockOriginal}`);
  }
})().catch((error) => fallar(error.message));
