# Máquina de estados del pedido

Documento de referencia de `services/transicionesPedido.js` (qué transiciones son
legales) y `services/PedidoEstadoService.js` (cómo se ejecutan y con qué efectos).

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
| `pendiente` | `cancelado` | Job de vencimiento, o admin (§5)   |
| `rechazado` | `pendiente` | Cliente reintenta el pago          |
| `rechazado` | `aprobado`  | Webhook, si el reintento sale bien |
| `rechazado` | `cancelado` | Job de vencimiento, o admin (§5)   |
| `aprobado`  | `devuelto`  | Admin, con devolución (t13c)       |

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

**`devuelto` y `cancelado` solo los puede hacer un admin.** El rol `operador`
prepara y despacha, pero no toca dinero ni cancela: cancelar devuelve stock y le
avisa a la clienta, y es una decisión de la dueña. Permisos `PAGOS_DEVOLVER` y
`PEDIDOS_CANCELAR`.

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
| cualquiera menos `entregado` | `cancelado`      | Job de vencimiento, o admin (§5)                     |

### Lo que hay que notar

**La preparación no avanza si el pago no está aprobado.** Es la única dependencia
entre las dos máquinas, y va en un solo sentido: el pago condiciona a la
preparación, nunca al revés.

**`enviado` exige seguimiento cuando el método de entrega es envío.** Sin eso, el
mail que le llega al cliente diciendo "tu pedido salió" no tiene nada que ofrecerle
cuando pregunte dónde está. Si el método es retiro, no aplica.

**`entregado` es terminal.** Un pedido entregado no vuelve atrás. Si hay un
problema posterior, se resuelve por el estado de pago con una devolución.

**Se avanza de a un paso.** Pasar de `nuevo` a `enviado` sin preparar lanza
`TRANSICION_INVALIDA`. Repetir el estado actual (un doble clic) no es un error: no
cambia nada y no deja evento.

---

## 3. Efectos de cada transición

Cada transición ejecuta esto, siempre en este orden, dentro de una transacción.

| Transición                             | Stock                                  | Mail al cliente                                                | Mail interno    | Otros                             |
| -------------------------------------- | -------------------------------------- | -------------------------------------------------------------- | --------------- | --------------------------------- |
| Creación del pedido                    | **descuenta**                          | Pedido recibido, con instrucciones de pago si es transferencia | Nueva venta     | Fija `expira_en`: 1 h con Mercado Pago, 24 h con transferencia |
| `pendiente` → `aprobado`               | —                                      | Pago confirmado                                                | Pago acreditado | Limpia `expira_en`                |
| `pendiente` → `rechazado`              | —                                      | Pago rechazado, con link para reintentar                       | —               | —                                 |
| `pendiente` → `cancelado`              | **repone**                             | Pedido cancelado por falta de pago                             | —               | —                                 |
| `rechazado` → `pendiente`              | —                                      | —                                                              | —               | Extiende `expira_en`              |
| `rechazado` → `cancelado`              | **repone**                             | Pedido cancelado                                               | —               | —                                 |
| `aprobado` → `devuelto`                | **repone**                             | Devolución procesada                                           | —               | Registra motivo en notas internas |
| `nuevo` → `en_preparacion`             | —                                      | —                                                              | —               | —                                 |
| `en_preparacion` → `enviado`           | —                                      | Pedido despachado, con seguimiento si es envío                 | —               | Guarda el seguimiento si es envío |
| `enviado` → `entregado`                | —                                      | —                                                              | —               | —                                 |
| cualquiera → `cancelado` (preparación) | **repone** si el pago no está aprobado | Pedido cancelado, sin el motivo interno                        | —               | Motivo y usuario en el historial  |

### Sobre los efectos

**El stock se repone una sola vez.** Un pedido cancelado por vencimiento y después
marcado como cancelado en preparación no puede devolver el stock dos veces. El
servicio verifica el estado anterior antes de tocar nada.

**Los mails no se envían acá.** La transición inserta una fila en `emails_pendientes`
y un job la procesa. Si el proveedor de mail está caído, el pedido igual se registra.

**Todo dentro de una transacción.** Si falla el encolado del mail, la transición no
ocurre. No puede quedar un pedido aprobado sin su mail encolado.

**Cada evento dice quién lo hizo.** La bitácora (`pedido_eventos`) guarda el
`origen` (`checkout`, `webhook`, `job`, `panel`, `cliente`) y, desde el panel, el
`usuario_id` de la sesión. El usuario nunca sale del body de la petición.

---

## 4. Trabajos programados que disparan transiciones

**Vencimiento de reserva.** Cada 5 minutos busca pedidos con `estado_pago` en
`pendiente` o `rechazado`, `expira_en` ya pasado y **sin comprobante informado**. Los
pasa a `cancelado`, reponiendo el stock. Un pedido con comprobante informado no
vence solo: lo resuelve la dueña, confirmando el pago o cancelándolo a mano.

**Recordatorio de pago.** Cada hora busca pedidos pendientes creados hace más de
12 horas a los que todavía no se les mandó recordatorio. Encola el mail. No cambia
el estado.

---

## 5. Cambios manuales desde el panel (t13b)

| Ruta                                    | Permiso             | Quién             |
| --------------------------------------- | ------------------- | ----------------- |
| `PATCH /admin/pedidos/{id}/preparacion` | `PEDIDOS_GESTIONAR` | admin y operador  |
| `POST /admin/pedidos/{id}/cancelacion`  | `PEDIDOS_CANCELAR`  | solo admin        |

**Preparar, despachar y entregar.** Solo `en_preparacion`, `enviado` o `entregado`.
El seguimiento lleva de 6 a 40 letras, números o guiones (`SEGUIMIENTO_VALIDO`).

**Cancelar a mano es más restrictivo que la máquina.** La máquina permite cancelar
desde cualquier estado menos `entregado`, pero desde el panel solo se cancela un
pedido que cumple todo esto:

- La preparación está en `nuevo`.
- El pago está `pendiente` o `rechazado`. Uno `aprobado` se rechaza con
`PEDIDO_PAGADO`: primero hay que devolver el dinero (t13c).
- Hay un motivo, de 5 a 500 caracteres. Va al historial, nunca al mail de la clienta.
- Si la clienta informó una transferencia, la petición trae `confirmaSinPago: true`
  (el booleano, no el texto): la dueña revisó el banco y el dinero no llegó. Sin eso,
  `COMPROBANTE_INFORMADO`.

- El pedido nunca tuvo link de Mercado Pago. Si lo tuvo, `PAGO_EN_CURSO`: lo cancela
  el job de vencimiento, que antes consulta a Mercado Pago, porque un pago en proceso
  puede aprobarse después del vencimiento. Los pedidos que el job deja para revisión
  se resuelven aparte (t54).

Cancelar dos veces no es un error y no repone dos veces.

### Interfaz del servicio

```js
/**
 * @description Avanza la preparación desde el panel.
 * @param {number} pedidoId - Id del pedido.
 * @param {{hacia: string, seguimiento?: string|null, usuarioId: number}} cambio
 * @returns {Promise<{cambiado: boolean, numero: string, motivo?: "YA_REGISTRADO"}>}
 * @throws {Error} NO_ENCONTRADO, TRANSICION_INVALIDA, PAGO_NO_APROBADO, SEGUIMIENTO_REQUERIDO
 */
cambiarEstadoPreparacion(pedidoId, cambio);

/**
 * @description Cancela a mano un pedido sin pagar y devuelve su stock.
 * @param {number} pedidoId - Id del pedido.
 * @param {{motivo: string, confirmaSinPago?: boolean, usuarioId: number}} cancelacion
 * @returns {Promise<{cancelado: boolean, numero: string, motivo?: "YA_CANCELADO"}>}
 * @throws {Error} DATOS_INVALIDOS, NO_ENCONTRADO, PEDIDO_PAGADO, COMPROBANTE_INFORMADO, TRANSICION_INVALIDA
 */
cancelarManual(pedidoId, cancelacion);
```

Los cambios de pago (webhook y vencimiento) están en `registrarResultadoPago` y
`cancelarVencido`, en el mismo servicio.

### Códigos de error

| Código                  | HTTP |
| ----------------------- | ---- |
| `TRANSICION_INVALIDA`   | 400  |
| `PAGO_NO_APROBADO`      | 400  |
| `SEGUIMIENTO_REQUERIDO` | 400  |
| `PEDIDO_PAGADO`         | 409  |
| `COMPROBANTE_INFORMADO` | 409  |
| `PAGO_EN_CURSO`         | 409  |

---

## 6. Qué hay que testear

Estos casos son obligatorios, están en el `AGENTS.md` sección 10:

- Cada transición legal produce el efecto que dice la tabla.
- Cada transición ilegal lanza `TRANSICION_INVALIDA` y no toca nada.
- El stock no se repone dos veces sobre el mismo pedido.
- No se puede pasar a `en_preparacion` con el pago pendiente.
- No se puede pasar a `enviado` sin seguimiento cuando el método es envío.
- Si falla el encolado del mail, la transición se revierte entera.
- No se cancela a mano un pedido pagado, ni uno con comprobante informado sin la
  confirmación.
- El motivo de una cancelación no aparece en el mail a la clienta.
- El operador no tiene `PEDIDOS_CANCELAR`.
- No se cancela a mano un pedido con link de Mercado Pago, aunque haya vencido.
