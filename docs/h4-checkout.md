# H4 · Checkout y pagos

_Estado: en curso. Paso 1 terminado y en producción._

## Objetivo

Convertir un carrito en un pedido pagado: la clienta confirma, el sistema le aparta
el stock, cobra, y se entera de que cobró.

**Terminado cuando:** una compra real de monto chico se aprueba con Mercado Pago, el
webhook la registra, el stock baja, y la colección de Newman cubre el flujo completo.

---

## Las ideas que sostienen todo el hito

**El pedido se crea antes de cobrar.** Dos motivos: el stock tiene que quedar apartado
mientras la clienta paga, y Mercado Pago necesita una referencia nuestra para decirnos
después a qué pedido corresponde cada pago.

**Nunca vemos la tarjeta.** La clienta paga en la página de Mercado Pago. Eso nos
saca de encima toda la responsabilidad de manejar datos de tarjetas.

**La vuelta del navegador no prueba nada.** La dirección a la que vuelve la clienta
se puede escribir a mano, y además puede cerrar la pestaña antes de volver. Esa página
sirve para mostrar un mensaje, nunca para marcar un pedido como pagado.

**La confirmación real es el webhook.** Mercado Pago le avisa a nuestro servidor
directamente. Ese aviso:

- puede llegar más de una vez → se registra primero y se ignora si ya estaba
  (**idempotencia**);
- no se cree → con el id que trae se le pregunta a Mercado Pago el estado real;
- puede no ser nuestro → la cuenta es personal, así que se descarta todo pago que no
  traiga una referencia de la tienda;
- puede llegar antes que la clienta → la página de resultado tiene que poder esperar.

**La clave de idempotencia es la pareja proveedor más id.** Dos proveedores
distintos pueden usar el mismo número de operación.

---

## Decisiones

**Tomadas**

- Mercado Pago con **Checkout Pro**: la clienta va a la página de Mercado Pago. Sin
  formulario de tarjeta propio.
- Cuenta de Mercado Pago: la personal de la dueña de la marca, con su CUIT y su
  condición fiscal actualizados.
- **Transferencia manual para arrancar.** La clienta ve alias, CBU, titular, monto
  exacto y código del pedido, y avisa por WhatsApp con un botón "Ya transferí". La
  dueña confirma el pago desde el panel. Sin comisión.
- **El aviso de la clienta pausa el vencimiento.** Un pedido con "comprobante
  informado" no lo cancela el job: solo se cancela a mano. Evita el peor caso, que es
  cancelar un pedido que ya está pagado.
- Si el volumen crece, se suma un proveedor automático **como otro adaptador de
  pagos**. El checkout no se entera del cambio.
- Se reemplaza `mp_notificaciones` por una tabla genérica, `notificaciones_pago`.

- Vencimiento de la reserva distinto según el medio: **1 hora** para Mercado Pago,
  **24 horas** para transferencia, salvo que la clienta haya informado el pago. Las
  transferencias son inmediatas y funcionan todos los días; el plazo apura a la
  clienta, y el aviso la protege a ella.
- El job de vencimientos entra en este hito y no en H5: sin él, cada checkout
  abandonado deja stock apartado para siempre.
- Código de pedido aleatorio, tipo `VEL-4K7Q2`, en la columna `numero` que ya existe.
  El id numérico revela cuántas ventas hubo.
- Datos que se piden: nombre, mail y teléfono siempre; dirección solo si hay envío.

**Pendiente, con el contador**

- El precio por transferencia. La Ley de Tarjetas prohíbe diferencias de precio entre
  contado y tarjeta en un pago, aunque la práctica del "descuento por contado" está
  muy extendida. El sistema soporta las dos opciones con la variable
  `DESCUENTO_TRANSFERENCIA`: en cero, todos pagan lo mismo. No hay código que dependa
  de esta decisión.

---

## Pasos

Cada uno es una rama y un PR. Lo que no depende de servicios externos va primero.

### 1. Migraciones y seed ✅

`feat/migraciones-checkout`

- Tabla `emails_pendientes`: la bandeja de salida. El checkout escribe ahí y el job
  de H5 envía.
- Tabla `notificaciones_pago`, con índice único sobre `(proveedor, id_externo)`.
  Reemplaza a `mp_notificaciones`.
- Código público del pedido, si la tabla no lo tiene.
- Seed con pedidos de prueba en distintos estados.

_Terminado cuando:_ las migraciones van y vuelven, y el seed deja pedidos para ver.

### 2. Servicio de checkout ✅

`feat/checkout`

- Recotiza el carrito con el cotizador: los precios pueden haber cambiado.
- Transacción con `SELECT ... FOR UPDATE`, bloqueando las variantes **en orden de id**.
- Verifica stock, descuenta, crea el pedido y sus ítems con precio y nombre congelados.
- Fija el vencimiento según el medio de pago.
- Escribe el mail de "recibimos tu pedido" en la bandeja de salida.
- Endpoint público para crear el pedido, y otro para consultar su estado por código.

El código del pedido funciona como llave para consultarlo, así que tiene que ser
imposible de adivinar, y el endpoint devuelve el estado sin datos personales.

_Terminado cuando:_ se crea un pedido desde Postman, el stock baja, y un test prueba
dos compras simultáneas de la última unidad.

### 3. Job de vencimientos

`feat/vencimiento-reservas`

Cada cinco minutos busca pedidos con pago pendiente y vencidos, los cancela por la
máquina de estados y devuelve el stock.

_Terminado cuando:_ un pedido vencido a propósito vuelve su stock solo.

### 4. Adaptador de pagos y Mercado Pago

`feat/pagos-mercadopago`

- Interfaz `crearPago(pedido)` y `procesarNotificacion(aviso)`.
- Implementación de Mercado Pago: crea la preferencia con la referencia del pedido,
  la dirección del webhook y las direcciones de vuelta.
- Credenciales de **prueba** para desarrollar.

_Terminado cuando:_ el checkout devuelve un link de pago y se puede pagar con un
usuario de prueba.

### 5. Webhook

`feat/webhook-pagos`

- Registra el aviso en `notificaciones_pago` antes que nada; si ya estaba, responde y
  corta.
- Responde rápido y procesa aparte.
- Consulta el pago real a Mercado Pago.
- Descarta los pagos sin referencia de la tienda.
- Verifica que el monto coincida con el total del pedido.
- Cambia el estado por la máquina, nunca con un update suelto.

_Terminado cuando:_ el mismo aviso enviado dos veces produce un solo efecto, y un
pago ajeno no toca ningún pedido.

### 6. Páginas de resultado

Frontend: aprobado, pendiente y rechazado. Consultan el estado real por código y se
actualizan solas mientras el pago se confirma.

### 7. Transferencia manual

`feat/pagos-transferencia`

El segundo adaptador. No llama a ningún servicio: devuelve los datos bancarios y el
monto, y deja el pedido en pago pendiente.

- Pantalla de instrucciones con alias, CBU, titular, monto exacto y código.
- Botón "Ya transferí" que abre WhatsApp con un mensaje armado con el código, y marca
  el pedido como "comprobante informado".
- El job de vencimientos no toca los pedidos con comprobante informado.

La confirmación del pago la hace la dueña desde la pantalla de pedidos, que es H5.
Hasta entonces, los pedidos por transferencia se crean pero no se confirman: como la
tienda no abre antes de H5, no es un problema.

_Terminado cuando:_ un pedido por transferencia muestra las instrucciones, y avisar el
pago impide que venza.

### 8. Cierre

Colección de Newman del flujo completo, y una compra real de monto chico en producción.

---

## Lo que depende de otras personas

- **Credenciales de Mercado Pago.** La dueña de la marca crea una aplicación en el
  panel de desarrolladores con su usuario. De prueba para desarrollar; de producción
  para el cierre.
- **Datos bancarios** para la transferencia: alias, CBU y titular de la cuenta.
- **Proveedor de transferencias automáticas**: solo si el volumen lo justifica.
  Candidatos a consultar, Mobbex y Talo.

**El token de producción es la llave de la caja.** Va solamente a las variables de
Railway: nunca al repositorio ni a un mensaje.

---

## Preguntas para los proveedores de transferencia

1. ¿Dan de alta a una monotributista, o piden ser empresa?
2. ¿Un CVU por pedido con monto exacto, o un CVU único de la tienda?
3. ¿Cuál es la comisión por transferencia recibida?
4. ¿Cuánto tarda la plata en estar disponible, y cuánto cuesta retirarla?
5. ¿Tienen entorno de pruebas?
6. ¿Qué pasa si la clienta transfiere otro monto o fuera de plazo?

La comisión importa para el descuento por transferencia: tiene que ser menor que la
diferencia de costo con la tarjeta, o la marca pierde plata en cada venta.

---

## Riesgos

**Las cuentas de prueba de Mercado Pago nunca funcionan a la primera.** Reservar
tiempo para eso en el paso 4.

**La clienta que transfiere y no avisa.** Si eso coincide con un fin de semana sin
revisar el banco, el pedido vence estando pagado. El panel destaca los pedidos por
vencer, y en H5 conviene avisarle a la dueña cada vez que se cancela uno por
transferencia, para que revise si entró la plata.

**La confirmación manual va a hacer falta igual.** Monto distinto, transferencia
fuera de plazo, proveedor caído: alguien tiene que poder marcar un pedido como pagado
a mano. Esa pantalla es parte de H5.

**El alcance.** Cupones, cuotas sin interés, otros medios: todo a `IDEAS.md`.
