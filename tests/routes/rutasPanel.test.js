/**
 * Inventario de TODAS las rutas de la API (test ancla). Carga la app de verdad,
 * recorre el router de Express y exige que cada ruta esté declarada en una de tres
 * tablas, y que su protección real coincida con lo declarado:
 *
 * - PERMISO_POR_RUTA: empieza con proteger (sesión y después el permiso esperado).
 *   Toda ruta de /admin va acá, sin excepción.
 * - SOLO_SESION: pide sesión pero ningún permiso (la cuenta propia).
 * - PUBLICAS: sin sesión, cada una con el motivo.
 *
 * Una ruta nueva que no está en ninguna tabla rompe el test, se llame como se
 * llame: la protección no depende de que el path empiece con /admin. Si agregás,
 * sacás o cambiás una ruta, actualizá su tabla. Esa línea del diff es la que tiene
 * que mirar la revisión, sobre todo si es una ruta pública nueva.
 */
const PERMISO_POR_RUTA = {
  "GET /admin/categorias": "CATALOGO_VER",
  "POST /admin/categorias": "CATALOGO_EDITAR",
  "PUT /admin/categorias/orden": "CATALOGO_EDITAR",
  "GET /admin/categorias/:id": "CATALOGO_VER",
  "PATCH /admin/categorias/:id": "CATALOGO_EDITAR",
  "PATCH /admin/categorias/:id/estado": "CATALOGO_EDITAR",
  "POST /admin/categorias/:id/imagen": "CATALOGO_EDITAR",
  "DELETE /admin/categorias/:id/imagen": "CATALOGO_EDITAR",
  "GET /admin/productos": "CATALOGO_VER",
  "POST /admin/productos": "CATALOGO_EDITAR",
  "GET /admin/productos/:id": "CATALOGO_VER",
  "PATCH /admin/productos/:id": "CATALOGO_EDITAR",
  "PATCH /admin/productos/:id/estado": "CATALOGO_EDITAR",
  "POST /admin/productos/:id/variantes": "CATALOGO_EDITAR",
  "PATCH /admin/productos/:id/variantes/:varianteId": "CATALOGO_EDITAR",
  "PATCH /admin/productos/:id/variantes/:varianteId/estado": "CATALOGO_EDITAR",
  "DELETE /admin/productos/:id": "CATALOGO_BORRAR",
  "GET /admin/productos/:id/imagenes": "CATALOGO_VER",
  "POST /admin/productos/:id/imagenes": "CATALOGO_EDITAR",
  "PUT /admin/productos/:id/imagenes/orden": "CATALOGO_EDITAR",
  "PATCH /admin/productos/:id/imagenes/:imagenId": "CATALOGO_EDITAR",
  "DELETE /admin/productos/:id/imagenes/:imagenId": "CATALOGO_EDITAR",
  "GET /admin/arrepentimientos": "PEDIDOS_VER",
  "GET /admin/pedidos": "PEDIDOS_VER",
  "GET /admin/pedidos/:id": "PEDIDOS_VER",
  "PATCH /admin/pedidos/:id/preparacion": "PEDIDOS_GESTIONAR",
  "POST /admin/pedidos/:id/cancelacion": "PEDIDOS_CANCELAR",
  "POST /admin/pedidos/:id/aviso": "PAGOS_CONFIRMAR",
  "POST /admin/pedidos/:id/pago-confirmado": "PAGOS_CONFIRMAR",
};

const RUTAS_ESPERADAS = 29;

/** Piden sesión, pero ningún permiso: cada usuario sobre su propia cuenta. */
const SOLO_SESION = ["GET /auth/yo", "PUT /auth/contrasena"];

/**
 * Rutas sin sesión, con el motivo. Cada una es una puerta abierta a internet:
 * una ruta nueva acá necesita un motivo que la revisión pueda discutir.
 */
const PUBLICAS = {
  "POST /auth/login": "Inicio de sesión, con limitador",
  "POST /auth/logout": "Borra la cookie de sesión del navegador que la llama",
  "GET /categorias": "Catálogo de la tienda",
  "GET /productos": "Catálogo de la tienda",
  "GET /productos/:slug": "Ficha de producto",
  "GET /zonas-envio": "Zonas para elegir el envío en el checkout",
  "POST /cotizar": "Total del carrito, calculado por la API; solo el limitador global",
  "POST /pedidos": "Checkout de la tienda, con limitador",
  "GET /pedidos/:numero": "Seguimiento por número, con limitador",
  "POST /pedidos/:numero/pago": "Reintentar el pago con Mercado Pago, con limitador",
  "POST /pedidos/:numero/comprobante": '"Ya transferí" de la clienta, con limitador',
  "POST /webhooks/mercadopago":
    "Avisos de Mercado Pago: verifica la firma y consulta el pago a su API",
  "POST /arrepentimientos": "Botón de arrepentimiento, exigido por ley, con limitador",
};

/** Rutas públicas definidas directo en la app (fuera de los routers). */
const RUTAS_DE_LA_APP = ["/api/v1/salud"];

// Cargar app.js entero (rutas, modelos, Sequelize) puede pasar los 5 s por defecto
// en Windows con el disco frío: es lento por naturaleza, no se cuelga.
jest.setTimeout(30000);

describe("rutas de la API", () => {
  let rutas;
  let todas;
  let authMiddleware;
  let permisoDe;
  let fueraDelInventario;

  beforeAll(() => {
    const app = require("../../src/app");
    ({ authMiddleware } = require("../../src/middlewares/authMiddleware"));
    ({ permisoDe } = require("../../src/middlewares/crearProteger"));

    // Recorre el router real. app.router.stack no es API pública de Express: si
    // una versión nueva cambia su forma, el test de cantidad de abajo falla en
    // vez de recorrer una lista vacía y pasar en verde.
    //
    // El recorrido solo ve rutas de routers montados en /api/v1. Para que ninguna
    // ruta de /admin se le escape por otro camino, cualquier forma distinta cuenta
    // como un hallazgo: una ruta definida directo en la app, un router montado en
    // otro prefijo, o un router o middleware anidado adentro de otro router.
    todas = [];
    fueraDelInventario = [];
    for (const [posicion, capa] of app.router.stack.entries()) {
      if (capa.route) {
        if (!RUTAS_DE_LA_APP.includes(capa.route.path)) {
          fueraDelInventario.push(`ruta en la app: ${capa.route.path}`);
        }
        continue;
      }
      if (!capa.handle?.stack) continue; // middleware de la app (cors, json, ...)
      const montaje = capa.matchers?.[0];
      // Montado exactamente en /api/v1: atiende cualquier cosa debajo de /api/v1 (no
      // solo /api/v1/admin, que sería un prefijo más largo) y nada fuera de ahí.
      if (!montaje || !montaje("/api/v1/cualquier-ruta") || montaje("/cualquier-ruta")) {
        fueraDelInventario.push(`router en la posición ${posicion} no montado en /api/v1`);
      }
      for (const sub of capa.handle.stack) {
        if (!sub.route) {
          fueraDelInventario.push(`capa sin ruta en el router de la posición ${posicion}`);
          continue;
        }
        const ruta = sub.route;
        for (const metodo of Object.keys(ruta.methods)) {
          todas.push({
            clave: `${metodo.toUpperCase()} ${ruta.path}`,
            handlers: ruta.stack.map((s) => s.handle),
          });
        }
      }
    }
    rutas = todas.filter(({ clave }) => clave.split(" ")[1].startsWith("/admin"));
  });

  /** Clave de cada ruta encontrada, para comparar con las tablas. */
  const claves = () => todas.map(({ clave }) => clave);
  const declaradas = () => [
    ...Object.keys(PERMISO_POR_RUTA),
    ...SOLO_SESION,
    ...Object.keys(PUBLICAS),
  ];

  test("no hay rutas fuera del inventario (montadas en otro lado o anidadas)", () => {
    // Si esto falla: la ruta nueva tiene que ir en un router montado en /api/v1,
    // con router.get/post/... y proteger. Un router.use o un sub-router ocultaría
    // rutas que este test no ve.
    expect(fueraDelInventario).toEqual([]);
  });

  test(`hay exactamente ${RUTAS_ESPERADAS} rutas de /admin`, () => {
    // Si este número cambió: verificá que las rutas nuevas usen proteger y
    // actualizá RUTAS_ESPERADAS y PERMISO_POR_RUTA.
    expect(rutas).toHaveLength(RUTAS_ESPERADAS);
    expect(Object.keys(PERMISO_POR_RUTA)).toHaveLength(RUTAS_ESPERADAS);
  });

  test("toda ruta de la API está declarada en una tabla, y toda ruta declarada existe", () => {
    // Si falla con una ruta sin declarar: si es del panel, va con proteger en
    // PERMISO_POR_RUTA; si de verdad tiene que ser pública, va en PUBLICAS con el motivo.
    const sinDeclarar = claves().filter((clave) => !declaradas().includes(clave));
    const inexistentes = declaradas().filter((clave) => !claves().includes(clave));

    expect(sinDeclarar).toEqual([]);
    expect(inexistentes).toEqual([]);
  });

  test("ninguna ruta de /admin se declara pública ni solo de sesión", () => {
    const deAdmin = [...SOLO_SESION, ...Object.keys(PUBLICAS)].filter((clave) =>
      clave.split(" ")[1].startsWith("/admin")
    );

    expect(deAdmin).toEqual([]);
  });

  test("las de solo sesión empiezan con la sesión y no pasan por proteger", () => {
    for (const { clave, handlers } of todas.filter((r) => SOLO_SESION.includes(r.clave))) {
      expect({ clave, primero: handlers[0] === authMiddleware }).toEqual({ clave, primero: true });
      expect({ clave, permisos: handlers.map(permisoDe).filter(Boolean) }).toEqual({
        clave,
        permisos: [],
      });
    }
  });

  test("las públicas no pasan por la sesión ni por proteger", () => {
    // Si una pública pasa a pedir sesión, la tabla ya no dice la verdad: movela.
    for (const { clave, handlers } of todas.filter((r) => Object.hasOwn(PUBLICAS, r.clave))) {
      const protegida = handlers.some((h) => h === authMiddleware || permisoDe(h) !== null);
      expect({ clave, protegida }).toEqual({ clave, protegida: false });
    }
  });

  test("todas las de /admin empiezan con la sesión y después el permiso esperado", () => {
    const encontradas = Object.fromEntries(
      rutas.map(({ clave, handlers }) => [
        clave,
        handlers[0] === authMiddleware ? permisoDe(handlers[1]) : "SIN SESIÓN PRIMERO",
      ])
    );

    expect(encontradas).toEqual(PERMISO_POR_RUTA);
  });
});
