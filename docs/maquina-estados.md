# Máquina de estados del pedido

Documento de referencia para implementar `services/pedidoEstado.js`.

**Regla que no se negocia:** ninguna transición de estado se hace con un `update`
suelto. Todas pasan por el servicio, que valida si la transición es legal y ejecuta
sus efectos. Si hace falta un estado nuevo, se agrega acá primero.

Un pedido tiene **dos estados independientes**: el del pago y el de la preparación.
Se llevan por separado porque responden a cosas distintas — el pago lo mueve el
procesador, la preparación la mueve la dueña de la marca — y mezclarlos en un solo
campo obliga a inventar combinaciones absurdas.

---

## 1. Estado de pago

```
                    ┌──────────────┐
                    │  pendiente   │  ← estado inicial, al crear el pedido
                    └──────┬───────┘
                           │
          ┌────────────────┼────────────────┐
          │                │                │
          ▼                ▼                ▼
    ┌──────────┐    ┌─────────────┐   ┌───────────┐
    │ aprobado │    │  rechazado  │   │ cancelado │
    └────┬─────┘    └──────┬──────┘   └───────────┘
         │                 │            (terminal)
         │                 │ reintento
         │                 └──────────────┐
         │                                ▼
         │                         ┌─────────────┐
         │                         │  pendiente  │
         │                         └─────────────┘
         ▼
    ┌──────────┐
    │ devuelto │  (terminal)
    └──────────┘
```

### Transiciones legales

| Desde       | Hacia       | Quién la dispara                   |
| ----------- | ----------- | ---------------------------------- |
| `pendiente` | `aprobado`  | Webhook del procesador             |
| `pendiente` | `rechazado` | Webhook del procesador             |
| `pendiente` | `cancelado` | Job de vencimiento, o admin        |
| `rechazado` | `pendiente` | Cliente reintenta el pago          |
| `rechazado` | `aprobado`  | Webhook, si el reintento sale bien |
| `rechazado` | `cancelado` | Job de vencimiento, o admin        |
| `aprobado`  | `devuelto`  | Admin, con devolución del dinero   |

Cualquier otra combinación lanza `TRANSICION_INVALIDA`.

### Lo que hay que notar

**`rechazado` no libera el stock.** El rechazo suele ser por fondos insuficientes
o datos mal tipeados, y la persona reintenta a los dos minutos con otra tarjeta.
Si liberás el stock ahí, el reintento puede fallar porque alguien compró la última
unidad en el medio. El stock se libera recién al vencer la reserva.

**`cancelado` y `devuelto` son distintos a propósito.** `cancelado` es un pedido
que nunca se pagó. `devuelto` es uno que se pagó y hubo que devolver la plata. Si
los unificás, el día que tu hija quiera saber cuánto devolvió en el mes no tiene
cómo averiguarlo.

**`devuelto` solo lo puede hacer un admin.** El rol `operador` prepara y despacha,
pero no toca dinero.

---

## 2. Estado de preparación

```
┌───────┐      ┌────────────────┐      ┌─────────┐      ┌───────────┐
│ nuevo │ ───► │ en_preparacion │ ───► │ enviado │ ───► │ entregado │
└───┬───┘      └───────┬────────┘      └────┬────┘      └───────────┘
    │                  │                    │             (terminal)
    │                  │                    │
    └──────────────────┴────────────────────┘
                       │
                       ▼
                 ┌───────────┐
                 │ cancelado │  (terminal)
                 └───────────┘
```

### Transiciones legales

| Desde                        | Hacia            | Condición                                            |
| ---------------------------- | ---------------- | ---------------------------------------------------- |
| `nuevo`                      | `en_preparacion` | El pago tiene que estar `aprobado`                   |
| `en_preparacion`             | `enviado`        | Requiere código de seguimiento si el método es envío |
| `enviado`                    | `entregado`      | —                                                    |
| cualquiera menos `entregado` | `cancelado`      | Solo admin                                           |

### Lo que hay que notar

**La preparación no avanza si el pago no está aprobado.** Es la única dependencia
entre las dos máquinas, y va en un solo sentido: el pago condiciona a la
preparación, nunca al revés.

**`enviado` exige seguimiento cuando el método de entrega es envío.** Sin eso, el
mail que le llega al cliente diciendo "tu pedido salió" no tiene nada que ofrecerle
cuando pregunte dónde está. Si el método es retiro, no aplica.

**`entregado` es terminal.** Un pedido entregado no vuelve atrás. Si hay un
problema posterior, se resuelve por el estado de pago con una devolución.

---

## 3. Efectos de cada transición

Cada transición ejecuta esto, siempre en este orden, dentro de una transacción.

| Transición                             | Stock                                  | Mail al cliente                                                | Mail interno    | Otros                             |
| -------------------------------------- | -------------------------------------- | -------------------------------------------------------------- | --------------- | --------------------------------- |
| Creación del pedido                    | **descuenta**                          | Pedido recibido, con instrucciones de pago si es transferencia | Nueva venta     | Fija `expira_en` a 24 h           |
| `pendiente` → `aprobado`               | —                                      | Pago confirmado                                                | Pago acreditado | Limpia `expira_en`                |
| `pendiente` → `rechazado`              | —                                      | Pago rechazado, con link para reintentar                       | —               | —                                 |
| `pendiente` → `cancelado`              | **repone**                             | Pedido cancelado por falta de pago                             | —               | —                                 |
| `rechazado` → `pendiente`              | —                                      | —                                                              | —               | Extiende `expira_en`              |
| `rechazado` → `cancelado`              | **repone**                             | Pedido cancelado                                               | —               | —                                 |
| `aprobado` → `devuelto`                | **repone**                             | Devolución procesada                                           | —               | Registra motivo en notas internas |
| `nuevo` → `en_preparacion`             | —                                      | —                                                              | —               | —                                 |
| `en_preparacion` → `enviado`           | —                                      | Pedido despachado, con seguimiento                             | —               | —                                 |
| `enviado` → `entregado`                | —                                      | —                                                              | —               | —                                 |
| cualquiera → `cancelado` (preparación) | **repone** si el pago no está aprobado | Pedido cancelado                                               | —               | —                                 |

### Sobre los efectos

**El stock se repone una sola vez.** Un pedido cancelado por vencimiento y después
marcado como cancelado en preparación no puede devolver el stock dos veces. El
servicio verifica el estado anterior antes de tocar nada.

**Los mails no se envían acá.** La transición inserta una fila en `emails_pendientes`
y un job la procesa. Si el proveedor de mail está caído, el pedido igual se registra.

**Todo dentro de una transacción.** Si falla el encolado del mail, la transición no
ocurre. No puede quedar un pedido aprobado sin su mail encolado.

---

## 4. Trabajos programados que disparan transiciones

**Vencimiento de reserva.** Cada 5 minutos busca pedidos con `estado_pago` en
`pendiente` o `rechazado` y `expira_en` ya pasado. Los pasa a `cancelado`,
reponiendo el stock.

**Recordatorio de pago.** Cada hora busca pedidos pendientes creados hace más de
12 horas a los que todavía no se les mandó recordatorio. Encola el mail. No cambia
el estado.

---

## 5. Interfaz del servicio

```js
/**
 * @description Cambia el estado de pago de un pedido validando la transición
 * y ejecutando sus efectos dentro de una transacción.
 * @param {number} pedidoId - Id del pedido.
 * @param {string} nuevoEstado - Estado destino.
 * @param {Object} contexto - Datos de la transición (usuario, motivo, datos del pago).
 * @returns {Promise<Object>} El pedido actualizado.
 * @throws {Error} TRANSICION_INVALIDA, PEDIDO_NO_ENCONTRADO, SIN_PERMISO
 */
cambiarEstadoPago(pedidoId, nuevoEstado, contexto);

/**
 * @description Cambia el estado de preparación de un pedido.
 * @param {number} pedidoId - Id del pedido.
 * @param {string} nuevoEstado - Estado destino.
 * @param {Object} contexto - Datos de la transición (usuario, seguimiento).
 * @returns {Promise<Object>} El pedido actualizado.
 * @throws {Error} TRANSICION_INVALIDA, PAGO_NO_APROBADO, SEGUIMIENTO_REQUERIDO
 */
cambiarEstadoPreparacion(pedidoId, nuevoEstado, contexto);
```

### Códigos de error a agregar al `errorMapper`

| Código                  | HTTP |
| ----------------------- | ---- |
| `TRANSICION_INVALIDA`   | 400  |
| `PAGO_NO_APROBADO`      | 400  |
| `SEGUIMIENTO_REQUERIDO` | 400  |

---

## 6. Qué hay que testear

Estos casos son obligatorios, están en el `AGENTS.md` sección 10:

- Cada transición legal produce el efecto que dice la tabla.
- Cada transición ilegal lanza `TRANSICION_INVALIDA` y no toca nada.
- El stock no se repone dos veces sobre el mismo pedido.
- No se puede pasar a `en_preparacion` con el pago pendiente.
- No se puede pasar a `enviado` sin seguimiento cuando el método es envío.
- Si falla el encolado del mail, la transición se revierte entera.
