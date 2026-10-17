/**
 * Regla de "Próximamente": un producto con fecha de disponibilidad futura no se vende,
 * aunque tenga stock. "Hoy" siempre es la fecha de Argentina y la calcula el servidor.
 */

const ZONA_NEGOCIO = "America/Buenos_Aires";
const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;
const MS_POR_DIA = 24 * 60 * 60 * 1000;

/**
 * @description Fecha de hoy en Argentina, como "AAAA-MM-DD".
 * @param {Date} [ahora] - Instante a convertir (para tests).
 * @returns {string} La fecha, por ejemplo "2026-10-17".
 */
const hoyEnArgentina = (ahora = new Date()) =>
    new Intl.DateTimeFormat("en-CA", {
        timeZone: ZONA_NEGOCIO,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(ahora);

/**
 * @description Convierte "AAAA-MM-DD" a milisegundos UTC de ese día.
 * @param {string} texto - Fecha en formato "AAAA-MM-DD".
 * @returns {number} NaN si no es una fecha real.
 */
const aDia = (texto) => {
    if (typeof texto !== "string" || !FECHA_ISO.test(texto)) return NaN;
    const ms = Date.parse(`${texto}T00:00:00Z`);
    // Date.parse acepta "2026-02-31" corriéndolo de mes: se rechaza comparando de vuelta.
    return Number.isNaN(ms) || new Date(ms).toISOString().slice(0, 10) !== texto ? NaN : ms;
};

/**
 * @description Decide si un producto se puede vender hoy.
 * @param {{disponibleDesde?: string|null}} producto - Producto con su fecha de disponibilidad, o sin ella.
 * @param {string} hoy - Fecha de hoy en Argentina ("AAAA-MM-DD").
 * @returns {{estado: "disponible"|"proximamente", diasRestantes: number|null}} El estado de venta y, si es próximamente, cuántos días faltan.
 */
const estadoVenta = (producto, hoy) => {
    const desde = producto?.disponibleDesde ?? null;
    if (desde === null || desde === "") return { estado: "disponible", diasRestantes: null };

    const diaDesde = aDia(desde);
    const diaHoy = aDia(hoy);
    // Fail secure: una fecha que no se puede interpretar nunca habilita la venta.
    if (Number.isNaN(diaDesde) || Number.isNaN(diaHoy)) {
        return { estado: "proximamente", diasRestantes: null };
    }

    const dias = Math.round((diaDesde - diaHoy) / MS_POR_DIA);
    return dias > 0
        ? { estado: "proximamente", diasRestantes: dias }
        : { estado: "disponible", diasRestantes: null };
};

module.exports = { estadoVenta, hoyEnArgentina };
