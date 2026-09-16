# Velua · Plan de trabajo y arquitectura

Documento técnico para Dante y Pablo. Es la referencia del proyecto: si algo no está acá, se discute y se agrega antes de programarlo.

---

## 1. Premisas cerradas

Estas decisiones ya están tomadas. Cambiarlas implica revisar el plan entero.

| Decisión | Definición |
|---|---|
| Stack | Node + Express + MySQL (Sequelize) en el backend, React + Vite en el frontend |
| Arquitectura | API REST separada del cliente, dos repos, dos deploys |
| Capas | `Route → Controller → Service → Repository (interfaz) → Repository (Sequelize)`, heredado de El Buen Sabor |
| Persistencia | Solo MySQL. Sin MongoDB: el stock tiene que bajar en la misma transacción que crea el pedido |
| Tiempo real | Sin Socket.IO. El volumen no lo justifica; el panel consulta cada treinta segundos |
| Aromas | Cada aroma o fórmula es un producto propio, con su slug y su ficha |
| Variantes | Un solo eje, usado para tamaño. Todo producto tiene al menos una |
| Combos | Producto configurable con casilleros, el stock se descuenta de cada componente |
| Precios | Un único precio de lista. El ajuste por medio de pago es global |
| Pagos | Mercado Pago para tarjeta. Transferencia como segundo medio |
| Cuentas de cliente | No hay. Se compra como invitado |
| Renderizado | SPA. El tráfico viene de Instagram, no de Google |

---

## 2. Decisiones de arquitectura

Las nueve que definen la forma del sistema. Cada una resuelve un problema concreto que si no se ataca ahora, se paga caro después.

### 2.1 El precio lo calcula el backend, siempre

El frontend nunca calcula totales. Hay un endpoint de cotización que recibe el carrito y devuelve el desglose completo: subtotal, descuento de cupón, ajuste por medio de pago, envío y total.

Esto evita el bug clásico de dos implementaciones que se desincronizan y muestran totales distintos por unos pesos. Una sola fuente de verdad, en un único módulo `services/cotizador.js`, usado tanto por el endpoint de cotización como por el de checkout.

**Orden de cálculo, fijo:**

```
subtotal            = Σ (precio_variante × cantidad)
descuento_cupon     = f(cupón, subtotal)
base                = subtotal − descuento_cupon
ajuste_medio_pago   = base × porcentaje_del_medio
costo_envio         = 0 si (base − ajuste) ≥ umbral_envio_gratis, si no tarifa de zona
total               = base − ajuste_medio_pago + costo_envio
```

Redondeo al peso, una sola vez, sobre el total.

### 2.2 Adaptador de medios de pago

El checkout no habla con Mercado Pago. Habla con una interfaz:

```
crearPago(pedido)            → { url, referencia_externa }
procesarNotificacion(payload) → { referencia, estado, datos }
```

Implementaciones en `payments/mercadopago.js` y, más adelante, `payments/transferencia.js`. Si aparece un servicio de conciliación automática por CVU, se agrega una implementación más y el checkout no se toca.

Es el mismo patrón que ya usamos en la capa de repositorios: una interfaz estable y adaptadores intercambiables detrás. Sin esta capa, cambiar de procesador significa reescribir el checkout.

### 2.3 Máquina de estados del pedido

Ningún estado se cambia con un `UPDATE` suelto. Todas las transiciones pasan por `services/pedidoEstado.js`, que valida si la transición es legal y emite el evento correspondiente.

**Estado de pago**

```
pendiente ──→ aprobado ──→ devuelto
    │
    ├──→ rechazado
    └──→ cancelado        (vencimiento de reserva o cancelación manual)
```

**Estado de preparación** (solo avanza si el pago está aprobado)

```
nuevo ──→ en_preparacion ──→ enviado ──→ entregado
  │              │
  └──────────────┴──→ cancelado
```

Cada transición dispara: reposición o descuento de stock, encolado de mail, registro en bitácora.

### 2.4 Reserva de stock con transacción

El checkout corre dentro de una transacción con bloqueo de fila sobre las variantes involucradas:

1. `SELECT ... FOR UPDATE` de cada variante del carrito
2. verificar stock suficiente
3. descontar stock
4. crear pedido e ítems con los precios congelados
5. fijar `expira_en` a 24 horas
6. commit

Si el pago no llega antes de `expira_en`, un job repone el stock y cancela el pedido. Sin esto, dos personas compran la última unidad al mismo tiempo.

### 2.5 Idempotencia del webhook

Mercado Pago reenvía notificaciones. El handler inserta primero en `mp_notificaciones`, que tiene índice único sobre `payment_id`. Si el insert falla por duplicado, responde 200 y corta sin tocar nada.

El webhook responde rápido y procesa aparte: si tarda, el proveedor reintenta y multiplica el problema.

### 2.6 Los mails salen por bandeja de salida

Nunca dentro del request HTTP. Las transiciones de estado insertan una fila en `emails_pendientes`; un job los toma cada minuto, los envía y marca el resultado. Reintentos con corte a los tres intentos.

Así, si el proveedor de mail está caído, el cliente igual completa su compra.

### 2.7 Imágenes fuera del servidor

El backend no guarda archivos. Firma una subida directa a Cloudinary y persiste la URL.

Este es el punto donde **no** se hereda de El Buen Sabor: allá `multer` escribe al disco local y funciona bien, pero el disco de Render es efímero y se borra en cada deploy. Las fotos de producto desaparecerían.

### 2.8 Autenticación del panel

JWT de vida corta en cookie `httpOnly`, más refresh. Para que la cookie funcione entre frontend y API conviene desplegar en subdominios del mismo dominio: `velua.com.ar` y `api.velua.com.ar`. CORS con `credentials: true` y origen explícito, nunca comodín.

### 2.9 Migraciones desde el día uno

Nada de `sequelize.sync({ alter: true })`. Migraciones versionadas y un seed con datos realistas: categorías, veinte productos, variantes, alguno sin stock, alguno en oferta, tres pedidos en distintos estados.

Sin seed realista, el frontend se desarrolla contra tres productos de prueba y los problemas de layout aparecen recién en producción.

---

## 3. Estructura de los repos

### velua-api

```
src/
  config/          conexión, variables de entorno, constantes
  models/          modelos Sequelize
  migrations/
  seeders/
  routes/          definición de rutas, validaciones y wiring de dependencias
  controllers/     traducen HTTP ↔ servicios. Sin lógica de negocio
  services/        toda la lógica: cotizador, checkout, pedidoEstado, stock
  repositories/    interfaces de acceso a datos
    sequelize/     implementación concreta
  payments/        adaptadores de medios de pago
  docs/            definición OpenAPI servida en /api-docs
  mailer/          plantillas y envío
  jobs/            tareas programadas
  middlewares/     auth, validación, manejo de errores, rate limit
  utils/
  app.js
  server.js
tests/
docs/              contrato OpenAPI
```

**Regla de capas:** los controllers no importan modelos ni repositorios; los services no importan modelos directamente. Cada capa habla solo con la siguiente. Es lo que permite testear la lógica con repositorios simulados, sin levantar base ni servidor.

### velua-web

```
src/
  api/             cliente HTTP y funciones por recurso
  components/      componentes compartidos
  features/
    catalogo/
    carrito/
    checkout/
    admin/
  hooks/
  context/         carrito y sesión
  pages/
  styles/
```

El panel vive en el mismo repo bajo `features/admin`, con su propio layout y carga diferida. Mismo cliente HTTP, mismo deploy, una cosa menos que mantener.

---

## 4. Convenciones

**Git.** Rama `main` protegida, siempre desplegable. Una rama por tarea: `feat/carrito-cotizacion`, `fix/webhook-duplicado`. Nadie mergea su propio PR sin que el otro lo lea. Commits en español, en imperativo.

**Base de datos.** Tablas y columnas en snake_case y en español, como en el esquema ya definido. Los modelos de Sequelize mapean a camelCase en el código.

**API.** Prefijo `/api/v1`. Recursos en plural. Paginación con `?pagina=1&limite=20`, respuesta `{ datos: [], meta: { pagina, limite, total } }`.

**Errores.** El mismo contrato de El Buen Sabor, sin cambios:

```json
{ "error": "STOCK_INSUFICIENTE" }
{ "error": "DATOS_INVALIDOS", "details": { } }
```

Los services lanzan códigos de dominio. Los controllers delegan en `manejarErrorHttp`. El mapeo a códigos HTTP vive centralizado en `errorMapper`. Ningún controller arma respuestas de error a mano, y nunca se devuelve 200 en un error de negocio.

Los textos legibles viven en el frontend, mapeando código a mensaje. Para una tienda es una ventaja: el mismo `STOCK_INSUFICIENTE` muestra un cartel en la ficha y otro distinto en el checkout.

**JSDoc.** Obligatorio en toda función, pública o privada, en cualquier capa. Mismo formato que el proyecto anterior.

**Validación. express-validator en el borde de la API, con DATOS_INVALIDOS más details. Si un dato llegó al service, ya está validado.

**Bajas.** Lógicas, nunca físicas. Un producto discontinuado sigue estando referenciado en pedidos viejos.

**Testing.** Jest para unitarios, colección Postman versionada en el repo y corrida con Newman para los endpoints. Las dos en CI. No se cierra una tarea con tests en rojo, y si algo no se pudo correr, se declara.

**Idioma.** Código y comentarios en español. Es la marca de la casa y el proyecto es para mostrar.

---

## 5. Hitos

Cada hito termina con algo demostrable. Si no se puede mostrar, no está terminado.

### H0 · Fundaciones

Andamiaje clonado de El Buen Sabor y vaciado de dominio: estructura de capas, `errorMapper`, middlewares, configuración de Jest, Swagger y el workflow de CI. Eso ya está resuelto y no se rediseña.

Lo que sí hay que construir: migraciones y seed del esquema nuevo, contrato OpenAPI, máquina de estados documentada, y **deploy vacío funcionando en producción**, con API y frontend comunicándose y un endpoint de salud.

Desplegar al final es el error más caro del oficio. Se despliega antes de tener nada que desplegar.

*Terminado cuando:* el frontend en producción muestra un dato que vino de la API en producción.

### H1 · Catálogo público

Endpoints de lectura de categorías y productos con filtros y paginación. Home, grilla, ficha de producto, buscador simple.

*Terminado cuando:* se navega el catálogo del seed en producción, desde el teléfono.

### H2 · Panel de administración

Login, CRUD de categorías, productos, variantes e imágenes, con subida directa a Cloudinary.

*Terminado cuando:* la dueña de la marca carga un producto completo sin ayuda de nadie.

Este hito va temprano a propósito: alguien tiene que cargar cuarenta productos, y eso lleva semanas de trabajo que corren en paralelo al resto.

### H3 · Carrito y cotización

Carrito persistente en el navegador, endpoint de cotización, zonas de envío, cupones, umbral de envío gratis.

*Terminado cuando:* los totales del frontend y del backend coinciden al peso en veinte casos cubiertos por tests unitarios del cotizador, incluidos cupón más transferencia más envío gratis.

### H4 · Checkout y pagos

Creación de pedido con transacción y reserva de stock, integración con Mercado Pago, webhook idempotente, páginas de resultado, flujo de transferencia.

*Terminado cuando:* una compra real de monto chico se aprueba, el webhook la registra, el stock baja y el pedido aparece en el panel. La colección de Newman cubre el flujo completo de checkout.

### H5 · Mails y tareas programadas

Bandeja de salida, plantillas, dominio autenticado con SPF, DKIM y DMARC. Jobs de expiración de reserva, recordatorio de pago y carrito abandonado.

*Terminado cuando:* la secuencia completa llega a Gmail y a Outlook sin caer en spam.

### H6 · Contenido, legales y confianza

Página de marca y proceso, reseñas, formulario de arrepentimiento con número de trámite, términos, política de cambios y privacidad, metadatos y sitemap.

*Terminado cuando:* el checklist legal está completo y verificado contra la normativa vigente.

### H7 · Endurecimiento y salida

Rate limit, cabeceras de seguridad, revisión de validaciones, tests de cotizador y webhook, backups automáticos de la base, monitoreo de caídas, carga del catálogo real, prueba con tres clientas reales.

*Terminado cuando:* la tienda está abierta.

---

## 6. Reparto del trabajo

El criterio es dividir por capas verticales, no por archivos, para que nadie espere a nadie.

**Dante** toma el núcleo de negocio: esquema y migraciones, cotizador, checkout, máquina de estados, adaptador de pagos, webhook, bandeja de mails. Es la parte donde un error cuesta plata y donde hace falta el contexto completo del dominio.

**Pablo** toma el catálogo y la cara pública: endpoints de lectura, home, grilla, ficha, carrito en el frontend, páginas de contenido.

**Compartido:** el panel de administración, partido por secciones, y la revisión cruzada de todos los PR.

**La frontera es el contrato OpenAPI.** Mientras el contrato esté escrito y acordado, Pablo trabaja contra respuestas simuladas y no depende de que el backend esté listo. Si el contrato cambia, se avisa antes de tocar código.

---

## 7. Riesgos

**Las fotos y los textos.** Es el riesgo número uno y no es técnico. Un catálogo de veinte productos con tres fotos y cuatro campos de texto cada uno son semanas. Si arranca cuando el código está listo, la tienda queda parada. Tiene que empezar hoy, en paralelo con H0.

**La conciliación de transferencias.** Si no se consigue confirmación automática, alguien tiene que mirar comprobantes a mano todos los días. Hay que resolverlo antes de H4, no durante.

**Las cuentas de prueba de Mercado Pago.** Nunca funcionan a la primera. Reservar tiempo propio para eso dentro de H4 y no descubrirlo el último día.

**El alcance.** Van a aparecer ideas buenas todo el tiempo. Todas van a un archivo `IDEAS.md` y ninguna entra al hito en curso. Se revisan entre hito e hito.

**El bus factor.** Si solo Dante entiende el checkout, el proyecto depende de una persona. Por eso la revisión cruzada de PR es obligatoria aunque parezca burocracia entre dos.

---

## 8. Qué no se construye todavía

Las tablas están previstas en el esquema, pero estos módulos no tienen endpoints ni pantallas hasta que la tienda esté vendiendo:

cuentas de clientes, tienda mayorista, integración con APIs de correo, facturación automática, blog, lista de deseos, notificación de reposición, informes avanzados.

Tener la tabla no cuesta nada. Tener un endpoint sin usar cuesta mantenerlo, documentarlo y romperlo en cada refactor.

---

## 9. Primeros tres pasos

1. Revisar este documento y el `AGENTS.md` entre los dos, y marcar lo que no cierre.
2. Clonar el andamiaje de El Buen Sabor, vaciarlo de dominio y dejar los dos repos con el deploy andando en producción.
3. Escribir la máquina de estados completa y el contrato OpenAPI de catálogo y checkout.

Recién después, la primera línea de lógica.
