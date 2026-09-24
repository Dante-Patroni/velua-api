const cloudinary = require("../config/cloudinary");
const ImagenStorage = require("./ImagenStorage");

/**
 * @description Lado mayor máximo que se guarda. Una foto más grande que esto no
 * mejora nada en pantalla y consume cuota de más.
 */
const LADO_MAXIMO = 1600;

/**
 * @description Implementación del almacenamiento de imágenes con Cloudinary.
 */
class CloudinaryStorage extends ImagenStorage {
  /**
   * @description Sube una imagen desde memoria y devuelve su URL e identificador.
   *
   * La imagen se achica al subir si supera el lado máximo, y se guarda una sola
   * versión: los tamaños y formatos para cada pantalla salen después
   * transformando la URL, sin subir nada adicional.
   *
   * @param {Buffer} archivo - Contenido del archivo.
   * @param {string} carpeta - Carpeta destino, por ejemplo "velua/productos".
   * @returns {Promise<{url: string, publicId: string}>} URL pública e identificador remoto.
   * @throws {Error} ERROR_AL_SUBIR si el proveedor rechaza la subida.
   */
  subir(archivo, carpeta) {
    return new Promise((resolve, reject) => {
      const flujo = cloudinary.uploader.upload_stream(
        {
          folder: carpeta,
          resource_type: "image",
          transformation: [{ width: LADO_MAXIMO, height: LADO_MAXIMO, crop: "limit" }],
        },
        (error, resultado) => {
          if (error || !resultado) {
            // No se propaga el error del proveedor: puede traer credenciales.
            return reject(new Error("ERROR_AL_SUBIR"));
          }
          return resolve({ url: resultado.secure_url, publicId: resultado.public_id });
        }
      );

      flujo.end(archivo);
    });
  }

  /**
   * @description Borra una imagen de Cloudinary.
   * @param {string} publicId - Identificador remoto guardado al subir.
   * @returns {Promise<boolean>} true si se borró, false si ya no estaba.
   */
  async borrar(publicId) {
    try {
      const resultado = await cloudinary.uploader.destroy(publicId);
      return resultado?.result === "ok";
    } catch {
      // Un archivo huérfano en Cloudinary molesta menos que una fila en la base
      // apuntando a una imagen que ya no existe. El service borra la fila igual.
      return false;
    }
  }
}

module.exports = CloudinaryStorage;
