# Velua · Plan de trabajo y arquitectura

Documento técnico para Dante y Pablo. Es la referencia del proyecto: si algo no está acá, se discute y se agrega antes de programarlo.

---

## 1. Premisas cerradas

Estas decisiones ya están tomadas. Cambiarlas implica revisar el plan entero.

| Decisión           | Definición                                                                                                 |
| ------------------ | ---------------------------------------------------------------------------------------------------------- |
| Stack              | Node + Express + MySQL (Sequelize) en el backend, React + Vite en el frontend                              |
| Arquitectura       | API REST separada del cliente, dos repos, dos deploys                                                      |
| Capas              | `Route → Controller → Service → Repository (interfaz) → Repository (Sequelize)`, heredado de El Buen Sabor |
| Persistencia       | Solo MySQL. Sin MongoDB: el stock tiene que bajar en la misma transacción que crea el pedido               |
| Tiempo real        | Sin Socket.IO. El volumen no lo justifica; el panel consulta cada treinta segundos                         |
| Aromas             | Cada aroma o fórmula es un producto propio, con su slug y su ficha                                         |
| Variantes          | Un solo eje, usado para tamaño. Todo producto tiene al menos una                                           |
| Categorías         | Son colecciones, no tipos de producto                                                                      |
| Combos             | Producto fijo con stock propio. Las cajas se arman de antemano, no hay configurador                        |
| Precios            | Un único precio de lista. El ajuste por medio de pago es global                                            |
| Pagos              | Mercado Pago para tarjeta. Transferencia como segundo medio                                                |
| Cuentas de cliente | No hay. Se compra como invitado                                                                            |
| Renderizado        | SPA. El tráfico viene de Instagram, no de Google                                                           |
| Hosting            | API y MySQL en Railway, frontend en Vercel. `veluanature.com.ar` y `api.veluanature.com.ar`                |

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

**Todo el cálculo se hace en centavos con enteros**, nunca en punto flotante: `0.1 + 0.2` no da `0.3`, y sobre un total con descuentos y porcentajes ese error se amplifica hasta verse en la factura. Las conversiones viven en `utils/dinero.js`.

**El envío gratis se decide después de los descuentos.** Si un cupón baja el monto por debajo del umbral, el envío se cobra: el beneficio se mide sobre lo que efectivamente se paga.

### 2.2 Adaptador de medios de pago

El checkout no habla con Mercado Pago. Habla con una interfaz:

```
crearPago(pedido)            → { url, referencia_externa }
procesarNotificacion(payload) → { referencia, estado, datos }
```

Implementaciones en `payments/mercadopago.js` y, más adelante, `payments/transferencia.js`. Si aparece un servicio de conciliación automática por CVU, se agrega una implementación más y el checkout no se toca.

Es el mismo patrón que ya usamos en la capa de repositorios y en el almacenamiento de imágenes: una interfaz estable y adaptadores intercambiables detrás. Sin esta capa, cambiar de procesador significa reescribir el checkout.

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

Cada transición dispara: reposición o descuento de stock, encolado de mail, registro en bitácora. El detalle completo está en `docs/maquina-estados.md`.

### 2.4 Reserva de stock con transacción

El checkout corre dentro de una transacción con bloqueo de fila sobre las variantes involucradas:

1. `SELECT ... FOR UPDATE` de cada variante del carrito
2. verificar stock suficiente
3. descontar stock
4. crear pedido e ítems con los precios congelados
5. fijar `expira_en` a 24 horas
6. commit

Si el pago no llega antes de `expira_en`, un job repone el stock y cancela el pedido. Sin esto, dos personas compran la última unidad al mismo tiempo.

**Las variantes se bloquean siempre en orden ascendente de id.** Si dos carritos comparten productos y cada uno los bloquea en distinto orden, se traban entre sí y MySQL mata una de las dos transacciones. Un `sort` antes del bucle lo evita.

### 2.5 Idempotencia del webhook

Mercado Pago reenvía notificaciones. El handler inserta primero en `mp_notificaciones`, que tiene índice único sobre `payment_id`. Si el insert falla por duplicado, responde 200 y corta sin tocar nada.

El webhook responde rápido y procesa aparte: si tarda, el proveedor reintenta y multiplica el problema.

### 2.6 Los mails salen por bandeja de salida

Nunca dentro del request HTTP. Las transiciones de estado insertan una fila en `emails_pendientes`; un job los toma cada minuto, los envía y marca el resultado. Reintentos con corte a los tres intentos.

Así, si el proveedor de mail está caído, el cliente igual completa su compra.

> **Pendiente:** la tabla `emails_pendientes` todavía no existe. Hay que agregar su migración antes de empezar el hito de pedidos.

### 2.7 Imágenes fuera del servidor

Las fotos viven en Cloudinary. En la base se guardan `url` y `public_id`; el segundo es el que permite borrar el archivo remoto cuando se elimina una imagen, sin él quedan huérfanas consumiendo cuota.

Este es el punto donde **no** se hereda de El Buen Sabor: allá `multer` escribe al disco local y funciona bien, pero el filesystem del contenedor en Railway es efímero y se pierde en cada deploy. Las fotos de producto desaparecerían.

La subida usa `multer` con `memoryStorage`, nunca `diskStorage`, con tope de 5 MB por archivo y formatos jpg, png y webp. El archivo pasa por la RAM del contenedor camino a Cloudinary, así que el límite no es opcional.

El contenido se verifica mirando los primeros bytes del archivo, no el tipo que declara el navegador, que se puede falsear.

### 2.8 Autenticación del panel

JWT de ocho horas en cookie `httpOnly`, sin refresh: con uno o dos usuarios que entran a cargar productos, un esquema de refresh agrega complejidad sin resolver nada.

La cookie lleva `domain` con punto adelante, `.veluanature.com.ar`, para valer en todos los subdominios. Con dominios distintos el navegador la guarda para la API y no la manda desde el panel.

CORS con `credentials: true` y origen explícito, nunca comodín.

### 2.9 Migraciones desde el día uno

Nada de `sequelize.sync({ alter: true })`. Migraciones versionadas y un seed con datos realistas.

El seed actual tiene el catálogo real de la marca: tres colecciones, quince productos con sus textos, alguno sin stock y alguno en oferta.

> **Pendiente:** faltan pedidos de prueba en distintos estados. Sin ellos, la pantalla de gestión de pedidos no se puede desarrollar sin comprar de verdad.

---

## 3. Estructura de los repos

### velua-api

```
src/
  config/          conexión, variables de entorno, permisos
  models/          modelos Sequelize
  migrations/
  seeders/
  routes/          definición de rutas, validaciones y wiring de dependencias
  controllers/     traducen HTTP ↔ servicios. Sin lógica de negocio
  services/        toda la lógica: cotizador, checkout, pedidoEstado, stock
  repositories/    interfaces de acceso a datos
    sequelize/     implementación concreta
  almacenamiento/  interfaz de imágenes y adaptador de Cloudinary
  payments/        adaptadores de medios de pago
  docs/            definición base del OpenAPI y generador
  mailer/          plantillas y envío
  jobs/            tareas programadas
  middlewares/     auth, validación, manejo de errores, rate limit, subida
  utils/           slug, dinero
  app.js
  server.js
tests/
docs/              contrato OpenAPI generado, esquema de referencia, hitos
```

**Regla de capas:** los controllers no importan modelos ni repositorios; los services no importan modelos directamente. Cada capa habla solo con la siguiente. Es lo que permite testear la lógica con repositorios simulados, sin levantar base ni servidor.

**El repositorio devuelve datos crudos.** El mapeo al contrato lo hace el service, así el panel puede usar los mismos métodos aunque necesite otros campos.

### velua-web

```
src/
  app/             rutas de la tienda y del panel, por separado
  auth/            sesión y loader de autenticación
  components/
    ui/            componentes base de la marca
    admin/         componentes del panel
    layout/
  lib/
    api/           funciones de red por recurso
    apiFetch.ts    cliente HTTP con la cookie de sesión
    mappings.ts    código de dominio → mensaje, por contexto
    formato.ts     formateo de importes
  pages/
    Admin/
    Tienda/
  types/           alias de los tipos generados desde el OpenAPI
```

El panel vive en el mismo repo que la tienda, con su propia rama de rutas y carga diferida. Mismo cliente HTTP, mismo deploy, una cosa menos que mantener.

---

## 4. Convenciones

**Git.** Rama `main` protegida, siempre desplegable. Una rama por tarea: `feat/carrito-cotizacion`, `fix/webhook-duplicado`. Merge con squash, siempre. Commits en español, en imperativo.

En `velua-api` el PR es obligatorio pero no requiere aprobación. En `velua-web` la aprobación se mantiene, porque los dos tocan los mismos archivos.

**Base de datos.** Tablas y columnas en snake_case y en español. Los modelos de Sequelize mapean a camelCase en el código.

**API.** Prefijo `/api/v1`. Recursos en plural. Paginación con `?pagina=1&limite=20`, respuesta `{ datos: [], meta: { pagina, limite, total } }`. Los importes viajan como cadena decimal, nunca como número.

**Contrato.** `docs/openapi.json` es un archivo generado: la documentación vive en comentarios `@openapi` en las rutas y el JSON sale de `npm run openapi`. Nunca se edita a mano.

**Errores.**

```json
{ "error": "STOCK_INSUFICIENTE" }
{ "error": "DATOS_INVALIDOS", "details": { } }
```

Los services lanzan códigos de dominio. Los controllers delegan en `manejarErrorHttp`. El mapeo a códigos HTTP vive centralizado en `errorMapper`, y un middleware final captura lo que falla fuera de los controllers. Ningún controller arma respuestas de error a mano, y nunca se devuelve 200 en un error de negocio.

Los textos legibles viven en el frontend, mapeando código a mensaje **por contexto**: el mismo `NO_ENCONTRADO` dice una cosa en la tienda y otra en el panel.

**JSDoc.** Obligatorio en toda función, pública o privada, en cualquier capa.

**Validación.** express-validator en el borde de la API, con `DATOS_INVALIDOS` más `details`. Si un dato llegó al service, ya está validado.

**Bajas.** Lógicas, nunca físicas, para todo lo que se vendió. Un producto que nunca tuvo ventas sí se puede borrar de verdad, con permiso de admin.

**Testing.** Jest para unitarios, colección Postman versionada y corrida con Newman. Las dos en CI. No se cierra una tarea con tests en rojo.

**Idioma.** Código y comentarios en español.

---

## 5. Hitos

Cada hito termina con algo demostrable. Si no se puede mostrar, no está terminado.

### H0 · Fundaciones ✅

Andamiaje, migraciones y seed, contrato OpenAPI, máquina de estados documentada, y deploy funcionando en producción.

_Terminado cuando:_ el frontend en producción muestra un dato que vino de la API en producción.

### H1 · Catálogo público

**Backend ✅.** Endpoints de lectura de categorías y productos con filtros, paginación y orden.

**Frontend pendiente.** Home, grilla, ficha de producto, buscador simple.

_Terminado cuando:_ se navega el catálogo del seed en producción, desde el teléfono.

### H2 · Panel de administración ✅

Login, CRUD de categorías, productos, variantes e imágenes, con subida a Cloudinary.

_Terminado cuando:_ la dueña de la marca carga un producto completo sin ayuda de nadie.

> Falta la prueba con la usuaria real, que es lo que cierra el hito.

Este hito va temprano a propósito: alguien tiene que cargar cuarenta productos, y eso lleva semanas de trabajo que corren en paralelo al resto.

### H3 · Carrito y cotización

**Backend ✅.** Endpoint de cotización, zonas de envío, umbral de envío gratis, descuento por medio de pago, dos límites de cantidad.

**Frontend pendiente.** Carrito persistente en el navegador, pantalla de carrito.

Los cupones quedan fuera: el orden del cálculo los contempla y el lugar está en el código, pero no hay tabla ni endpoints. La marca nunca usó uno y el carrito es lo que destraba vender.

_Terminado cuando:_ los totales del frontend y del backend coinciden al peso, con el carrito mostrando los avisos de stock y de tope.

### H4 · Checkout y pagos

Creación de pedido con transacción y reserva de stock, integración con Mercado Pago, webhook idempotente, páginas de resultado, flujo de transferencia.

**Antes de empezar:** migración de `emails_pendientes` y seed con pedidos de prueba en distintos estados.

_Terminado cuando:_ una compra real de monto chico se aprueba, el webhook la registra y el stock baja. La colección de Newman cubre el flujo completo.

### H5 · Gestión de pedidos y mails

Listado de pedidos en el panel con filtros por estado, ficha del pedido, cambio de estado por la máquina, carga del número de seguimiento.

Y los correos, que van en el mismo hito **porque son parte de la transición**: cada cambio de estado encola un mail, y si el encolado falla la transición se revierte. Separarlos dejaría la máquina a medio implementar.

Bandeja de salida, plantillas, dominio autenticado con SPF, DKIM y DMARC. Jobs de expiración de reserva y recordatorio de pago.

_Terminado cuando:_ la dueña de la marca toma un pedido real, lo marca como enviado con su seguimiento, y la clienta recibe el mail en Gmail y en Outlook sin caer en spam.

### H6 · Contenido, legales y confianza

Página de marca y proceso, reseñas, formulario de arrepentimiento con número de trámite, términos, política de cambios y privacidad, metadatos y sitemap.

_Terminado cuando:_ el checklist legal está completo y verificado contra la normativa vigente.

### H7 · Endurecimiento y salida

Rate limit, cabeceras de seguridad, revisión de validaciones, backups automáticos de la base, monitoreo de caídas, carga del catálogo real, prueba con tres clientas reales.

_Terminado cuando:_ la tienda está abierta.

---

## 6. Reparto del trabajo

El criterio es dividir por capas verticales, no por archivos, para que nadie espere a nadie.

**Dante** toma el núcleo de negocio y el panel: esquema y migraciones, cotizador, checkout, máquina de estados, adaptador de pagos, webhook, bandeja de mails, y todas las pantallas de administración.

**Pablo** toma el catálogo y la cara pública: home, grilla, ficha, carrito en el frontend, checkout en el frontend, páginas de contenido.

**Compartido:** la base del frontend (tokens, componentes de `ui/`, cliente HTTP, tipos generados) y la revisión cruzada de los PR del repo web.

**La frontera es el contrato OpenAPI.** Mientras el contrato esté escrito y acordado, cada uno trabaja sin depender del otro. Si el contrato cambia, se avisa antes de tocar código.

---

## 7. Riesgos

**Las fotos y los textos.** Es el riesgo número uno y no es técnico. Un catálogo de quince productos con tres fotos cada uno son semanas de trabajo de la dueña de la marca, que además produce y fotografía. Conviene arrancar con cinco productos bien cargados en vez de esperar a tenerlos todos.

**La conciliación de transferencias.** Si no se consigue confirmación automática, alguien tiene que mirar comprobantes a mano todos los días. Hay que resolverlo antes de H4, no durante.

**Las cuentas de prueba de Mercado Pago.** Nunca funcionan a la primera. Reservar tiempo propio para eso dentro de H4.

**El alcance.** Van a aparecer ideas buenas todo el tiempo. Todas van a `IDEAS.md` y ninguna entra al hito en curso.

**El bus factor.** Hoy es el riesgo más agudo: Dante escribió el backend completo y el panel entero. Si se baja, el proyecto se frena. La disponibilidad de Pablo es irregular por su trabajo, así que el reparto se acomodó a eso, pero conviene que al menos lea los PR del backend aunque no los escriba.

---

## 8. Qué no se construye todavía

Las tablas pueden estar previstas en el esquema, pero estos módulos no tienen endpoints ni pantallas hasta que la tienda esté vendiendo:

cuentas de clientes, tienda mayorista, integración con APIs de correo, facturación automática, blog, lista de deseos, notificación de reposición, informes avanzados, cupones, archivado de productos.

Tener la tabla no cuesta nada. Tener un endpoint sin usar cuesta mantenerlo, documentarlo y romperlo en cada refactor.

---

## 9. Lo que sigue

1. El frontend del carrito, que cierra H3.
2. La migración de `emails_pendientes` y el seed con pedidos, antes de H4.
3. La prueba del panel con la dueña de la marca, que cierra H2.
