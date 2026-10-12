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

  /**
   * @description Lista solicitudes, de la más nueva a la más vieja.
   * @param {{estado: string|null, pagina: number, limite: number}} _filtros - Filtro y página.
   * @returns {Promise<{filas: Object[], total: number}>} Página de solicitudes y total.
   */
  async listar(_filtros) {
    throw new Error("Metodo listar no implementado");
  }
}

module.exports = { ArrepentimientoRepository };
