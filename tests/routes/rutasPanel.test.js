/**
 * Inventario de las rutas del panel (test ancla). Carga la app de verdad, recorre
 * el router de Express y verifica que TODA ruta de /admin empiece con proteger:
 * primero la sesión y después el permiso, y con el permiso esperado.
 *
 * Si agregás, sacás o cambiás el permiso de una ruta de /admin, este test falla a
 * propósito: verificá que la ruta use proteger con el permiso correcto y
 * actualizá la tabla. Esa línea del diff es la que tiene que mirar la revisión.
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

// Cargar app.js entero (rutas, modelos, Sequelize) puede pasar los 5 s por defecto
// en Windows con el disco frío: es lento por naturaleza, no se cuelga.
jest.setTimeout(30000);

describe("rutas del panel", () => {
  let rutas;
  let authMiddleware;
  let permisoDe;

  beforeAll(() => {
    const app = require("../../src/app");
    ({ authMiddleware } = require("../../src/middlewares/authMiddleware"));
    ({ permisoDe } = require("../../src/middlewares/crearProteger"));

    // Recorre el router real. app.router.stack no es API pública de Express: si
    // una versión nueva cambia su forma, el test de cantidad de abajo falla en
    // vez de recorrer una lista vacía y pasar en verde.
    rutas = [];
    for (const capa of app.router.stack) {
      for (const sub of capa.handle?.stack ?? []) {
        const ruta = sub.route;
        if (!ruta || !String(ruta.path).startsWith("/admin")) continue;
        for (const metodo of Object.keys(ruta.methods)) {
          rutas.push({
            clave: `${metodo.toUpperCase()} ${ruta.path}`,
            handlers: ruta.stack.map((s) => s.handle),
          });
        }
      }
    }
  });

  test(`hay exactamente ${RUTAS_ESPERADAS} rutas de /admin`, () => {
    // Si este número cambió: verificá que las rutas nuevas usen proteger y
    // actualizá RUTAS_ESPERADAS y PERMISO_POR_RUTA.
    expect(rutas).toHaveLength(RUTAS_ESPERADAS);
    expect(Object.keys(PERMISO_POR_RUTA)).toHaveLength(RUTAS_ESPERADAS);
  });

  test("todas empiezan con la sesión y después el permiso esperado", () => {
    const encontradas = Object.fromEntries(
      rutas.map(({ clave, handlers }) => [
        clave,
        handlers[0] === authMiddleware ? permisoDe(handlers[1]) : "SIN SESIÓN PRIMERO",
      ])
    );

    expect(encontradas).toEqual(PERMISO_POR_RUTA);
  });
});
