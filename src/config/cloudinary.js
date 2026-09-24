const { v2: cloudinary } = require("cloudinary");

const FALTANTES = ["CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"].filter(
  (clave) => !process.env[clave]
);

if (FALTANTES.length > 0) {
  throw new Error(`Faltan variables de entorno: ${FALTANTES.join(", ")}`);
}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

module.exports = cloudinary;
