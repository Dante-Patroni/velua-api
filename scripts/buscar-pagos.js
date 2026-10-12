// Muestra los pagos que Mercado Pago tiene para uno o más pedidos, tal como los ve
// el job de vencimientos: usa el mismo adaptador, con su paginación y sus errores.
// Solo lee: no toca la base ni los pedidos.
// Uso: node scripts/buscar-pagos.js VEL-XXXXXX [VEL-YYYYYY ...]
require("dotenv").config();
const { MercadoPagoProcesador } = require("../src/pagos/MercadoPagoProcesador");

async function main() {
  const referencias = process.argv.slice(2);
  if (referencias.length === 0) {
    console.log("Uso: node scripts/buscar-pagos.js VEL-XXXXXX [VEL-YYYYYY ...]");
    process.exit(1);
  }

  const procesador = new MercadoPagoProcesador();
  let huboError = false;

  for (const referencia of referencias) {
    try {
      const pagos = await procesador.buscarPagosPorReferencia(referencia);
      console.log(`\n${referencia}: ${pagos.length} pago(s)`);
      pagos.forEach((p) => console.log(p));
    } catch (error) {
      huboError = true;
      // Solo el código y la causa que devuelve Mercado Pago: nunca credenciales
      console.log(`\n${referencia}: ${error.message}`, error.cause ?? "");
    }
  }

  process.exit(huboError ? 1 : 0);
}

main();