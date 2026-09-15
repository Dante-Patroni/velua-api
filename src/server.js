const app = require("./app");
const { sequelize } = require("./models");

const PORT = process.env.PORT || 3000;

/**
 * @description Verifica la conexion a la base y levanta el servidor HTTP.
 * @returns {Promise<void>}
 */
const iniciar = async () => {
  try {
    await sequelize.authenticate();
    app.listen(PORT, () => {
      console.log(`Velua API escuchando en el puerto ${PORT}`);
    });
  } catch (error) {
    console.error("Error fatal al iniciar el servidor:", error.message);
    process.exit(1);
  }
};

iniciar();