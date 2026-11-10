const app = require("./app");
const db = require("./models");
const { crearVencimientoReservas } = require("./jobs/vencimientoReservas");
const {
  avisarSiEstaDeshabilitada,
  avisarSiEstaDeshabilitadaEnPanel,
  configTransferencia,
  configTransferenciaEnPanel,
} = require("./config/transferencia");
const { avisarSiEstaDeshabilitado, configEfectivo } = require("./config/efectivo");

const PORT = process.env.PORT || 3000;

/**
 * @description Verifica la conexion a la base, levanta el servidor HTTP y arranca
 * los trabajos programados.
 * @returns {Promise<void>}
 */
const iniciar = async () => {
  try {
    await db.sequelize.authenticate();
    // Acá y no al cargar el módulo: los tests cargan la app y llenarían el log.
    avisarSiEstaDeshabilitada(configTransferencia);
    avisarSiEstaDeshabilitadaEnPanel(configTransferenciaEnPanel);
    avisarSiEstaDeshabilitado(configEfectivo);
    app.listen(PORT, () => {
      // eslint-disable-next-line no-console
      console.log(`Velua API escuchando en el puerto ${PORT}`);
    });

    // Recién con la base confirmada: el job la usa en su primera vuelta
    crearVencimientoReservas(db).iniciar();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Error fatal al iniciar el servidor:", error.message);
    process.exit(1);
  }
};

iniciar();
