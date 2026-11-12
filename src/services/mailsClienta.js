/**
 * @description Encola un mail para la clienta, solo si tiene a dónde mandarlo.
 *
 * Las ventas del panel pueden no tener email (venta en persona). Sin destinatario,
 * no se encola nada y la operación sigue: el pedido se crea, el pago se confirma,
 * el pedido se despacha o se cancela igual. Si se intentara encolar, la fila de
 * emails_pendientes (destinatario NOT NULL) haría fallar toda la transacción.
 *
 * Es la única puerta para encolar mails a la clienta: los servicios no llaman a
 * tx.encolarEmail directamente (lo verifica tests/services/mailsClienta.test.js).
 *
 * @param {Object} tx - Repositorio transaccional.
 * @param {Object} email - Lo mismo que recibe tx.encolarEmail.
 * @param {string|null} email.destinatario - Email de la clienta, o null.
 * @returns {Promise<boolean>} True si lo encoló, false si no había destinatario.
 */
const encolarParaClienta = async (tx, email) => {
  if (typeof email.destinatario !== "string" || email.destinatario.trim() === "") {
    return false;
  }
  await tx.encolarEmail(email);
  return true;
};

module.exports = { encolarParaClienta };
