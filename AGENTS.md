# AGENTS.md · velua-api

## 1) Propósito

Define cómo debe trabajar cualquier agente de IA en este repositorio, para mantener calidad, consistencia y velocidad de entrega.

Objetivos:

- Mantener arquitectura limpia por capas.
- Evitar regresiones funcionales.
- Mantener homogeneidad en manejo de errores y respuestas HTTP.
- **Proteger las reglas de dominio de la sección 4**, que son las que un agente rompe por defecto.
- Enseñar mientras se implementa, explicando por qué, qué y cómo.

Este proyecto es una tienda online real: los errores de cálculo, de stock y de pagos cuestan dinero, no solo puntos de una materia.

---

## 2) Forma de trabajo esperada

Orden de trabajo:

1. Entender el requerimiento y el contexto real del código.
2. Explicar el plan en tres pasos: por qué, qué y cómo.
3. Implementar cambios pequeños, seguros y verificables.
4. Validar con tests y ejecuciones relevantes.
5. Entregar resumen final con archivos tocados, validaciones y pendientes.

Reglas de colaboración:

- Priorizar claridad y aprendizaje del desarrollador.
- Si el usuario lo pide, guiar paso a paso en vez de editar todo de golpe.
- No hacer cambios innecesarios fuera de alcance.
- Si aparece algo inesperado en el repo, frenar y avisar.
- Ante una idea nueva que excede la tarea, anotarla en `IDEAS.md`, no implementarla.

---

## 3) Arquitectura obligatoria

```
Route → Controller → Service → Repository (interfaz) → Repository (Sequelize) → DB
```

- `routes`: definición de endpoints, validación de entrada y wiring de dependencias.
- `controllers`: entrada y salida HTTP, sin lógica de negocio.
- `services`: reglas de negocio y orquestación.
- `repositories`: acceso a datos. La interfaz es lo que consume el service.
- `payments`: adaptadores de medios de pago, con la misma lógica de interfaz.
- `mailer`: plantillas y envío.
- `jobs`: tareas programadas.
- `middlewares`: autenticación, validación, subida de archivos, errores.

No saltar capas salvo justificación fuerte. Los controllers no importan modelos ni repositorios.

---

## 4) Reglas de dominio · leer antes de tocar código

Estas cinco reglas se rompen cuando se aplica la solución más obvia. Son de cumplimiento obligatorio.

### 4.1 Los precios se calculan en un solo lugar

Todo cálculo de totales vive en `services/cotizador`. Ningún controller, ningún otro service y ningún componente del frontend calcula subtotales, descuentos ni totales.

Orden fijo, no negociable:

```
subtotal          = Σ (precio_variante × cantidad)
descuento_cupon   = f(cupón, subtotal)
base              = subtotal − descuento_cupon
ajuste_medio_pago = base × porcentaje_del_medio
costo_envio       = 0 si (base − ajuste) ≥ umbral, si no tarifa de zona
total             = base − ajuste_medio_pago + costo_envio
```

Redondeo al peso una sola vez, sobre el total. Dinero en `DECIMAL`, jamás en punto flotante.

### 4.2 Los estados del pedido solo cambian por su máquina

Ninguna transición se hace con un `update` suelto. Todas pasan por `services/pedidoEstado`, que valida si la transición es legal y emite los efectos: stock, mail, bitácora.

Si hace falta un estado nuevo, se agrega a la máquina, no se esquiva.

### 4.3 El webhook de pagos es idempotente

El handler inserta primero en `mp_notificaciones`, que tiene índice único sobre `payment_id`. Si el insert falla por duplicado, responde 200 y corta sin efectos.

El webhook responde rápido y procesa aparte. Nunca se confía en el payload recibido: el estado del pago se consulta contra el proveedor.

### 4.4 Los ítems del pedido son copias congeladas

`pedido_items` guarda nombre, variante y precio copiados al momento de la compra. Nunca se reemplaza por un join contra `variantes` para mostrar un pedido histórico, por más que el dato parezca redundante.

Los precios cambian seguido. El historial de ventas no se reescribe.

### 4.5 Stock y pedido, en la misma transacción

El checkout corre con `SELECT ... FOR UPDATE` sobre las variantes, verifica, descuenta, crea el pedido y fija vencimiento de reserva. Todo dentro de una transacción, commit al final.

Nada de leer stock, hacer otra cosa y después descontar.

### 4.6 Secretos

Nunca loguear el access token del procesador de pagos ni el payload completo de una notificación. Nunca hardcodear credenciales. Todo por variables de entorno.

---

## 5) Convenciones de código

- Nomenclatura consistente con el proyecto, en español.
- Tablas y columnas en `snake_case`; modelos y código en `camelCase`.
- Evitar duplicación de lógica.
- Funciones cortas y de responsabilidad única.
- Evitar dependencias nuevas sin justificar.
- No tocar archivos no relacionados.
- `async/await` con manejo claro de errores.
- Bajas lógicas, nunca físicas.

---

## 6) JSDoc obligatorio en todas las funciones

Cada función lleva un bloque JSDoc inmediatamente encima. Aplica a funciones públicas y privadas, en controllers, services, repositories, middlewares, jobs y utilidades.

```js
/**
 * @description Describe claramente qué hace la función.
 * @param {Tipo} parametro - Qué representa y validaciones relevantes.
 * @returns {Tipo|Promise<Tipo>} Valor de retorno esperado.
 * @throws {Error} Códigos de error de dominio que puede lanzar.
 */
```

En funciones `async`, usar `Promise<Tipo>` en `@returns`.

---

## 7) Manejo de errores

Principios:

- Códigos de dominio estables: `STOCK_INSUFICIENTE`, `CUPON_VENCIDO`, `PEDIDO_NO_ENCONTRADO`, `TRANSICION_INVALIDA`.
- Evitar mensajes libres cuando ya existe un código.
- Mapeo HTTP centralizado en `errorMapper`.
- Contrato JSON idéntico en todos los módulos, middlewares incluidos.

Reglas prácticas:

- En `services`: `throw new Error("CODIGO_DOMINIO")`.
- En `controllers`: delegar en `manejarErrorHttp`.
- Validaciones de entrada: `DATOS_INVALIDOS` más `details`.

Contrato:

```json
{ "error": "CODIGO_DOMINIO" }
{ "error": "DATOS_INVALIDOS", "details": { } }
```

Nunca 200 en un error de negocio. Los textos legibles los arma el frontend a partir del código.

---

## 8) Transacciones

Cuando una operación afecta varias escrituras relacionadas:

- Usar transacción.
- Propagar `transaction` entre service y repository de forma explícita.
- No mezclar operaciones fuera de la transacción durante validaciones críticas.
- Commit solo al final del flujo exitoso.

Operaciones que siempre son transaccionales: checkout, confirmación de pago, cancelación por vencimiento, ajuste manual de stock.

---

## 9) Contrato HTTP

- Prefijo `/api/v1`. Recursos en plural.
- Paginación: `?pagina=1&limite=20`, respuesta `{ datos: [], meta: { pagina, limite, total } }`.
- JSON de éxito claro y estable.
- No mezclar `message` y `mensaje` sin criterio.
- Todo endpoint nuevo se documenta en OpenAPI en el mismo PR. Sin documentación, el PR no se aprueba: el frontend trabaja contra el contrato.

---

## 10) Testing obligatorio

Mínimo requerido:

- Unitarios: `npm run test:unit`
- E2E sobre endpoints: `npm test` (Newman)

Cobertura obligatoria, sin excepción:

- `services/cotizador`, con casos de cupón, ajuste por medio de pago y umbral de envío gratis.
- Idempotencia del webhook: la misma notificación dos veces produce un solo efecto.
- Transiciones ilegales de la máquina de estados.
- Stock insuficiente y compras concurrentes sobre la última unidad.

Si cambiás contrato o comportamiento, actualizá los tests. No se cierra una tarea con tests en rojo. Si algo no se pudo correr, declararlo.

---

## 11) CI/CD

Al cambiar colecciones Postman, assets o scripts:

- Confirmar que las rutas funcionen en local y en CI.
- Verificar el workflow en `.github/workflows/ci.yml`.
- Evitar dependencias de rutas absolutas locales.

Las migraciones corren en CI antes de los tests. Nunca `sequelize.sync({ alter: true })`.

---

## 12) Git y versionado

- Commits atómicos y con intención clara: qué cambia y por qué.
- Ramas de feature o chore. `main` protegida y siempre desplegable.
- No mezclar refactor masivo con bugfix puntual.
- Todo PR lo revisa la otra persona, aunque el equipo sean dos.

---

## 13) Checklist de cierre

1. Código implementado y coherente con la arquitectura.
2. Reglas de dominio de la sección 4 respetadas.
3. JSDoc en todas las funciones nuevas o modificadas.
4. Manejo de errores homogéneo.
5. OpenAPI actualizado si cambió algún endpoint.
6. Tests relevantes en verde.
7. Resumen final con archivos modificados, validaciones ejecutadas y riesgos o pendientes.

---

## 14) Fuera de alcance por ahora

No implementar sin pedido explícito: cuentas de clientes, tienda mayorista, integración con APIs de correo, facturación automática, blog, lista de deseos, notificación de reposición, tiempo real con WebSockets.

Las tablas pueden existir en el esquema. Los endpoints y pantallas, no.

---

## 15) Regla de oro

Primero correcto, después prolijo, siempre consistente.

Entre rapidez y calidad estructural, elegir calidad estructural sin perder pragmatismo. Y ante la duda en cualquier regla de la sección 4, frenar y preguntar antes de implementar.
