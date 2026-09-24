/**
 * @description Interfaz del almacenamiento de imágenes.
 *
 * Existe por el mismo motivo que la interfaz de los repositorios y la de los
 * medios de pago: el servicio habla con este contrato y no con Cloudinary. Si
 * mañana se migra a otro proveedor, se agrega una implementación y el resto del
 * código no se toca.
 */
class ImagenStorage {
  /**
   * @description Sube una imagen y devuelve dónde quedó.
   * @param {Buffer} _archivo - Contenido del archivo.
   * @param {string} _carpeta - Carpeta destino dentro del proveedor.
   * @returns {Promise<{url: string, publicId: string}>} URL pública e identificador remoto.
   */
  async subir(_archivo, _carpeta) {
    throw new Error("Metodo subir no implementado");
  }

  /**
   * @description Borra una imagen del proveedor.
   * @param {string} _publicId - Identificador remoto guardado al subir.
   * @returns {Promise<boolean>} true si se borró, false si no existía.
   */
  async borrar(_publicId) {
    throw new Error("Metodo borrar no implementado");
  }
}

module.exports = ImagenStorage;
