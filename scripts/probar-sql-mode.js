/**
 * Prueba con MySQL real de la guarda del sql_mode (src/config/sqlMode.js).
 *
 * 1. Con el sql_mode del servidor (el de la CI es el por defecto), la API se
 *    conecta: la guarda deja pasar.
 * 2. Con NO_BACKSLASH_ESCAPES en la sesión, la conexión no se abre: la guarda
 *    lanza SQL_MODE_INSEGURO. El modo se simula en la sesión con un hook que corre
 *    antes que la guarda; no se toca el sql_mode global del servidor.
 * 3. Las conexiones rechazadas se cierran: la cantidad de conexiones abiertas no
 *    crece después de varios rechazos.
 *
 * Solo lee y cambia su propia sesión, pero exige base local igual que las otras
 * pruebas, para no correrla contra producción por error.
 *
 *   node scripts/probar-sql-mode.js
 *
 * Termina con código 1 si algo no se cumple, así puede correr en el CI.
 */
require("dotenv").config();

const { exigirEntornoDeDesarrollo, exigirBaseLocal } = require("../src/config/soloDesarrollo");

const NOMBRE = "Prueba de la guarda del sql_mode";
const RECHAZOS = 3;

/**
 * @description Corta la prueba con un mensaje y código de error.
 * @param {string} mensaje - Qué falló.
 * @returns {never}
 */
const fallar = (mensaje) => {
  console.error(`\n✗ ${mensaje}`);
  process.exit(1);
};

try {
  exigirEntornoDeDesarrollo(NOMBRE);
  exigirBaseLocal(NOMBRE);
} catch (error) {
  fallar(error.message);
}

const { Sequelize } = require("sequelize");
const config = require("../src/config/config")[process.env.NODE_ENV || "development"];
const { instalarGuardaSqlMode } = require("../src/config/sqlMode");

/**
 * @description Instancia de Sequelize con la guarda, como la de la API.
 * @param {boolean} simularModoInseguro - Si agrega NO_BACKSLASH_ESCAPES a la sesión
 * antes de que corra la guarda.
 * @returns {Sequelize}
 */
const crearSequelize = (simularModoInseguro) => {
  const sequelize = new Sequelize(config.database, config.username, config.password, {
    ...config,
    logging: false,
  });
  if (simularModoInseguro) {
    sequelize.addHook(
      "afterConnect",
      "simularModoInseguro",
      (conexion) =>
        new Promise((resolver, rechazar) => {
          conexion.query(
            "SET SESSION sql_mode = CONCAT(@@SESSION.sql_mode, ',NO_BACKSLASH_ESCAPES')",
            (error) => (error ? rechazar(error) : resolver())
          );
        })
    );
  }
  instalarGuardaSqlMode(sequelize);
  return sequelize;
};

/**
 * @description Conexiones abiertas en el servidor.
 * @param {Sequelize} sequelize - Instancia conectada.
 * @returns {Promise<number>}
 */
const conexionesAbiertas = async (sequelize) =>
  Number((await sequelize.query("SHOW STATUS LIKE 'Threads_connected'", { plain: true })).Value);

const main = async () => {
  const segura = crearSequelize(false);
  try {
    await segura.authenticate();
  } catch (error) {
    fallar(`Con el sql_mode del servidor la conexión tendría que abrirse: ${error.message}`);
  }
  const modo = (await segura.query("SELECT @@SESSION.sql_mode AS modo", { plain: true })).modo;
  console.log(`✓ Con el sql_mode del servidor se conecta (${modo || "vacío"}).`);

  const antes = await conexionesAbiertas(segura);
  const insegura = crearSequelize(true);
  for (let i = 0; i < RECHAZOS; i++) {
    try {
      await insegura.authenticate();
      fallar("Con NO_BACKSLASH_ESCAPES la conexión se abrió: la guarda no corrió.");
    } catch (error) {
      if (error.code !== "SQL_MODE_INSEGURO") {
        fallar(`Se esperaba SQL_MODE_INSEGURO y llegó: ${error.code || error.message}`);
      }
    }
  }
  console.log(
    `✓ Con NO_BACKSLASH_ESCAPES no se conecta (${RECHAZOS} intentos, SQL_MODE_INSEGURO).`
  );

  // Las conexiones rechazadas se cierran en el servidor un instante después.
  await new Promise((resolver) => setTimeout(resolver, 500));
  const despues = await conexionesAbiertas(segura);
  if (despues > antes) {
    fallar(`Las conexiones rechazadas quedaron abiertas: ${antes} antes, ${despues} después.`);
  }
  console.log(`✓ Las conexiones rechazadas se cierran (${antes} antes, ${despues} después).`);

  await insegura.close();
  await segura.close();
  console.log("\nGuarda del sql_mode: OK");
};

main().catch((error) => fallar(error.message));
