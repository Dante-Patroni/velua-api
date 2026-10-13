/**
 * Lleva a NFC los textos ya guardados en la base. Recorre todos los modelos y
 * sus columnas de texto (STRING, TEXT, CHAR).
 *
 * Por defecto solo lista lo que cambiaría. Con --aplicar escribe, todo en una
 * transacción: si algo falla, no queda nada a medias.
 *
 * Uso:
 *   node scripts/normalizar-textos.js            (simulación)
 *   node scripts/normalizar-textos.js --aplicar  (escribe)
 */
require("dotenv").config();
const db = require("../src/models");

const APLICAR = process.argv.includes("--aplicar");
const TIPOS_TEXTO = new Set(["STRING", "TEXT", "CHAR"]);
// Por las dudas: credenciales y tokens no se tocan nunca (igual son ASCII).
const SENSIBLE = /password|hash|token|secret/i;
// Solo de estas tablas se muestra el texto. Las demás tienen datos personales.
const MOSTRAR_TEXTO = new Set(["Producto", "Categoria", "Variante", "ImagenProducto", "ZonaEnvio"]);

/** Columnas de texto del modelo, sin las sensibles. */
const columnasTexto = (modelo) =>
  Object.entries(modelo.rawAttributes)
    .filter(([nombre, attr]) => TIPOS_TEXTO.has(attr.type?.key) && !SENSIBLE.test(nombre))
    .map(([nombre]) => nombre);

/** Muestra los códigos de los caracteres no ASCII, para ver la diferencia. */
const codigos = (texto) =>
  [...texto]
    .filter((c) => c.charCodeAt(0) > 127)
    .map((c) => `U+${c.codePointAt(0).toString(16).toUpperCase().padStart(4, "0")}`)
    .join(" ");

const main = async () => {
  const modelos = Object.values(db).filter((m) => m?.rawAttributes);
  let total = 0;

  await db.sequelize.transaction(async (transaction) => {
    for (const modelo of modelos) {
      const columnas = columnasTexto(modelo);
      if (columnas.length === 0) continue;

      const pk = modelo.primaryKeyAttribute;
      const filas = await modelo.findAll({
        attributes: [pk, ...columnas],
        raw: true,
        transaction,
      });

      for (const fila of filas) {
        const cambios = {};
        for (const columna of columnas) {
          const valor = fila[columna];
          if (typeof valor === "string" && valor !== valor.normalize("NFC")) {
            cambios[columna] = valor.normalize("NFC");
            const texto = MOSTRAR_TEXTO.has(modelo.name) ? `"${valor}" ` : "";
            console.log(
              `${modelo.name} #${fila[pk]} ${columna}: ${texto}[${codigos(valor)}] -> [${codigos(cambios[columna])}]`
            );
          }
        }

        if (Object.keys(cambios).length > 0) {
          total += 1;
          if (APLICAR) {
            // Sin hooks: no regenerar slugs ni disparar efectos. Silent: no tocar updatedAt.
            await modelo.update(cambios, {
              where: { [pk]: fila[pk] },
              hooks: false,
              silent: true,
              transaction,
            });
          }
        }
      }
    }
  });

  console.log(
    APLICAR
      ? `Listo: ${total} filas corregidas.`
      : `Simulación: ${total} filas para corregir. Corré con --aplicar para escribir.`
  );
};

main()
  .catch((error) => {
    console.error("Falló:", error.message);
    process.exitCode = 1;
  })
  .finally(() => db.sequelize.close());
