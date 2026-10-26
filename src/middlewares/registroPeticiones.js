const { randomUUID } = require("node:crypto");

/** Encabezado con el que Railway identifica cada petición en su borde. */
const ENCABEZADO_ID_RAILWAY = "x-railway-request-id";

/** Forma aceptada para un id que llega de afuera: letras, números, - y _, hasta 64. */
const FORMATO_ID = /^[\w-]{1,64}$/;

/**
 * @description Devuelve el patrón de la ruta (`/api/v1/pedidos/:numero`), nunca
 * la URL real: el número de pedido funciona como llave para verlo y no tiene que
 * quedar en los logs. Tampoco se registra la query.
 * @param {import("express").Request} req - Request de Express.
 * @returns {string} El patrón, o "(sin ruta)" si ninguna ruta la atendió.
 */
const rutaDe = (req) => (req.route?.path ? `${req.baseUrl ?? ""}${req.route.path}` : "(sin ruta)");

/**
 * @description Crea el middleware que escribe una línea JSON por petición al
 * terminar la respuesta: método, patrón de ruta, status, duración, usuario de la
 * sesión, código de error e IP. Nunca registra cuerpo, query, cookies ni
 * encabezados: el log sirve para detectar y diagnosticar, no para reconstruir
 * datos de clientes.
 * @param {Object} [opciones] - Dependencias, para poder probarlo.
 * @param {(linea: string) => void} [opciones.escribir] - Dónde escribir la línea.
 * @param {() => number} [opciones.reloj] - Reloj en milisegundos.
 * @param {() => string} [opciones.generarId] - Generador de id de petición.
 * @returns {import("express").RequestHandler} El middleware.
 */
const crearRegistroPeticiones = ({
  // eslint-disable-next-line no-console
  escribir = (linea) => console.log(linea),
  reloj = () => performance.now(),
  generarId = randomUUID,
} = {}) => {
  return (req, res, next) => {
    const inicio = reloj();
    const recibido = req.get?.(ENCABEZADO_ID_RAILWAY);
    // Un id que llega de afuera solo se usa si tiene forma de id: así nadie mete
    // texto arbitrario en el log.
    const id = typeof recibido === "string" && FORMATO_ID.test(recibido) ? recibido : generarId();

    res.on("finish", () => {
      escribir(
        JSON.stringify({
          tipo: "peticion",
          id,
          metodo: req.method,
          ruta: rutaDe(req),
          status: res.statusCode,
          ms: Math.round(reloj() - inicio),
          usuario: req.usuario?.id ?? null,
          error: res.locals?.codigoError ?? null,
          ip: req.ip ?? null,
        })
      );
    });

    next();
  };
};

module.exports = { crearRegistroPeticiones, registroPeticiones: crearRegistroPeticiones() };
