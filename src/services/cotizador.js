const { aCentavos, aImporte, porcentajeDe, redondearAlPeso } = require("../utils/dinero");
const { estadoVenta, hoyEnArgentina } = require("./estadoVenta");

/** Unidades máximas por variante en un mismo pedido. */
const TOPE_POR_VARIANTE = 10;

/** Ítems distintos máximos en un carrito. */
const TOPE_ITEMS = 30;

/** Medios de pago de la tienda, en el orden en que se informan. */
const MEDIOS_PAGO = Object.freeze(["mercadopago", "transferencia"]);

/**
 * @description Medios que existen solo en las ventas del panel. Nunca entran en
 * MEDIOS_PAGO: la tienda no los ofrece aunque estén configurados. Para cotizarlos
 * hace falta pedirlo explícitamente con `incluirEfectivo: true`, y eso lo hace
 * solo la ruta del panel, que tiene su propio permiso.
 */
const MEDIOS_SOLO_PANEL = Object.freeze(["efectivo"]);

/**
 * @description Motivos por los que un ítem se quita o se ajusta. El frontend
 * los traduce; acá nunca se arman textos para mostrar.
 */
const AVISOS = Object.freeze({
  VARIANTE_INEXISTENTE: "VARIANTE_INEXISTENTE",
  VARIANTE_INACTIVA: "VARIANTE_INACTIVA",
  PRODUCTO_INACTIVO: "PRODUCTO_INACTIVO",
  PROXIMAMENTE: "PROXIMAMENTE",
  SIN_STOCK: "SIN_STOCK",
  AJUSTADO_POR_STOCK: "AJUSTADO_POR_STOCK",
  AJUSTADO_POR_TOPE: "AJUSTADO_POR_TOPE",
});

/**
 * @description Imagen principal del producto: la de menor orden. Es un dato de
 * presentación: si el producto no tiene fotos, o si las imágenes no vinieron en
 * la consulta (como en la creación de pedidos), devuelve null y la cotización sigue.
 * @param {Object} producto - Producto de la variante, con sus imágenes si las trae.
 * @returns {{url: string, alt: string|null}|null} La imagen principal, o null.
 */
const imagenPrincipal = (producto) => {
  const imagenes = Array.isArray(producto?.imagenes) ? producto.imagenes : [];
  if (imagenes.length === 0) {
    return null;
  }
  const [primera] = [...imagenes].sort((a, b) => a.orden - b.orden);
  return { url: primera.url, alt: primera.alt ?? null };
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
 * @description Verifica la forma del carrito antes de tocar la base.
 *
 * Son errores de programación del cliente, no situaciones que le puedan pasar a
 * quien compra: un carrito vacío o una cantidad negativa no se arreglan
 * ajustando, se rechazan.
 *
 * @param {Array<Object>} items - Ítems recibidos.
 * @returns {void}
 * @throws {Error} DATOS_INVALIDOS
 */
const validarForma = (items) => {
  if (!Array.isArray(items) || items.length === 0) {
    throw datosInvalidos({ items: "El carrito no puede estar vacío" });
  }

  if (items.length > TOPE_ITEMS) {
    throw datosInvalidos({ items: `El carrito admite hasta ${TOPE_ITEMS} productos` });
  }

  const vistos = new Set();

  items.forEach((item, i) => {
    const id = Number(item?.varianteId);
    const cantidad = Number(item?.cantidad);

    if (!Number.isInteger(id) || id <= 0) {
      throw datosInvalidos({ [`items[${i}].varianteId`]: "Identificador inválido" });
    }
    if (!Number.isInteger(cantidad) || cantidad <= 0) {
      throw datosInvalidos({
        [`items[${i}].cantidad`]: "La cantidad tiene que ser un entero mayor que cero",
      });
    }
    if (vistos.has(id)) {
      throw datosInvalidos({
        [`items[${i}].varianteId`]: "El producto aparece dos veces en el carrito",
      });
    }
    vistos.add(id);
  });
};

/**
 * @description Servicio de cotización. Recibe un carrito y devuelve cuánto hay
 * que pagar.
 *
 * Es el único lugar del sistema donde se calculan totales. El frontend nunca
 * suma precios: si el navegador calculara, cualquiera podría cambiar los
 * números antes de enviarlos.
 *
 * Cotizar no modifica nada. El stock se verifica pero no se reserva: eso ocurre
 * al crear el pedido.
 */
class Cotizador {
  /**
   * @description Instancia el cotizador.
   * @param {Object} cotizacionRepository - Implementación de CotizacionRepository.
   * @param {Object} [config] - Parámetros comerciales.
   * @param {string} [config.umbralEnvioGratis] - Monto desde el que el envío es gratis.
   *   Null o ausente significa que no hay envío gratis.
   * @param {number} [config.descuentoTransferencia] - Porcentaje de descuento por
   *   pagar con transferencia.
   * @param {number} [config.descuentoEfectivo] - Porcentaje de descuento por pagar
   *   en efectivo (solo ventas del panel).
   * @param {{mercadopago?: boolean, transferencia?: boolean, efectivo?: boolean}} [config.mediosDisponibles] -
   *   Qué medios se pueden usar hoy. Solo cuenta un `true` explícito: lo que falte
   *   se informa como no disponible (falla cerrado).
   * @param {Function} [config.hoy] - Devuelve la fecha de hoy "AAAA-MM-DD" en la
   *   zona del negocio. Se inyecta en los tests; por defecto, la de Argentina.
   */
  constructor(cotizacionRepository, config = {}) {
    this.repositorio = cotizacionRepository;
    this.umbralEnvioGratis = config.umbralEnvioGratis ?? null;
    this.descuentoTransferencia = Number(config.descuentoTransferencia ?? 0);
    this.descuentoEfectivo = Number(config.descuentoEfectivo ?? 0);
    this.mediosDisponibles = Object.freeze(
      Object.fromEntries(
        [...MEDIOS_PAGO, ...MEDIOS_SOLO_PANEL].map((medio) => [
          medio,
          config.mediosDisponibles?.[medio] === true,
        ])
      )
    );
    this.hoy = typeof config.hoy === "function" ? config.hoy : hoyEnArgentina;
  }

  /**
   * @description Cotiza un carrito.
   *
   * El orden del cálculo está fijado y no se cambia sin hablarlo: el cupón se
   * aplica antes que el descuento por medio de pago, porque si fuera al revés
   * los descuentos se acumularían sobre un número ya rebajado y la marca
   * cobraría de menos. Y el envío gratis se decide después de los descuentos,
   * sobre lo que efectivamente se paga.
   *
   * @param {Object} pedido - Datos de la cotización.
   * @param {Array<{varianteId: number, cantidad: number}>} pedido.items - Carrito.
   * @param {number} [pedido.zonaEnvioId] - Zona elegida. Sin zona, se cotiza como retiro.
   * @param {string} [pedido.medioPago] - "transferencia" o "mercadopago"; "efectivo"
   *   solo con `incluirEfectivo`.
   * @param {boolean} [pedido.incluirEfectivo=false] - Solo la ruta del panel lo pasa.
   *   Sin un `true` explícito, el efectivo no aparece en `mediosPago` ni descuenta,
   *   aunque esté configurado.
   * @returns {Promise<Object>} Ítems cotizados, avisos, totales del medio elegido y,
   *   en `mediosPago`, si cada medio está disponible y su total. El total de cada
   *   medio lo calcula acá, con su descuento y su envío: el envío gratis depende del
   *   monto ya descontado, así que la diferencia entre medios no es solo el descuento.
   * @throws {Error} DATOS_INVALIDOS, CARRITO_SIN_ITEMS_VALIDOS, ZONA_INVALIDA, DATOS_DE_VENTA_INCOMPLETOS
   */
  async cotizar({ items, zonaEnvioId, medioPago, incluirEfectivo = false }) {
    const medios = incluirEfectivo === true ? [...MEDIOS_PAGO, ...MEDIOS_SOLO_PANEL] : MEDIOS_PAGO;

    validarForma(items);

    const variantes = await this.repositorio.buscarVariantes(
      items.map((i) => Number(i.varianteId))
    );
    const porId = new Map(variantes.map((v) => [v.id, v]));

    // Una sola fecha para todo el carrito: si la cotización cruza la medianoche,
    // todos los ítems se evalúan contra el mismo día.
    const hoy = this.hoy();
    const { lineas, avisos } = this.#resolverLineas(items, porId, hoy);

    if (lineas.length === 0) {
      throw new Error("CARRITO_SIN_ITEMS_VALIDOS");
    }

    const subtotal = lineas.reduce((suma, l) => suma + l.subtotalCentavos, 0);

    // El cupón va primero. Todavía no hay cupones, pero el lugar está.
    const descuentoCupon = 0;
    const base = subtotal - descuentoCupon;

    const ajustePago = medios.includes(medioPago) ? this.#ajustePorMedioDePago(base, medioPago) : 0;
    const conDescuentos = base - ajustePago;

    const zona = await this.#buscarZona(zonaEnvioId);
    const envio = this.#calcularEnvio(zona, conDescuentos);

    const total = redondearAlPeso(conDescuentos + envio.costoCentavos);

    // El mismo cálculo para cada medio, con la zona ya buscada: una sola consulta.
    const mediosPago = Object.fromEntries(
      medios.map((medio) => {
        if (!this.mediosDisponibles[medio]) return [medio, { disponible: false, total: null }];
        const conDescuentoDelMedio = base - this.#ajustePorMedioDePago(base, medio);
        const envioDelMedio = this.#calcularEnvio(zona, conDescuentoDelMedio);
        const totalDelMedio = redondearAlPeso(conDescuentoDelMedio + envioDelMedio.costoCentavos);
        return [medio, { disponible: true, total: aImporte(totalDelMedio) }];
      })
    );

    return {
        items: lineas.map((l) => ({
        varianteId: l.varianteId,
        productoNombre: l.productoNombre,
        productoSlug: l.productoSlug,
        imagen: l.imagen,
        varianteNombre: l.varianteNombre,
        cantidad: l.cantidad,
        precioUnitario: aImporte(l.precioCentavos),
        subtotal: aImporte(l.subtotalCentavos),
      })),
      avisos,
      totales: {
        subtotal: aImporte(subtotal),
        descuentoCupon: aImporte(descuentoCupon),
        ajusteMedioPago: aImporte(ajustePago),
        costoEnvio: aImporte(envio.costoCentavos),
        total: aImporte(total),
      },
      envio: envio.detalle,
      mediosPago,
    };
  }

  /**
   * @description Lista las zonas de envío para que el checkout las muestre.
   * @returns {Promise<Array<Object>>} Zonas con su costo como cadena.
   */
  async listarZonasEnvio() {
    const zonas = await this.repositorio.listarZonasEnvio();

    return zonas.map((z) => ({
      id: z.id,
      nombre: z.nombre,
      costo: aImporte(aCentavos(z.costo)),
      demora: z.demoraTexto ?? null,
    }));
  }

  /**
   * @description Convierte cada ítem del carrito en una línea con su precio
   * real, o en un aviso si no se puede vender.
   *
   * Los precios salen de la base, nunca del carrito: el cliente manda qué y
   * cuánto, el servidor pone cuánto cuesta.
   *
   * @param {Array<Object>} items - Ítems recibidos.
   * @param {Map<number, Object>} porId - Variantes encontradas, por id.
   * @param {string} hoy - Fecha de hoy "AAAA-MM-DD" en la zona del negocio.
   * @returns {{lineas: Array<Object>, avisos: Array<Object>}} Líneas válidas y avisos.
   */
  #resolverLineas(items, porId, hoy) {
    const lineas = [];
    const avisos = [];

    for (const item of items) {
      const varianteId = Number(item.varianteId);
      const pedida = Number(item.cantidad);
      const variante = porId.get(varianteId);

      if (!variante) {
        avisos.push({ varianteId, motivo: AVISOS.VARIANTE_INEXISTENTE });
        continue;
      }

      const nombre = `${variante.producto?.nombre ?? ""}`.trim();

      if (!variante.activa) {
        avisos.push({ varianteId, motivo: AVISOS.VARIANTE_INACTIVA, producto: nombre });
        continue;
      }
      if (!variante.producto?.activo) {
        avisos.push({ varianteId, motivo: AVISOS.PRODUCTO_INACTIVO, producto: nombre });
        continue;
      }
      // Falla segura: undefined no es "sin fecha" (eso es null), es un dato que
      // no llegó. Sin él no se puede saber si el producto ya se vende.
      const disponibleDesde = variante.producto.disponibleDesde;
      if (disponibleDesde === undefined) {
        throw new Error("DATOS_DE_VENTA_INCOMPLETOS");
      }
      if (estadoVenta({ disponibleDesde }, hoy).estado === "proximamente") {
        avisos.push({ varianteId, motivo: AVISOS.PROXIMAMENTE, producto: nombre, disponibleDesde });
        continue;
      }
      if (variante.stock <= 0) {
        avisos.push({ varianteId, motivo: AVISOS.SIN_STOCK, producto: nombre });
        continue;
      }

      // Dos limites distintos: el stock es un hecho, el tope es una decision
      // comercial. Mandan los dos, pero se avisa solo el que efectivamente
      // recorto la cantidad: dos avisos sobre el mismo producto se contradicen.
      const limite = Math.min(variante.stock, TOPE_POR_VARIANTE);
      const cantidad = Math.min(pedida, limite);

      if (cantidad < pedida) {
        avisos.push(
          limite === TOPE_POR_VARIANTE
            ? {
                varianteId,
                motivo: AVISOS.AJUSTADO_POR_TOPE,
                producto: nombre,
                pedida,
                maximo: TOPE_POR_VARIANTE,
              }
            : {
                varianteId,
                motivo: AVISOS.AJUSTADO_POR_STOCK,
                producto: nombre,
                pedida,
                disponible: variante.stock,
              }
        );
      }

      const precioCentavos = aCentavos(variante.precio);

        lineas.push({
        varianteId,
        productoNombre: nombre,
        productoSlug: variante.producto?.slug ?? null,
        imagen: imagenPrincipal(variante.producto),
        varianteNombre: variante.nombre,
        cantidad,
        precioCentavos,
        subtotalCentavos: precioCentavos * cantidad,
      });
    }

    return { lineas, avisos };
  }

  /**
   * @description Calcula el descuento por el medio de pago elegido.
   * @param {number} baseCentavos - Monto sobre el que se aplica.
   * @param {string} [medioPago] - Medio elegido.
   * @returns {number} El descuento en centavos. Cero si no corresponde.
   */
  #ajustePorMedioDePago(baseCentavos, medioPago) {
    const porcentaje = {
      transferencia: this.descuentoTransferencia,
      efectivo: this.descuentoEfectivo,
    }[medioPago];
    if (!(porcentaje > 0)) return 0;
    return porcentajeDe(baseCentavos, porcentaje);
  }

  /**
   * @description Busca la zona de envío elegida.
   * @param {number} [zonaEnvioId] - Zona elegida. Sin zona, es retiro en persona.
   * @returns {Promise<Object|null>} La zona, o null si es retiro.
   * @throws {Error} ZONA_INVALIDA si la zona no existe o está inactiva.
   */
  async #buscarZona(zonaEnvioId) {
    if (zonaEnvioId === undefined || zonaEnvioId === null) {
      return null;
    }

    const zona = await this.repositorio.buscarZonaEnvio(Number(zonaEnvioId));
    if (!zona) {
      throw new Error("ZONA_INVALIDA");
    }
    return zona;
  }

  /**
   * @description Calcula el costo del envío.
   *
   * El envío gratis se decide sobre el monto ya descontado: si un cupón baja el
   * total por debajo del umbral, el envío se cobra. El beneficio se mide sobre
   * lo que efectivamente se paga.
   *
   * @param {Object|null} zona - Zona ya buscada, o null si es retiro.
   * @param {number} montoCentavos - Monto después de los descuentos.
   * @returns {{costoCentavos: number, detalle: Object}} Costo y detalle.
   */
  #calcularEnvio(zona, montoCentavos) {
    if (zona === null) {
      return {
        costoCentavos: 0,
        detalle: { modo: "retiro", zonaId: null, nombre: null, gratis: false },
      };
    }

    const costo = aCentavos(zona.costo);
    const umbral = this.umbralEnvioGratis === null ? null : aCentavos(this.umbralEnvioGratis);
    const gratis = umbral !== null && montoCentavos >= umbral;

    return {
      costoCentavos: gratis ? 0 : costo,
      detalle: {
        modo: "envio",
        zonaId: zona.id,
        nombre: zona.nombre,
        demora: zona.demoraTexto ?? null,
        gratis,
      },
    };
  }
}

module.exports = {
  Cotizador,
  AVISOS,
  TOPE_POR_VARIANTE,
  TOPE_ITEMS,
  MEDIOS_PAGO,
  MEDIOS_SOLO_PANEL,
  imagenPrincipal,
};
