/**
 * Genera el hash de una contraseña nueva para restablecerla a mano, mientras no
 * exista la recuperación por mail (t42). No se conecta a ninguna base: la de
 * producción solo es accesible por la red privada de Railway.
 *
 * Uso: node scripts/hash-contrasena.js
 *
 * Pide la contraseña por teclado y sin mostrarla, nunca como argumento: lo que
 * se pasa como argumento queda en el historial de la terminal y en la lista de
 * procesos. Aplica la misma política y el mismo costo de bcrypt que la API, e
 * imprime el UPDATE para pegar en Railway → MySQL → Data.
 * 
 * Si mientras se escribe la contraseña se usa Retroceso o las flechas, la
 * pregunta puede desaparecer de la pantalla: readline redibuja la línea y la
 * salida está silenciada. La contraseña igual no se ve. Seguir escribiendo.
 */
const readline = require("readline");
const bcrypt = require("bcryptjs");

const { COSTO_BCRYPT } = require("../src/services/AuthService");
const { motivoDeRechazo, MENSAJES_RECHAZO } = require("../src/services/politicaContrasena");

/** Mail sin espacios ni comillas: va dentro de un UPDATE. */
const MAIL_VALIDO = /^[^\s@'"\\;]+@[^\s@'"\\;]+\.[^\s@'"\\;]+$/;

/**
 * @description Hace una pregunta en la terminal.
 * @param {string} texto - La pregunta.
 * @param {Object} [opciones] - Opciones.
 * @param {boolean} [opciones.oculta] - Si es true, no muestra lo que se escribe.
 * @returns {Promise<string>} La respuesta.
 */
function preguntar(texto, { oculta = false } = {}) {
    return new Promise((resolve) => {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
        let silenciar = false;
        rl._writeToOutput = (cadena) => {
            if (!silenciar) rl.output.write(cadena);
        };
        rl.question(texto, (respuesta) => {
            rl.close();
            if (oculta) process.stdout.write("\n");
            resolve(respuesta);
        });
        // La pregunta ya se mostró: desde acá, si es oculta, no se ve lo que se escribe.
        silenciar = oculta;
    });
}

/**
 * @description Pide los datos, valida y muestra el UPDATE.
 * @returns {Promise<void>}
 */
async function main() {
    const email = (await preguntar("Mail de la usuaria: ")).trim().toLowerCase();
    if (!MAIL_VALIDO.test(email)) {
        console.error("Ese mail no es válido. No se generó nada.");
        process.exit(1);
    }

    const nueva = await preguntar("Contraseña nueva (no se muestra): ", { oculta: true });
    const repetida = await preguntar("Repetila: ", { oculta: true });
    if (nueva !== repetida) {
        console.error("No coinciden. No se generó nada.");
        process.exit(1);
    }

    const motivo = motivoDeRechazo(nueva, { actual: undefined, email });
    if (motivo) {
        console.error(`Rechazada: ${MENSAJES_RECHAZO[motivo]}`);
        process.exit(1);
    }

    const hash = await bcrypt.hash(nueva, COSTO_BCRYPT);
    console.log("\nPegá esta línea en Railway → MySQL → Data. Tiene que afectar 1 fila:\n");
    console.log(
        `UPDATE usuarios SET password_hash = '${hash}', version_sesion = version_sesion + 1 WHERE email = '${email}';`
    );
    console.log("\nDespués cerrá esta terminal: el hash no tiene que quedar a la vista.");
}

main();