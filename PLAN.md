# Velua · Plan de trabajo y arquitectura

Documento técnico para Dante y Pablo. Es la referencia del proyecto: si algo no está acá, se discute y se agrega antes de programarlo.

**Última actualización:** 17/10/2026. El detalle de qué cambió está en la sección 11. El seguimiento día a día de las tareas vive en la **Ruta de lanzamiento** (página compartida); este documento fija las decisiones y los hitos.

---

## 1. Premisas cerradas

Estas decisiones ya están tomadas. Cambiarlas implica revisar el plan entero.

| Decisión               | Definición                                                                                                                                                       |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stack                  | Node + Express + MySQL (Sequelize) en el backend, React + Vite en el frontend                                                                                    |
| Arquitectura           | API REST separada del cliente, dos repos, dos deploys                                                                                                            |
| Capas                  | `Route → Controller → Service → Repository (interfaz) → Repository (Sequelize)`, heredado de El Buen Sabor                                                       |
| Persistencia           | Solo MySQL. Sin MongoDB: el stock tiene que bajar en la misma transacción que crea el pedido                                                                     |
| Tiempo real            | Sin Socket.IO. El volumen no lo justifica; el panel consulta cada treinta segundos                                                                               |
| Aromas                 | Cada aroma o fórmula es un producto propio, con su slug y su ficha                                                                                               |
| Variantes              | Un solo eje, usado para tamaño. Todo producto tiene al menos una                                                                                                 |
| Categorías             | Son colecciones, no tipos de producto. Dos niveles (colección madre e hijas)                                                                                     |
| Combos                 | Configurables: la clienta elige los jabones. Se construyen en H8; hasta entonces, cajas fijas                                                                    |
| Sets                   | Solo con productos propios de la marca. Se cargan como producto con stock propio                                                                                 |
| Precios                | Un único precio de lista. Un solo descuento del 10%, igual para efectivo y transferencia. Con Mercado Pago se paga el precio de lista                             |
| Ofertas                | Un producto en oferta tiene el mismo precio con cualquier medio de pago. El descuento por contado o transferencia no se suma a la oferta                          |
| Pagos                  | Mercado Pago (Checkout Pro) para tarjeta, débito y dinero en cuenta. Transferencia como segundo medio, confirmada a mano por la dueña                             |
| Ventas fuera de la web | Las ventas en persona y por teléfono se registran en el panel y comparten el stock con la tienda                                                                 |
| Próximamente           | Un producto puede tener fecha de lanzamiento. Hasta ese día se muestra pero no se vende por ningún canal, tampoco en persona. Sin preventa                        |
| Cuentas de cliente     | No hay. Se compra como invitado                                                                                                                                  |
| Renderizado            | SPA. El tráfico viene de Instagram, no de Google                                                                                                                 |
| Hosting                | API y MySQL en Railway, frontend en Vercel. `veluanature.com.ar` y `api.veluanature.com.ar`                                                                      |

---

## 2. Decisiones de arquitectura

Cada una resuelve un problema concreto que, si no se ataca ahora, se paga caro después.

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
5. fijar `expira_en` según el medio de pago
6. commit

Si el pago no llega antes de `expira_en`, un job repone el stock y cancela el pedido. Sin esto, dos personas compran la última unidad al mismo tiempo. Plazos decididos (17/10), dos relojes con responsables distintos:

- **Pagar (la clienta): una hora**, con Mercado Pago y con transferencia. Con transferencia, el reloj corre hasta que la clienta avisa "Ya transferí". Si vence sin aviso, se cancela el pedido y se repone el stock. Reemplaza las 24 horas de `docs/h4-checkout.md`.
- **Verificar (la dueña): 24 horas** desde el aviso para confirmar o rechazar la acreditación en el panel. Si vence, el pedido **no se cancela solo** (la plata pudo haber llegado): pasa a "en revisión" y la dueña recibe un aviso.

**Las variantes se bloquean siempre en orden ascendente de id.** Si dos carritos comparten productos y cada uno los bloquea en distinto orden, se traban entre sí y MySQL mata una de las dos transacciones. Un `sort` antes del bucle lo evita.

### 2.5 Idempotencia del webhook

Mercado Pago reenvía notificaciones. El handler inserta primero en `mp_notificaciones`, que tiene índice único sobre `payment_id`. Si el insert falla por duplicado, responde 200 y corta sin tocar nada.

El webhook responde rápido y procesa aparte: si tarda, el proveedor reintenta y multiplica el problema.

### 2.6 Los mails salen por bandeja de salida

Nunca dentro del request HTTP. Las transiciones de estado insertan una fila en `emails_pendientes`; un job los toma cada minuto, los envía y marca el resultado. Reintentos con corte a los tres intentos.

Así, si el proveedor de mail está caído, el cliente igual completa su compra. La tabla ya existe; el envío real llega en H5.

### 2.7 Imágenes fuera del servidor

Las fotos viven en Cloudinary. En la base se guardan `url` y `public_id`; el segundo es el que permite borrar el archivo remoto cuando se elimina una imagen, sin él quedan huérfanas consumiendo cuota.

Este es el punto donde **no** se hereda de El Buen Sabor: allá `multer` escribe al disco local y funciona bien, pero el filesystem del contenedor en Railway es efímero y se pierde en cada deploy. Las fotos de producto desaparecerían.

La subida usa `multer` con `memoryStorage`, nunca `diskStorage`, con tope de 5 MB por archivo y formatos jpg, png y webp. El archivo pasa por la RAM del contenedor camino a Cloudinary, así que el límite no es opcional.

El contenido se verifica mirando los primeros bytes del archivo, no el tipo que declara el navegador, que se puede falsear.

### 2.8 Autenticación del panel

JWT de ocho horas en cookie `httpOnly`, sin refresh: con uno o dos usuarios que entran a cargar productos, un esquema de refresh agrega complejidad sin resolver nada.

La cookie lleva `domain` con punto adelante, `.veluanature.com.ar`, para valer en todos los subdominios. Con dominios distintos el navegador la guarda para la API y no la manda desde el panel.

CORS con `credentials: true` y origen explícito, nunca comodín.

Antes de abrir la tienda: cambio de contraseña desde "Mi cuenta", recuperación por email y vencimiento de la sesión por inactividad, porque la dueña va a usar el panel desde el celular.

### 2.9 Migraciones desde el día uno

Nada de `sequelize.sync({ alter: true })`. Migraciones versionadas y un seed con datos realistas: tres colecciones, quince productos con sus textos, alguno sin stock, alguno en oferta, y pedidos de prueba en distintos estados. **El seed de pedidos nunca corre en producción.**

Las migraciones corren en el pre-deploy de Railway con un usuario propio (ver 2.10). Si una falla, Railway no publica la versión nueva y la anterior sigue en servicio.

### 2.10 Mínimo privilegio en la base

La API nunca usa `root`. Cada pieza tiene su usuario, con los permisos justos y un tope de conexiones:

| Usuario             | Permisos                                                       | Uso                                      |
| ------------------- | -------------------------------------------------------------- | ---------------------------------------- |
| `velua_app`         | `SELECT, INSERT, UPDATE, DELETE`                               | la API en ejecución                      |
| `velua_migraciones` | lo anterior + `CREATE, ALTER, DROP, INDEX, REFERENCES`         | solo el pre-deploy de migraciones        |
| `velua_backup`      | `SELECT, SHOW VIEW, TRIGGER`                                   | solo el servicio de backup               |

`root` queda para administración manual. Los permisos se amplían solo cuando un error real lo pide, al usuario que corresponde, y queda registrado. Detalle en el manual de usuarios de la base.

### 2.11 Backups cifrados e inmutables

Un servicio aparte (`ops/backup/`) hace un volcado diario, lo comprime, lo cifra con `age` (la clave privada está fuera de línea) y lo sube a un bucket de Backblaze B2 con Object Lock: nadie puede borrarlo durante 30 días, ni siquiera con las credenciales del servicio. Si el volcado escribe algo en el canal de errores, el backup se descarta.

La restauración se probó con un backup real en un MySQL de la misma versión que producción. Detalle en el manual de backups.

### 2.12 Productos Próximamente

Un producto puede tener `disponible_desde` (una fecha sin hora). Hasta ese día a las 00:00, hora de Argentina, se muestra con la etiqueta "Próximamente" y los días que faltan, pero no se puede comprar.

- **Una sola regla**, `services/estadoVenta.js`, usada por el catálogo, el cotizador y el panel.
- **El control está en el cotizador**, por donde pasan `/cotizar` y `POST /pedidos`. Un producto que todavía no salió se quita del carrito con el aviso `PROXIMAMENTE`.
- **Falla segura:** si una consulta no trae la fecha, la cotización se rechaza en lugar de vender. Una fecha inválida también bloquea la venta.
- **El servidor decide.** La API entrega `proximamente` y `diasRestantes` ya calculados; la tienda no usa el reloj del navegador.
- Las ventas en persona también respetan la fecha: se puede consultar, pero no hay preventa.

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
  services/        toda la lógica: cotizador, checkout, pedidoEstado, estadoVenta, stock
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
ops/
  backup/          servicio de backup diario (Dockerfile, script, verificación de permisos)
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

**Git.** Rama `main` protegida, siempre desplegable. Una rama por tarea: `feat/carrito-cotizacion`, `fix/webhook-duplicado`. Commits en español, en imperativo, que describan el comportamiento ("el cotizador no vende antes de la fecha"), con el porqué en el cuerpo cuando hace falta. Un PR, un propósito: lo que aparece en el camino se registra aparte.

**Merge con squash por defecto.** Se usa merge commit cuando los commits del PR cuentan una historia que conviene poder revertir por partes (por ejemplo, el #48 de Próximamente: regla, datos, control, lectura y escritura por separado). Se decide en el PR y se aclara en su descripción.

En `velua-api` el PR es obligatorio pero no requiere aprobación. En `velua-web` la aprobación se mantiene, porque los dos tocan los mismos archivos.

**Base de datos.** Tablas y columnas en snake_case y en español. Los modelos de Sequelize mapean a camelCase en el código. Los nombres de archivo de los modelos, en minúscula (`producto.js`): en Linux las mayúsculas importan.

**API.** Prefijo `/api/v1`. Recursos en plural. Paginación con `?pagina=1&limite=20`, respuesta `{ datos: [], meta: { pagina, limite, total } }`. Los importes viajan como cadena decimal, nunca como número. Las fechas sin hora, como texto `AAAA-MM-DD`.

**Contrato.** `docs/openapi.json` es un archivo generado: la documentación vive en comentarios `@openapi` en las rutas y en `src/docs/definicionBase.js`, y el JSON sale de `npm run openapi`. Nunca se edita a mano. Si el contrato cambia, se avisa antes de tocar código.

**Errores.**

```json
{ "error": "STOCK_INSUFICIENTE" }
{ "error": "DATOS_INVALIDOS", "details": { } }
```

Los services lanzan códigos de dominio. Los controllers delegan en `manejarErrorHttp`. El mapeo a códigos HTTP vive centralizado en `errorMapper`, y un middleware final captura lo que falla fuera de los controllers. Ningún controller arma respuestas de error a mano, y nunca se devuelve 200 en un error de negocio.

Los textos legibles viven en el frontend, mapeando código a mensaje **por contexto**: el mismo `NO_ENCONTRADO` dice una cosa en la tienda y otra en el panel.

**JSDoc.** Obligatorio en toda función, pública o privada, en cualquier capa.

**Validación.** express-validator en el borde de la API, con `DATOS_INVALIDOS` más `details`, y listas blancas estrictas. Si un dato llegó al service, ya está validado en su forma; el service valida el significado. En Express 5 los sanitizadores (`toInt`, `toBoolean`) no modifican `req.query`.

**Bajas.** Lógicas, nunca físicas, para todo lo que se vendió. Un producto que nunca tuvo ventas sí se puede borrar de verdad, con permiso de admin.

**Testing.** Jest para unitarios, colección Postman versionada y corrida con Newman. Las dos en CI. No se cierra una tarea con tests en rojo. Los controles de seguridad críticos se comprueban con una mutación a mano: si se rompe el control, algún test tiene que fallar. Lo que depende del motor de base se prueba contra un MySQL en Docker de la misma versión que producción.

**Seguridad.** Se trabaja con los skills `velua-api-segura` (backend) y `velua-front-seguro` (frontend). Cada PR que toca un riesgo lo registra con cinco partes: problema y vector, impacto, solución, cómo verificar y referencia. Los secretos nunca pasan por el chat, el repo ni una captura.

**Idioma.** Código y comentarios en español.

---

## 5. Hitos

Cada hito termina con algo demostrable. Si no se puede mostrar, no está terminado.

### H0 · Fundaciones ✅

Andamiaje, migraciones y seed, contrato OpenAPI, máquina de estados documentada, y deploy funcionando en producción.

_Terminado cuando:_ el frontend en producción muestra un dato que vino de la API en producción.

### H1 · Catálogo público

**Backend ✅.** Endpoints de lectura de categorías y productos con filtros, paginación y orden.

**Frontend en curso (Pablo).** Ficha de producto hecha. Falta confirmar la franja del encabezado en el celular.

_Terminado cuando:_ se navega el catálogo del seed en producción, desde el teléfono.

### H2 · Panel de administración

**Hecho ✅.** Login, CRUD de categorías (en dos niveles), productos, variantes e imágenes, con subida a Cloudinary.

**Pendiente:** doble envío en el resto de los formularios del panel; revisar las colecciones duplicadas; la prueba con la usuaria real, que es lo que cierra el hito.

_Terminado cuando:_ la dueña de la marca carga un producto completo sin ayuda de nadie.

Este hito va temprano a propósito: alguien tiene que cargar cuarenta productos, y eso lleva semanas de trabajo que corren en paralelo al resto.

### Próximamente (agregado en octubre)

**API ✅** en producción (#48): regla de venta, control en el cotizador, campos y filtro en el catálogo, y carga de la fecha desde el admin.

**Pendiente:** el campo de fecha en el panel (Dante), las pantallas de la tienda (Pablo) y la carga de los jabones en curado (la dueña).

_Terminado cuando:_ un jabón en curado aparece en la tienda como "Próximamente" con los días que faltan, no se puede comprar, y desde el día de su fecha se compra normalmente.

### H3 · Carrito y cotización

**Backend ✅.** Endpoint de cotización, zonas de envío, umbral de envío gratis, descuento por medio de pago, dos límites de cantidad, aviso de producto Próximamente.

**Frontend pendiente (Pablo).** Carrito persistente en el navegador, pantalla de carrito.

Los cupones quedan fuera: el orden del cálculo los contempla y el lugar está en el código, pero no hay tabla ni endpoints. La marca nunca usó uno y el carrito es lo que destraba vender.

_Terminado cuando:_ los totales del frontend y del backend coinciden al peso, con el carrito mostrando los avisos de stock, de tope y de Próximamente.

### H4 · Checkout y pagos

**Hecho ✅.** Creación de pedido con transacción y reserva de stock, integración con Mercado Pago, webhook idempotente, reintento de pago sin cobro doble, tabla `emails_pendientes` y seed de pedidos de prueba.

**Pendiente:** transferencia (datos bancarios desde la configuración y botón "Ya transferí", que solo avisa: el pago lo confirma la dueña en el panel), los dos relojes de la transferencia (una hora para pagar, 24 horas para verificar, ver 2.4) y el descuento del 10%, la revisión de que nadie pueda ver pedidos ajenos, y el checkout en el frontend (Pablo).

_Terminado cuando:_ una compra real de monto chico se aprueba, el webhook la registra y el stock baja. La colección de Newman cubre el flujo completo.

### H5 · Gestión de pedidos, ventas en persona y mails

Listado de pedidos en el panel con filtros por estado, ficha del pedido, cambio de estado por la máquina, carga del número de seguimiento, confirmación de transferencias.

**Ventas en persona y por teléfono:** una pantalla del panel pensada para el celular, para que la dueña cargue la venta en el momento (productos, total, clienta, entrega y pago). Descuenta stock al cargarla. Los sets se cargan como producto con stock propio y descuentan sus componentes al armarse.

Y los correos, que van en el mismo hito **porque son parte de la transición**: cada cambio de estado encola un mail, y si el encolado falla la transición se revierte. Separarlos dejaría la máquina a medio implementar.

Bandeja de salida, plantillas, dominio autenticado con SPF, DKIM y DMARC. Jobs de expiración de reserva y recordatorio de pago. Recuperación de contraseña del panel por email. Mercado Pago con las credenciales de producción de la dueña.

_Terminado cuando:_ la dueña de la marca toma un pedido real, lo marca como enviado con su seguimiento, y la clienta recibe el mail en Gmail y en Outlook sin caer en spam.

### H6 · Contenido, legales y confianza

Página de marca y proceso, reseñas, términos, política de cambios (separada del arrepentimiento) y privacidad, metadatos y sitemap.

**Arrepentimiento (Res. 424/2020):** la API ya recibe las solicitudes. Falta enviar el código de la solicitud por email dentro de las 24 horas, y el botón visible desde la página de inicio, sin registro (Pablo). Sello de garantía en el envoltorio interno de la bolsita de lino, por higiene.

_Terminado cuando:_ el checklist legal está completo y verificado contra la normativa vigente.

### H7 · Endurecimiento y salida

**Hecho ✅.** Backups diarios cifrados e inmutables con restauración probada; usuarios de base con mínimo privilegio; rate limit en login y pedidos.

**Pendiente:** cabeceras de seguridad, revisión de validaciones, cambio de contraseña y ojito en el login, vencimiento de la sesión por inactividad, alerta si el backup falla, monitoreo de caídas, controles automáticos en GitHub (secretos, dependencias, análisis del código), misma versión de Node en todos lados, carga del catálogo real y prueba con tres clientas reales.

_Terminado cuando:_ la tienda está abierta.

### H8 · Combos configurables

Selector de jabones en la tienda, configuración de cada combo en el panel, stock de la caja más el de cada jabón elegido, y los componentes congelados en el pedido para que la dueña sepa qué armar.

_Terminado cuando:_ una clienta arma una caja eligiendo sus jabones, la paga, y el pedido muestra qué va adentro.

---

## 6. Reparto del trabajo

El criterio es dividir por capas verticales, no por archivos, para que nadie espere a nadie.

**Dante** toma el núcleo de negocio y el panel: esquema y migraciones, cotizador, checkout, máquina de estados, adaptador de pagos, webhook, bandeja de mails, operación (backups, usuarios de base), y **todas las pantallas del panel**.

**Pablo** toma el catálogo y la cara pública: home, grilla, ficha, carrito en el frontend, checkout en el frontend, páginas de contenido y legales, Próximamente en la tienda.

**La dueña de la marca** carga los productos y las fotos, escribe los textos (emails, legales, descripciones) y toma las decisiones comerciales (descuentos, plazos, envío gratis).

**Compartido:** la base del frontend (tokens, componentes de `ui/`, cliente HTTP, tipos generados) y la revisión cruzada de los PR del repo web.

**La frontera es el contrato OpenAPI.** Mientras el contrato esté escrito y acordado, cada uno trabaja sin depender del otro. Si el contrato cambia, se avisa antes de tocar código.

---

## 7. Riesgos

**Las fotos y los textos.** Es el riesgo número uno y no es técnico. Un catálogo de quince productos con tres fotos cada uno son semanas de trabajo de la dueña de la marca, que además produce y fotografía. Conviene arrancar con cinco productos bien cargados en vez de esperar a tenerlos todos.

**La conciliación de transferencias.** Está decidida la confirmación a mano por la dueña. El riesgo es operativo: alguien tiene que mirar los comprobantes todos los días. Si el volumen crece, se busca un proveedor de confirmación automática (el adaptador de 2.2 ya lo permite).

**Las cuentas de prueba de Mercado Pago.** Nunca funcionan a la primera. Reservar tiempo propio para eso.

**El alcance.** Van a aparecer ideas buenas todo el tiempo. Todas van a `IDEAS.md` y ninguna entra al hito en curso. Si una decisión nueva sí entra (como Próximamente o las ventas en persona), primero se agrega a este plan.

**El bus factor.** Dante escribió el backend completo y el panel entero. Si se baja, el proyecto se frena. Lo mitigan en parte los manuales (backups, usuarios de base, Mercado Pago) y los skills de seguridad, pero conviene que Pablo al menos lea los PR del backend aunque no los escriba.

**Los desvíos del plan.** Una decisión razonable que contradice una regla escrita (como pasó con el tipo de merge) se registra: o se actualiza el plan, o se vuelve a la regla.

---

## 8. Qué no se construye todavía

Las tablas pueden estar previstas en el esquema, pero estos módulos no tienen endpoints ni pantallas hasta que la tienda esté vendiendo:

cuentas de clientes, tienda mayorista, integración con APIs de correo, facturación automática, blog, lista de deseos, notificación de reposición, informes avanzados, cupones, archivado de productos, preventa de productos Próximamente.

Tener la tabla no cuesta nada. Tener un endpoint sin usar cuesta mantenerlo, documentarlo y romperlo en cada refactor.

---

## 9. Lo que sigue

1. **Próximamente en el panel** (campo de fecha) y **en la tienda** (Pablo), para que la dueña cargue los jabones en curado.
2. **El frontend del carrito y del checkout** (Pablo), que cierra H3 y desbloquea H4.
3. **Transferencia** en la API y la revisión de pedidos ajenos, que cierran H4.
4. **"Mi cuenta"**: cambio de contraseña y ojito en el login.
5. **La prueba del panel con la dueña de la marca**, que cierra H2.

---

## 10. Hallazgos abiertos

Detectados durante el trabajo, registrados para resolverlos en su propio PR:

- `?destacados=1` pasa la validación pero se ignora: usar `matchedData(req)` (Express 5).
- `src/models/imagenProducto.js.js` tiene doble extensión.
- Las rutas inexistentes responden `NO_ENCONTRADO` sin dejar un rastro distinguible en el log.
- `dotenv` se carga dos veces al arrancar.
- `padreActivo` interpola el alias en SQL: pasarlo por una lista blanca.
- La conexión a MySQL no verifica el certificado TLS (`rejectUnauthorized: false`), aceptado por ahora como riesgo bajo (red privada de Railway).
- Versión de Node distinta entre Railway (20) y local (22).

---

## 11. Cambios en este documento

**17/10/2026**

- Premisas: sets solo con productos propios, un solo descuento para efectivo y transferencia, ofertas que no se suman, ventas fuera de la web en el panel, Próximamente sin preventa.
- Arquitectura: nuevas 2.10 (mínimo privilegio en la base), 2.11 (backups) y 2.12 (Próximamente). Quitadas las notas de pendiente de `emails_pendientes` y del seed de pedidos, que ya existen.
- Convenciones: merge con squash por defecto y merge commit cuando conviene revertir por partes; nombres de modelos en minúscula; fechas como `AAAA-MM-DD`; mutación y paridad con Docker en testing; skills de seguridad y formato de riesgo.
- Hitos: estado actualizado de H1 a H7, hito nuevo de Próximamente, ventas en persona y sets en H5.
- Nuevas secciones: hallazgos abiertos y este registro de cambios.
- Decidido con la dueña: descuento del 10% por efectivo o transferencia. Transferencia con dos relojes: una hora para que la clienta pague y avise (antes eran 24 horas, según `docs/h4-checkout.md`), y 24 horas para que la dueña verifique la acreditación; si vence, el pedido pasa a "en revisión" con aviso, sin cancelarse.
