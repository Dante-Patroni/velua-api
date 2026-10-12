const crypto = require("crypto");

const { ALFABETO } = require("./CheckoutService");

const PREFIJO = "ARR-";
const LARGO_CODIGO = 6;
const INTENTOS_CODIGO = 5;

/**
 * @description Genera un código de trámite: ARR- y seis caracteres del mismo
 * alfabeto de los números de pedido, sin letras ni números que se confundan al
 * dictarlos por teléfono.
 * @returns {string} Código, por ejemplo ARR-K7Q2XM.
 */
const generarCodigo = () => {
  let parte = "";
  for (let i = 0; i < LARGO_CODIGO; i++) {
    parte += ALFABETO[crypto.randomInt(ALFABETO.length)];
  }
  return `${PREFIJO}${parte}`;
};

/**
 * @description Recorta un texto opcional y lo deja en null si queda vacío.
 * @param {*} valor - Valor recibido.
 * @returns {string|null} Texto recortado, o null.
 */
const textoOpcional = (valor) => {
  const texto = typeof valor === "string" ? valor.trim() : "";
  return texto === "" ? null : texto;
};

/**
 * @description Registra solicitudes de arrepentimiento (Resolución 424/2020).
 *
 * Siempre registra y siempre devuelve un código de trámite: no confirma si el
 * pedido existe (el formulario no tiene que servir para averiguar números de
 * pedido) ni controla el plazo legal, que evalúa la dueña. La forma de los datos
 * ya viene validada por la ruta.
 */
class ArrepentimientoService {
  /**
   * @description Instancia el servicio.
   * @param {import("../repositories/ArrepentimientoRepository").ArrepentimientoRepository} arrepentimientoRepository - Repositorio.
   * @param {Object} [config] - Configuración.
   * @param {string|null} [config.emailAvisos] - A quién avisar de cada solicitud. Por defecto, EMAIL_AVISOS.
   * @param {() => string} [generar] - Generador de códigos. Se inyecta en los tests.
   */
  constructor(
    arrepentimientoRepository,
    { emailAvisos = process.env.EMAIL_AVISOS } = {},
    generar = generarCodigo
  ) {
    this.repositorio = arrepentimientoRepository;
    this.emailAvisos = emailAvisos || null;
    this.generar = generar;
  }

  /**
   * @description Registra una solicitud y encola el mail a la clienta, con su
   * código, y el aviso a la dueña.
   * @param {Object} entrada - Datos del formulario, con la forma ya validada.
   * @param {string} [entrada.pedidoNumero] - Número de pedido, si lo tiene.
   * @param {string} entrada.nombre - Nombre.
   * @param {string} entrada.email - Email.
   * @param {string} [entrada.telefono] - Teléfono.
   * @param {string} [entrada.motivo] - Motivo. Es opcional: no hace falta justificar.
   * @returns {Promise<{codigo: string, creadoEn: Date}>} Código de trámite.
   * @throws {Error} CODIGO_NO_DISPONIBLE si no encuentra un código libre.
   */
  async registrar(entrada) {
    const datos = {
      pedidoNumero: textoOpcional(entrada.pedidoNumero)?.toUpperCase() ?? null,
      nombre: entrada.nombre.trim(),
      email: entrada.email.trim().toLowerCase(),
      telefono: textoOpcional(entrada.telefono),
      motivo: textoOpcional(entrada.motivo),
    };
    const codigo = await this.#codigoLibre();

    const emails = [
      {
        tipo: "arrepentimiento_recibido",
        destinatario: datos.email,
        datos: { codigo, nombre: datos.nombre, pedidoNumero: datos.pedidoNumero },
      },
    ];
    if (this.emailAvisos) {
      emails.push({
        tipo: "arrepentimiento_aviso",
        destinatario: this.emailAvisos,
        datos: { codigo, ...datos },
      });
    }

    const creado = await this.repositorio.registrar({ ...datos, codigo }, emails);
    return { codigo: creado.codigo, creadoEn: creado.creadoEn };
  }

  /**
   * @description Busca un código que no esté en uso.
   * @returns {Promise<string>} Código libre.
   * @throws {Error} CODIGO_NO_DISPONIBLE
   */
  async #codigoLibre() {
    for (let intento = 0; intento < INTENTOS_CODIGO; intento++) {
      const codigo = this.generar();
      if (!(await this.repositorio.existeCodigo(codigo))) {
        return codigo;
      }
    }
    throw new Error("CODIGO_NO_DISPONIBLE");
  }
}

module.exports = { ArrepentimientoService, generarCodigo };
