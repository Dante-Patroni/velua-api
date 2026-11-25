/**
 * Prueba con MySQL real de la guarda del sql_mode (src/config/sqlMode.js).
 *
 * 1. Con la configuración de la API (src/config/config.js, que registra la guarda)
 *    y el sql_mode del servidor (el de la CI es el por defecto), se conecta.
 * 2. Con NO_BACKSLASH_ESCAPES en la sesión, la conexión no se abre: la guarda
 *    lanza SQL_MODE_INSEGURO. El modo se simula en la sesión con un hook que corre
 *    antes que la guarda; no se toca el sql_mode global del servidor.
 * 3. Las conexiones rechazadas se cierran: el id de cada una (threadId) ya no
 *    aparece en performance_schema.processlist. Se mira por id y no por la
 *    cantidad total, porque otras conexiones del servidor (la API de la CI) pueden
 *    abrirse y cerrarse al mismo tiempo y tapar una que quedó abierta.
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
const { verificarSqlMode } = require("../src/config/sqlMode");

/** Ids (threadId) de las conexiones que la guarda tiene que rechazar. */
const rechazadas = [];

/**
 * @description Agrega NO_BACKSLASH_ESCAPES a la sesión y anota el id de la conexión.
 * @param {Object} conexion - Conexión de mysql2.
 * @returns {Promise<void>}
 */
const simularModoInseguro = (conexion) =>
  new Promise((resolver, rechazar) => {
    rechazadas.push(conexion.threadId);
    conexion.query(
      "SET SESSION sql_mode = CONCAT(@@SESSION.sql_mode, ',NO_BACKSLASH_ESCAPES')",
      (error) => (error ? rechazar(error) : resolver())
    );
  });

/**
 * @description Instancia de Sequelize armada desde la configuración de la API.
 * @param {boolean} simular - Si corre `simularModoInseguro` antes de la guarda.
 * @returns {Sequelize}
 */
const crearSequelize = (simular) =>
  new Sequelize(config.database, config.username, config.password, {
    ...config,
    logging: false,
    // Sin simular, los hooks son los de config.js: así se prueba también que la
    // configuración registra la guarda. Simulando, el orden se fija a mano: la
    // simulación primero y la misma guarda después.
    ...(simular ? { hooks: { afterConnect: [simularModoInseguro, verificarSqlMode] } } : {}),
  });

/**
 * @description Cuántas de las conexiones rechazadas siguen abiertas en el servidor.
 * @param {Sequelize} sequelize - Instancia conectada.
 * @returns {Promise<number>}
 */
const rechazadasAbiertas = async (sequelize) => {
  const [filas] = await sequelize.query(
    "SELECT ID FROM performance_schema.processlist WHERE ID IN (:ids)",
    { replacements: { ids: rechazadas } }
  );
  return filas.length;
};

const main = async () => {
  const segura = crearSequelize(false);
  if (!segura.options.hooks.afterConnect?.includes(verificarSqlMode)) {
    fallar("La configuración de la API no registra la guarda en afterConnect.");
  }
  try {
    await segura.authenticate();
  } catch (error) {
    fallar(`Con el sql_mode del servidor la conexión tendría que abrirse: ${error.message}`);
  }
  const modo = (await segura.query("SELECT @@SESSION.sql_mode AS modo", { plain: true })).modo;
  console.log(`✓ Con el sql_mode del servidor se conecta (${modo || "vacío"}).`);

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

  if (rechazadas.length !== RECHAZOS) {
    fallar(`Se esperaban ${RECHAZOS} conexiones rechazadas y se anotaron ${rechazadas.length}.`);
  }
  // Las conexiones rechazadas se cierran en el servidor un instante después.
  await new Promise((resolver) => setTimeout(resolver, 500));
  const abiertas = await rechazadasAbiertas(segura);
  if (abiertas > 0) {
    fallar(`Quedaron abiertas ${abiertas} de las ${RECHAZOS} conexiones rechazadas.`);
  }
  console.log(`✓ Las ${RECHAZOS} conexiones rechazadas se cerraron en el servidor.`);

  await insegura.close();
  await segura.close();
  console.log("\nGuarda del sql_mode: OK");
};

main().catch((error) => fallar(error.message));
