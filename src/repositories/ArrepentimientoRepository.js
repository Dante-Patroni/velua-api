/**
 * @description Contrato del repositorio de solicitudes de arrepentimiento.
 */
class ArrepentimientoRepository {
  /**
   * @description Indica si un código de trámite ya está en uso.
   * @param {string} _codigo - Código a verificar.
   * @returns {Promise<boolean>} true si existe.
   */
  async existeCodigo(_codigo) {
    throw new Error("Metodo existeCodigo no implementado");
  }

  /**
   * @description Guarda la solicitud y encola sus mails, todo o nada.
   * @param {Object} _arrepentimiento - Solicitud normalizada, con su código.
   * @param {Array<{tipo: string, destinatario: string, datos: Object}>} _emails - Mails a encolar.
   * @returns {Promise<{codigo: string, creadoEn: Date}>} Solicitud guardada.
   */
  async registrar(_arrepentimiento, _emails) {
    throw new Error("Metodo registrar no implementado");
  }
}

module.exports = { ArrepentimientoRepository };
