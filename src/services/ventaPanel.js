const crypto = require("crypto");
const { aCentavos, aImporte } = require("../utils/dinero");

/** Medios de pago de una venta del panel. Mercado Pago no: la venta ya ocurrió. */
const MEDIOS_PANEL = ["efectivo", "transferencia"];

/** Métodos de entrega de una venta del panel. */
const ENTREGAS_PANEL = ["envio", "retiro", "en_mano"];

/** Datos de la dirección, en el orden en que entran en la huella. */
const CAMPOS_DIRECCION = ["calle", "numero", "extra", "ciudad", "provincia", "cp"];

/** Versión del armado de la huella. Ver huellaDeVenta. */
const VERSION_HUELLA = 1;

/** Formato de la clave de idempotencia: un UUID (cualquier versión), en minúsculas. */
const FORMATO_CLAVE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * @description Crea un error de datos inválidos con el detalle por campo.
 * @param {Object} details - Mensajes por campo.
 * @returns {Error} Error con details adjunto.
 */
const datosInvalidos = (details) => {
  const error = new Error("DATOS_INVALIDOS");
  error.details = details;
  return error;
};

/**
 * @description Texto sin espacios de los bordes, o null si queda vacío o no vino.
 * @param {*} valor - Lo que llegó.
 * @returns {string|null} El texto limpio, o null.
 */
const textoONull = (valor) => {
  if (valor === undefined || valor === null) return null;
  const texto = String(valor).trim();
  return texto === "" ? null : texto;
};

/**
 * @description Arma la venta del panel tal como se va a guardar, a partir de los
 * datos ya validados por la ruta. Es la ÚNICA normalización: el mismo objeto sirve
 * para calcular la huella y para crear el pedido. Si fueran dos, la huella podría
 * describir una venta y el servicio guardar otra.
 *
 * - Textos sin espacios de los bordes; lo vacío o ausente, null.
 * - Email en minúsculas.
 * - Ítems ordenados por variante: el orden en que se cargaron no cambia la venta.
 * - Dirección y zona solo con envío. Con retiro o en mano, si vienen, es un error y
 *   no se descartan en silencio: no se guarda un domicilio que no hace falta.
 * - Total esperado con dos decimales, a partir de sus centavos.
 *
 * @param {Object} datos - Datos validados (matchedData) de la venta.
 * @returns {Object} La venta normalizada.
 * @throws {Error} DATOS_INVALIDOS si no hay datos, si el total no tiene forma de
 *   importe o si vienen una dirección o una zona sin envío.
 */
const normalizarVenta = (datos) => {
  if (datos === null || typeof datos !== "object") {
    throw datosInvalidos({ venta: "Faltan los datos de la venta" });
  }
  const envio = datos.entrega?.metodo === "envio";
  const direccion = datos.entrega?.direccion;
  if (!envio && direccion !== undefined && direccion !== null) {
    throw datosInvalidos({ "entrega.direccion": "La dirección va solo con envío" });
  }
  const zona = datos.entrega?.zonaEnvioId;
  if (!envio && zona !== undefined && zona !== null) {
    throw datosInvalidos({ "entrega.zonaEnvioId": "La zona va solo con envío" });
  }

  return {
    items: (datos.items ?? [])
      .map((i) => ({ varianteId: Number(i.varianteId), cantidad: Number(i.cantidad) }))
      .sort((a, b) => a.varianteId - b.varianteId),
    cliente: {
      nombre: textoONull(datos.cliente?.nombre),
      telefono: textoONull(datos.cliente?.telefono),
      email: textoONull(datos.cliente?.email)?.toLowerCase() ?? null,
      documento: textoONull(datos.cliente?.documento),
    },
    entrega: {
      metodo: datos.entrega?.metodo ?? null,
      zonaEnvioId: envio ? Number(datos.entrega.zonaEnvioId) : null,
      direccion:
        envio && direccion
          ? Object.fromEntries(CAMPOS_DIRECCION.map((c) => [c, textoONull(direccion[c])]))
          : null,
    },
    medioPago: datos.medioPago ?? null,
    cobradoEnEfectivo: datos.cobradoEnEfectivo === true,
    totalEsperado: aImporte(aCentavos(datos.totalEsperado)),
    notas: textoONull(datos.notas),
  };
};

/**
 * @description Verifica las reglas de la venta del panel que dependen de más de un
 * campo. El formato de cada campo lo valida la ruta; esto es la segunda barrera, por
 * si el servicio se llama desde otro lado.
 * @param {Object} venta - Venta normalizada.
 * @returns {void}
 * @throws {Error} DATOS_INVALIDOS con el campo.
 */
const validarVentaPanel = (venta) => {
  if (venta.items.length === 0) {
    throw datosInvalidos({ items: "Agregá al menos un producto" });
  }
  const vistas = new Set();
  for (const { varianteId, cantidad } of venta.items) {
    if (!Number.isInteger(varianteId) || varianteId < 1) {
      throw datosInvalidos({ items: "Hay una variante inválida" });
    }
    if (!Number.isInteger(cantidad) || cantidad < 1) {
      throw datosInvalidos({ items: "Las cantidades son enteros desde 1" });
    }
    if (vistas.has(varianteId)) {
      throw datosInvalidos({ items: "Hay una variante repetida" });
    }
    vistas.add(varianteId);
  }
  if (!venta.cliente.nombre || !venta.cliente.telefono) {
    throw datosInvalidos({ cliente: "Faltan el nombre o el teléfono" });
  }
  if (!MEDIOS_PANEL.includes(venta.medioPago)) {
    throw datosInvalidos({ medioPago: "Efectivo o transferencia" });
  }
  if (venta.cobradoEnEfectivo && venta.medioPago !== "efectivo") {
    throw datosInvalidos({ cobradoEnEfectivo: "Solo con efectivo" });
  }
  if (!ENTREGAS_PANEL.includes(venta.entrega.metodo)) {
    throw datosInvalidos({ "entrega.metodo": "Envío, retiro o en mano" });
  }
  if (venta.entrega.metodo === "envio") {
    if (!Number.isInteger(venta.entrega.zonaEnvioId) || venta.entrega.zonaEnvioId < 1) {
      throw datosInvalidos({ "entrega.zonaEnvioId": "Elegí la zona de envío" });
    }
    const d = venta.entrega.direccion ?? {};
    const faltan = ["calle", "numero", "ciudad", "provincia", "cp"].filter((c) => !d[c]);
    if (faltan.length > 0) {
      throw datosInvalidos(
        Object.fromEntries(faltan.map((c) => [`entrega.direccion.${c}`, "Falta este dato"]))
      );
    }
  }
};

/**
 * @description Normaliza y valida la clave de idempotencia.
 * @param {*} clave - Lo que mandó el panel.
 * @returns {string} La clave en minúsculas.
 * @throws {Error} DATOS_INVALIDOS si no es un UUID.
 */
const normalizarClave = (clave) => {
  const texto = typeof clave === "string" ? clave.trim().toLowerCase() : "";
  if (!FORMATO_CLAVE.test(texto)) {
    throw datosInvalidos({ "Idempotency-Key": "Tiene que ser un UUID" });
  }
  return texto;
};

/**
 * @description Huella de la venta: SHA-256 en hex de un JSON con las claves en un
 * orden fijo. Distingue un reintento (misma clave, misma huella) de una clave
 * reusada con otra venta (misma clave, otra huella).
 *
 * El JSON se arma a mano, sin depender del orden de las claves del objeto que
 * llega. Lleva la versión: si algún día cambia el armado, las ventas viejas siguen
 * comparándose con la suya. Cambiarlo sin subir la versión convertiría reintentos
 * legítimos en CLAVE_REUTILIZADA.
 *
 * @param {Object} venta - Venta normalizada (normalizarVenta).
 * @returns {string} 64 caracteres hex.
 */
const huellaDeVenta = (venta) => {
  const canonica = {
    v: VERSION_HUELLA,
    items: venta.items.map(({ varianteId, cantidad }) => ({ varianteId, cantidad })),
    cliente: {
      nombre: venta.cliente.nombre,
      telefono: venta.cliente.telefono,
      email: venta.cliente.email,
      documento: venta.cliente.documento,
    },
    entrega: {
      metodo: venta.entrega.metodo,
      zonaEnvioId: venta.entrega.zonaEnvioId,
      direccion: venta.entrega.direccion
        ? Object.fromEntries(CAMPOS_DIRECCION.map((c) => [c, venta.entrega.direccion[c]]))
        : null,
    },
    medioPago: venta.medioPago,
    cobradoEnEfectivo: venta.cobradoEnEfectivo,
    totalEsperado: venta.totalEsperado,
    notas: venta.notas,
  };
  return crypto.createHash("sha256").update(JSON.stringify(canonica)).digest("hex");
};

module.exports = {
  normalizarVenta,
  validarVentaPanel,
  normalizarClave,
  huellaDeVenta,
  MEDIOS_PANEL,
  ENTREGAS_PANEL,
};
