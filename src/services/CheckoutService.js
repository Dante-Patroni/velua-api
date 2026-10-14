const crypto = require("crypto");

const { Cotizador } = require("./cotizador");
const { aCentavos } = require("../utils/dinero");
const { decidirReintentoMP } = require("./decidirReintentoMP");

/** Una preferencia se reusa si le quedan al menos estos minutos de vida. */
const MARGEN_PREFERENCIA_MS = 5 * 60 * 1000;

/**
 * @description Caracteres del número de pedido. Sin 0, O, 1, I ni L: se confunden
 * al dictar el número por teléfono o al leerlo en un mensaje.
 */
const ALFABETO = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

/**
 * @description Largo de la parte aleatoria. Con 31 caracteres, seis posiciones dan
 * casi novecientos millones de combinaciones: imposible de adivinar, y el número es
 * la llave para consultar el pedido sin iniciar sesión.
 */
const LARGO_NUMERO = 6;

/**
 * @description Horas que el stock queda apartado según el medio de pago. Con
 * transferencia, si la clienta avisa que pagó, el pedido deja de vencer.
 */
const VENCIMIENTO_HORAS = Object.freeze({ mercadopago: 1, transferencia: 24 });

const MEDIOS = Object.keys(VENCIMIENTO_HORAS);

/** Estados de pago desde los que todavía se puede pagar con Mercado Pago. */
const ESTADOS_PAGABLES = Object.freeze(["pendiente", "rechazado"]);

/**
 * @description Normaliza un número de pedido y verifica su forma.
 * @param {string} numero - Número tal como llegó.
 * @returns {string} Número en mayúsculas y sin espacios.
 * @throws {Error} NO_ENCONTRADO si no tiene forma de número de pedido.
 */
const normalizarNumero = (numero) => {
  const texto = String(numero ?? "")
    .trim()
    .toUpperCase();
  if (!/^VEL-[A-Z0-9]{4,12}$/.test(texto)) {
    throw new Error("NO_ENCONTRADO");
  }
  return texto;
};

/**
 * @description Genera un número de pedido con aleatoriedad criptográfica.
 *
 * `Math.random()` es predecible: con suficientes números vistos se pueden deducir
 * los siguientes. Como el número funciona como llave, se usa `crypto`.
 *
 * @returns {string} Por ejemplo "VEL-4K7Q2X".
 */
const generarNumero = () => {
  let parte = "";
  for (let i = 0; i < LARGO_NUMERO; i++) {
    parte += ALFABETO[crypto.randomInt(ALFABETO.length)];
  }
  return `VEL-${parte}`;
};

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
 * @description Verifica las reglas que dependen de más de un campo. El formato de
 * cada campo lo valida la ruta; acá va lo que la ruta no puede saber sola.
 * @param {Object} entrada - Datos del checkout.
 * @param {Object} entrada.entrega - Método de entrega, zona y dirección.
 * @param {string} entrada.medioPago - "mercadopago" o "transferencia".
 * @param {string} entrada.totalEsperado - Total que la clienta vio en pantalla.
 * @returns {void}
 * @throws {Error} DATOS_INVALIDOS
 */
const validarCoherencia = ({ entrega, medioPago, totalEsperado }) => {
  if (!MEDIOS.includes(medioPago)) {
    throw datosInvalidos({ medioPago: "Elegí cómo vas a pagar" });
  }

  if (entrega?.metodo === "envio") {
    const d = entrega.direccion ?? {};
    const faltan = ["calle", "numero", "ciudad", "provincia", "cp"].filter(
      (c) => !String(d[c] ?? "").trim()
    );
    if (!entrega.zonaEnvioId) {
      throw datosInvalidos({ "entrega.zonaEnvioId": "Elegí la zona de envío" });
    }
    if (faltan.length > 0) {
      throw datosInvalidos(
        Object.fromEntries(faltan.map((c) => [`entrega.direccion.${c}`, "Falta este dato"]))
      );
    }
  } else if (entrega?.metodo !== "retiro") {
    throw datosInvalidos({ "entrega.metodo": "Elegí envío o retiro" });
  }

  // aCentavos lanza DATOS_INVALIDOS si no tiene forma de importe
  aCentavos(totalEsperado);
};

/**
 * @description Fuente de datos para el cotizador dentro de la transacción. Lee las
 * variantes bloqueadas y se queda con una copia, para recuperar datos que el
 * cotizador no devuelve, como el SKU que el ítem del pedido tiene que congelar.
 */
class FuenteQueRecuerda {
  /**
   * @description Envuelve al repositorio transaccional.
   * @param {Object} tx - Repositorio transaccional.
   */
  constructor(tx) {
    this.tx = tx;
    this.leidas = new Map();
  }

  /**
   * @description Lee las variantes bloqueadas y guarda una copia de cada una.
   * @param {number[]} ids - Ids de las variantes.
   * @returns {Promise<Array<Object>>} Variantes bloqueadas.
   */
  async buscarVariantes(ids) {
    const variantes = await this.tx.buscarVariantes(ids);
    variantes.forEach((v) => this.leidas.set(v.id, v));
    return variantes;
  }

  /**
   * @description Busca una zona de envío dentro de la transacción.
   * @param {number} id - Id de la zona.
   * @returns {Promise<Object|null>} Zona, o null.
   */
  buscarZonaEnvio(id) {
    return this.tx.buscarZonaEnvio(id);
  }

  /**
   * @description Lista las zonas de envío dentro de la transacción.
   * @returns {Promise<Array<Object>>} Zonas.
   */
  listarZonasEnvio() {
    return this.tx.listarZonasEnvio();
  }
}

/**
 * @description Servicio de checkout: convierte un carrito en un pedido con el stock
 * apartado.
 *
 * Todo pasa dentro de una transacción. Si cualquier paso falla, no queda nada: ni
 * stock descontado, ni pedido a medias, ni mail en la bandeja.
 */
class CheckoutService {
  /**
   * @description Instancia el servicio.
   * @param {Object} pedidoRepository - Implementación de PedidoRepository.
   * @param {Object} [config] - Parámetros comerciales, los mismos del cotizador.
   * @param {() => Date} [ahora] - Reloj. Se inyecta para poder probar los vencimientos.
   * @param {Object|null} [procesadorPagos] - Implementación de ProcesadorPagos.
   * @param {{error: Function}} [logger] - Dónde anotar las fallas del procesador.
   * @param {Object} [dependencias] - Servicios para el reintento de pago.
   * @param {Object} [dependencias.pagoService] - Aplica un pago aprobado
   *   (PagoWebhookService).
   * @param {Object} [dependencias.pedidoEstadoService] - Marca revisiones
   *   (PedidoEstadoService).
   */
  constructor(
    pedidoRepository,
    config = {},
    ahora = () => new Date(),
    procesadorPagos = null,
    logger = console,
    { pagoService = null, pedidoEstadoService = null } = {}
  ) {
    this.repositorio = pedidoRepository;
    this.config = config;
    this.ahora = ahora;
    this.procesadorPagos = procesadorPagos;
    this.logger = logger;
    this.pagoService = pagoService;
    this.pedidoEstadoService = pedidoEstadoService;
  }

  /**
   * @description Crea un pedido con el stock apartado.
   *
   * Reusa el cotizador, pero dándole como fuente de datos las variantes bloqueadas
   * dentro de la transacción: el cálculo es el mismo código, sobre filas que nadie
   * puede cambiar hasta que termine.
   *
   * Es más estricto que el cotizador: nunca cobra algo distinto de lo que la clienta
   * vio. Si algo del carrito cambió, o si el total no coincide con el que se le
   * mostró, rechaza y el frontend vuelve a cotizar.
   *
   * @param {Object} entrada - Carrito, clienta, entrega, medio de pago y total visto.
   * @returns {Promise<Object>} Número, total, medio de pago, vencimiento y, con
   *   Mercado Pago, `urlPago` (null si el procesador no respondió).
   * @throws {Error} DATOS_INVALIDOS, CARRITO_DESACTUALIZADO, TOTAL_CAMBIO,
   *   CARRITO_SIN_ITEMS_VALIDOS, ZONA_INVALIDA, STOCK_INSUFICIENTE
   */
  async crearPedido(entrada) {
    validarCoherencia(entrada);

    const { items, cliente, entrega, medioPago, totalEsperado, notas } = entrada;
    const envio = entrega.metodo === "envio";

    // Se espera la transacción y no se devuelve a secas: crearPedido tiene que
    // seguir siendo async para que los errores de validarCoherencia lleguen como
    // promesa rechazada.
    const resultado = await this.repositorio.transaccion(async (tx) => {
      const fuente = new FuenteQueRecuerda(tx);
      const cotizador = new Cotizador(fuente, this.config);
      const cotizacion = await cotizador.cotizar({
        items,
        zonaEnvioId: envio ? entrega.zonaEnvioId : null,
        medioPago,
      });

      if (cotizacion.avisos.length > 0) {
        throw new Error("CARRITO_DESACTUALIZADO");
      }
      if (aCentavos(cotizacion.totales.total) !== aCentavos(totalEsperado)) {
        throw new Error("TOTAL_CAMBIO");
      }

      const lineas = [...cotizacion.items].sort((a, b) => a.varianteId - b.varianteId);
      for (const linea of lineas) {
        await tx.descontarStock(linea.varianteId, linea.cantidad);
      }

      const numero = await this.#numeroLibre(tx);
      const expiraEn = new Date(
        this.ahora().getTime() + VENCIMIENTO_HORAS[medioPago] * 60 * 60 * 1000
      );
      const t = cotizacion.totales;
      const d = envio ? entrega.direccion : {};

      const pedido = await tx.crearPedido({
        numero,
        clienteNombre: cliente.nombre.trim(),
        clienteEmail: cliente.email.trim().toLowerCase(),
        clienteTelefono: cliente.telefono.trim(),
        clienteDocumento: cliente.documento?.trim() || null,
        metodoEntrega: entrega.metodo,
        zonaEnvioId: envio ? entrega.zonaEnvioId : null,
        direccionCalle: d.calle?.trim() ?? null,
        direccionNumero: d.numero?.trim() ?? null,
        direccionExtra: d.extra?.trim() || null,
        direccionCiudad: d.ciudad?.trim() ?? null,
        direccionProvincia: d.provincia?.trim() ?? null,
        direccionCp: d.cp?.trim() ?? null,
        subtotal: t.subtotal,
        descuentoCupon: t.descuentoCupon,
        ajustePago: t.ajusteMedioPago,
        costoEnvio: t.costoEnvio,
        total: t.total,
        medioPago,
        expiraEn,
        notasCliente: notas?.trim() || null,
      });

      await tx.crearItems(
        cotizacion.items.map((i) => ({
          pedidoId: pedido.id,
          varianteId: i.varianteId,
          nombreProducto: i.productoNombre,
          nombreVariante: i.varianteNombre,
          sku: fuente.leidas.get(i.varianteId)?.sku ?? null,
          precioUnitario: i.precioUnitario,
          cantidad: i.cantidad,
          subtotal: i.subtotal,
        }))
      );

      await tx.registrarEvento({
        pedidoId: pedido.id,
        campo: "pago",
        estadoAnterior: null,
        estadoNuevo: "pendiente",
        origen: "checkout",
      });

      // Se encola acá y lo envía el job de H5. Si el encolado falla, falla todo:
      // un pedido sin su mail de confirmación es un pedido que la clienta no sabe
      // si se hizo.
      await tx.encolarEmail({
        pedidoId: pedido.id,
        tipo: "pedido_recibido",
        destinatario: cliente.email.trim().toLowerCase(),
        datos: {
          numero,
          nombre: cliente.nombre.trim(),
          medioPago,
          expiraEn: expiraEn.toISOString(),
          metodoEntrega: entrega.metodo,
          envio: cotizacion.envio,
          items: cotizacion.items.map((i) => ({
            producto: i.productoNombre,
            variante: i.varianteNombre,
            cantidad: i.cantidad,
            subtotal: i.subtotal,
          })),
          totales: t,
        },
      });

      return {
        pedidoId: pedido.id,
        numero,
        estadoPago: "pendiente",
        medioPago,
        total: t.total,
        expiraEn,
      };
    });

    // El id es interno: la respuesta pública identifica el pedido por su número
    const { pedidoId, ...publico } = resultado;
    if (medioPago !== "mercadopago") {
      return publico;
    }

    // Fuera de la transacción: el pedido ya está confirmado y el stock apartado. Si
    // Mercado Pago falla, el pedido sigue en pie y la clienta reintenta el pago.
    try {
      const urlPago = await this.#crearPreferencia({
        id: pedidoId,
        numero: publico.numero,
        total: publico.total,
        email: cliente.email.trim().toLowerCase(),
        expiraEn: publico.expiraEn,
      });
      return { ...publico, urlPago };
    } catch (error) {
      this.logger.error(
        `[checkout] ${publico.numero}: no se pudo crear el pago (${error.message})`,
        error.cause ?? ""
      );
      return { ...publico, urlPago: null };
    }
  }

  /**
   * @description Da el link de pago de un pedido de Mercado Pago que ya existe:
   * si al crearlo Mercado Pago no respondió, o para reintentar tras un rechazo.
   *
   * Antes de dar un link le pregunta a Mercado Pago si ya hay un pago, porque el
   * aviso puede no haber llegado todavía y la base decir "pendiente" con el pedido
   * pago. Si no puede preguntar, no da link (fail secure): esperar es mejor que
   * cobrar dos veces. Y reusa la preferencia del pedido en vez de crear otra, para
   * que nunca haya dos checkouts pagables a la vez.
   *
   * @param {string} numero - Número del pedido.
   * @returns {Promise<{numero: string, urlPago: string}>} Link de pago.
   * @throws {Error} NO_ENCONTRADO, PEDIDO_NO_PAGABLE, PEDIDO_EN_REVISION,
   *   PEDIDO_VENCIDO, PEDIDO_YA_PAGADO, PAGO_EN_PROCESO,
   *   PROCESADOR_NO_CONFIGURADO, PROCESADOR_NO_DISPONIBLE
   */
  async iniciarPago(numero) {
    const p = await this.repositorio.buscarPorNumero(normalizarNumero(numero));
    if (!p) {
      throw new Error("NO_ENCONTRADO");
    }
    if (p.medioPago !== "mercadopago" || !ESTADOS_PAGABLES.includes(p.estadoPago)) {
      throw new Error("PEDIDO_NO_PAGABLE");
    }
    // Un pedido de Mercado Pago pagable sin vencimiento está en revisión:
    // marcarRevision lo saca del vencimiento. (Al aprobar también se anula,
    // pero un pedido aprobado ya no es pagable y no llega hasta acá.)
    if (!p.expiraEn) {
      throw new Error("PEDIDO_EN_REVISION");
    }
    if (new Date(p.expiraEn) <= this.ahora()) {
      throw new Error("PEDIDO_VENCIDO");
    }
    if (!this.procesadorPagos) {
      throw new Error("PROCESADOR_NO_CONFIGURADO");
    }

    await this.#verificarPagosPrevios(p);
    const urlPago = await this.#linkDePago(p);
    return { numero: p.numero, urlPago };
  }

  /**
   * @description Consulta los pagos del pedido en Mercado Pago y, si no corresponde
   * dar otro link, registra lo que haya (pago aprobado, revisión) y lanza el error
   * para la clienta.
   * @param {Object} p - Pedido.
   * @returns {Promise<void>} Resuelve solo si se puede dar el link.
   * @throws {Error} PEDIDO_YA_PAGADO, PEDIDO_EN_REVISION, PAGO_EN_PROCESO,
   *   PROCESADOR_NO_DISPONIBLE
   */
  async #verificarPagosPrevios(p) {
    let pagos;
    try {
      pagos = await this.procesadorPagos.buscarPagosPorReferencia(p.numero);
    } catch (error) {
      this.logger.error(
        `[reintento] ${p.numero}: no se pudo consultar Mercado Pago, no se da link`,
        error
      );
      throw new Error("PROCESADOR_NO_DISPONIBLE", { cause: error });
    }

    const decision = decidirReintentoMP({ pagos, pedido: p });
    if (decision.permitir) {
      return;
    }

    if (decision.pagoAAplicar) {
      await this.pagoService.aplicarPago(decision.pagoAAplicar, { origen: "reintento" });
    }
    if (decision.revisar) {
      const ids = decision.pagosAprobados?.join(", ");
      await this.pedidoEstadoService.marcarRevision(p.id, {
        motivo: ids ? `${decision.motivo} (pagos aprobados: ${ids})` : decision.motivo,
      });
    }
    this.logger.info(`[reintento] ${p.numero}: no se da link (${decision.motivo})`);
    throw new Error(decision.codigo);
  }

  /**
   * @description Devuelve el link de la preferencia del pedido. Si la que tiene
   * sigue vigente la reusa; si no, crea una y la guarda solo si nadie se adelantó
   * (compare-and-set). Si otro reintento ganó, usa la del ganador: la creada acá
   * nunca llega a la clienta, así que no se puede pagar.
   * @param {Object} p - Pedido.
   * @returns {Promise<string>} URL de pago.
   * @throws {Error} PROCESADOR_NO_DISPONIBLE
   */
  async #linkDePago(p) {
    if (p.mpPreferenceId) {
      try {
        const { urlPago, venceEn } = await this.procesadorPagos.obtenerPreferencia(
          p.mpPreferenceId
        );
        if (!venceEn || venceEn.getTime() - this.ahora().getTime() > MARGEN_PREFERENCIA_MS) {
          return urlPago;
        }
      } catch (error) {
        // Si no existe se crea otra; si Mercado Pago falla, no se da link
        if (error.message !== "PREFERENCIA_NO_ENCONTRADA") {
          throw error;
        }
      }
    }

    const { preferenciaId, urlPago } = await this.procesadorPagos.crearPreferencia({
      numero: p.numero,
      total: p.total,
      email: p.clienteEmail,
      expiraEn: new Date(p.expiraEn),
    });
    const gano = await this.repositorio.guardarPreferencia(p.id, preferenciaId, {
      anterior: p.mpPreferenceId ?? null,
    });
    if (gano) {
      return urlPago;
    }

    this.logger.info(
      `[reintento] ${p.numero}: otro reintento guardó su preferencia antes, se usa esa`
    );
    const actual = await this.repositorio.buscarPorNumero(p.numero);
    const { urlPago: delGanador } = await this.procesadorPagos.obtenerPreferencia(
      actual.mpPreferenceId
    );
    return delGanador;
  }

  /**
   * @description Crea la preferencia en el procesador y guarda su id.
   * @param {Object} pedido - Datos del pedido.
   * @param {number} pedido.id - Id interno.
   * @param {string} pedido.numero - Número público.
   * @param {string} pedido.total - Total como cadena decimal.
   * @param {string} pedido.email - Mail de la clienta.
   * @param {Date} pedido.expiraEn - Vencimiento de la reserva.
   * @returns {Promise<string>} URL de pago.
   * @throws {Error} PROCESADOR_NO_CONFIGURADO, PROCESADOR_NO_DISPONIBLE
   */
  async #crearPreferencia({ id, numero, total, email, expiraEn }) {
    if (!this.procesadorPagos) {
      throw new Error("PROCESADOR_NO_CONFIGURADO");
    }
    const { preferenciaId, urlPago } = await this.procesadorPagos.crearPreferencia({
      numero,
      total,
      email,
      expiraEn,
    });
    await this.repositorio.guardarPreferencia(id, preferenciaId);
    return urlPago;
  }

  /**
   * @description Consulta el estado de un pedido por su número.
   *
   * Es público: lo usa la página de resultado, que no tiene sesión. Por eso no
   * devuelve ningún dato personal: ni nombre, ni mail, ni teléfono, ni dirección. El
   * número es imposible de adivinar, pero si alguien lo consiguiera, solo vería qué
   * se compró y en qué estado está.
   *
   * @param {string} numero - Número del pedido.
   * @returns {Promise<Object>} Estado, ítems y totales.
   * @throws {Error} NO_ENCONTRADO
   */
  async consultarPorNumero(numero) {
    const p = await this.repositorio.buscarPorNumero(normalizarNumero(numero));

    if (!p) {
      throw new Error("NO_ENCONTRADO");
    }

    return {
      numero: p.numero,
      estadoPago: p.estadoPago,
      estadoPedido: p.estadoPedido,
      medioPago: p.medioPago,
      metodoEntrega: p.metodoEntrega,
      expiraEn: p.expiraEn,
      comprobanteInformado:
        p.comprobanteInformadoEn !== null && p.comprobanteInformadoEn !== undefined,
      seguimiento: p.seguimiento ?? null,
      creadoEn: p.creadoEn,
      items: (p.items ?? []).map((i) => ({
        producto: i.nombreProducto,
        variante: i.nombreVariante,
        cantidad: i.cantidad,
        precioUnitario: i.precioUnitario,
        subtotal: i.subtotal,
      })),
      totales: {
        subtotal: p.subtotal,
        descuentoCupon: p.descuentoCupon,
        ajusteMedioPago: p.ajustePago,
        costoEnvio: p.costoEnvio,
        total: p.total,
      },
    };
  }

  /**
   * @description Genera un número que no esté en uso. Una colisión es casi
   * imposible, pero el costo de verificar es una consulta, y el índice único de la
   * tabla queda como última barrera.
   * @param {Object} tx - Repositorio transaccional.
   * @returns {Promise<string>} Número libre.
   * @throws {Error} Si cinco intentos seguidos chocan, algo anda mal con el generador.
   */
  async #numeroLibre(tx) {
    for (let intento = 0; intento < 5; intento++) {
      const numero = generarNumero();
      if (!(await tx.existeNumero(numero))) {
        return numero;
      }
    }
    throw new Error("No se pudo generar un número de pedido libre");
  }
}

module.exports = { CheckoutService, generarNumero, VENCIMIENTO_HORAS, ALFABETO };
