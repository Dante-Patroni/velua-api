const { authMiddleware } = require("./authMiddleware");
const { crearProteger } = require("./crearProteger");

/**
 * Cadena de protección de las rutas del panel, con la sesión real. Todas las
 * rutas de /admin la usan: `router.get("/admin/...", proteger(PERMISOS.X), ...)`.
 * La lógica está en crearProteger; acá solo se conecta el middleware de sesión.
 */
const proteger = crearProteger({ authMiddleware });

module.exports = { proteger };
