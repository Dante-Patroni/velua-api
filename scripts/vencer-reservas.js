/**
 * Corre una sola vuelta del job de vencimientos y termina.
 *
 * Sirve para probarlo a mano contra la base local sin esperar cinco minutos, y para
 * forzar una vuelta si alguna vez hiciera falta. Hace exactamente lo mismo que el
 * job programado: cancela solo lo vencido y deja intacto lo demás.
 *
 *   node scripts/vencer-reservas.js
 *
 * Termina con código 1 si hubo errores.
 */
require("dotenv").config();

const db = require("../src/models");
const { crearVencimientoReservas } = require("../src/jobs/vencimientoReservas");

(async () => {
  const resumen = await crearVencimientoReservas(db).ejecutarVuelta();
  console.log("Resumen de la vuelta:", resumen);
  await db.sequelize.close();
  process.exitCode = resumen.errores > 0 ? 1 : 0;
})();
