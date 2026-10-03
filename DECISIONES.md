# Decisiones compartidas · Velua

Copia idéntica en `velua-api` y `velua-web`. Cambiar algo de acá se habla entre los dos
antes de tocar código. Cada línea lleva fecha.

- **2026-09** En `velua-api`, el PR es obligatorio pero no requiere aprobación:
  es el repo de Dante y esperar revisión frena todo. En `velua-web` la
  aprobación sí se mantiene, porque los dos tocan los mismos archivos.

## Contrato

- **2026-09** Error: `{ "error": "CODIGO_DOMINIO" }`, y `{ "error": "DATOS_INVALIDOS", "details": {} }` en validaciones.
- **2026-09** Los textos legibles los arma el frontend desde el código de dominio. La API no manda mensajes para mostrar.
- **2026-09** Prefijo `/api/v1`. Recursos en plural.
- **2026-09** Paginación: `?pagina=1&limite=20`. Respuesta `{ datos: [], meta: { pagina, limite, total } }`.
- **2026-09** Importes viajan como cadena decimal, no como número.
- **2026-09** Los tipos del frontend se generan desde el OpenAPI. Endpoint sin documentar no se aprueba.
- **2026-09** Validación de entrada con express-validator. Los errores se devuelven como `DATOS_INVALIDOS` con `details` mapeado por campo: `{ "email": "mensaje", "cantidad": "mensaje" }`.
- **2026-09** Validación de entrada con express-validator. Errores como `DATOS_INVALIDOS` con `details` objeto plano por campo: `{ "email": "mensaje" }`.

## Dominio

- **2026-09** Todo se vende por variante. Un producto sin variantes reales lleva una variante única.
- **2026-09** Cada aroma o fórmula es un producto propio, con su slug. El eje de variante es el tamaño.
- **2026-09** Los ítems de un pedido guardan nombre y precio congelados al momento de la compra.
- **2026-09** Los totales los calcula únicamente el backend, en `services/cotizador`.
- **2026-09** Orden de cálculo: subtotal → cupón → ajuste por medio de pago → envío. Redondeo al peso, una vez, sobre el total.
- **2026-09** El carrito del frontend guarda `{ varianteId, cantidad }`. Nunca precios.
- **2026-09** Descuento por transferencia: porcentaje único y global, no por producto.
- **2026-09** El badge de oferta se muestra solo si hay precio anterior mayor al actual.
- **2026-09** Paleta medida del logo real: lavanda #9084AE, rosa #D89CA8,
  crema #FAF5EA, dorado #DBB261, salvia #8A9C50. El texto usa #4A4066, un violeta
  oscuro derivado del lavanda: el del logo da 3.04 de contraste sobre crema y no
  llega al mínimo para leer. Los valores anteriores (#464BB3 y #D985C7) eran
  incorrectos, salieron de un JPG de muestra.
- **2026-09** Tipografías: Cormorant Garamond para títulos y precios, Karla para
  textos y botones.
- **2026-09** Los combos son cajas fijas armadas de antemano, no configurables.
  Cada combo es un producto más, con stock propio.
- **2026-09** Las categorías son colecciones, no tipos de producto.
- - **2026-09** Desactivar una categoría oculta de la tienda todos sus productos,
    aunque cada uno siga activo. El listado del panel trae `cantidadProductos`
    para poder avisarlo antes de confirmar.
- **2026-09** Cambiar el nombre de una categoría o producto no cambia su slug.
  Para cambiar la URL hay que editar el slug a propósito, y el panel avisa que
  los links anteriores dejan de funcionar.

## Infraestructura

- **2026-09** Solo MySQL. Sin MongoDB.
- **2026-09** Sin Socket.IO. El panel consulta cada treinta segundos.
- **2026-09** Imágenes en Cloudinary. El backend no guarda archivos.
- **2026-09** Sesión del panel en cookie `httpOnly`, no en `localStorage`.
- **2026-09** Despliegue en subdominios del mismo dominio: `velua.com.ar` y `api.velua.com.ar`.
- **2026-09** Archivo de instrucciones para agentes: `AGENTS.md` en ambos repos, importado desde `CLAUDE.md`.
- **2026-09** Cookie de sesión del panel: `velua_sesion`, httpOnly, SameSite lax, path /api/v1.
- **2026-09** Override de `uuid` a ^11 para resolver el aviso de seguridad que arrastra Sequelize 6.
- **2026-09** Prefijo de rutas `/api/v1`. El `base_url` de Newman ya lo incluye.
- - **2026-09** Los secretos viven en las variables de entorno de Railway y Vercel.
    `.env` es solo para desarrollo local y está en `.gitignore`. `.env.example` se
    commitea con las claves vacías.
- **2026-09** Se evaluó pasar a PostgreSQL y se sostuvo MySQL. Motivo: el esquema,
  seis migraciones y el CI ya están en MySQL, y varias migraciones usan
  construcciones propias (`ON UPDATE CURRENT_TIMESTAMP`, enteros sin signo, ENUM
  en columna). Además los dos conocemos MySQL. Railway soporta ambos, así que el
  hosting no inclina la balanza.
- **2026-09** Railway conectado a `velua-api`. Trial de 30 días con USD 5 de
  crédito, sin tarjeta. Pasar a Hobby antes de que se agote: al agotarse los
  servicios se pausan, los datos se conservan.
  - **2026-09** MySQL 9 en producción y en CI. Las dos tienen que coincidir: una
    diferencia de versión entre lo que se prueba y lo que corre es de las cosas
    que aparecen en el peor momento.
  - **2026-09** El acceso público a MySQL en Railway queda desactivado. La API se
    conecta por la red interna con DATABASE_URL. Si hace falta entrar con un
    cliente externo, se activa, se usa y se vuelve a desactivar.

## Pendientes de decidir

- Servicio de conciliación automática de transferencias por CVU. Definir antes del hito 4.
- Umbral de envío gratis y porcentaje de descuento por transferencia. Los define la dueña de la marca.
- 2026-09 Override de `uuid` a ^11 para resolver el aviso de seguridad que arrastra Sequelize 6. Verificar Newman cuando haya colección.## Dominio

- ## Dominio

-- **2026-09** Dominio: `veluanature.com.ar`. `velua.com.ar` estaba registrado por
un tercero. Trámite por TAD en NIC Argentina, requiere CUIT/CUIL y Clave Fiscal
nivel 2. Arancel verificado: $8.500 de alta y $8.500 de renovación anual.

- **2026-09** Subdominios: `veluanature.com.ar` al frontend y
  `api.veluanature.com.ar` al backend. Mismo dominio registrable, que es lo que
  permite que la cookie de sesión funcione con SameSite lax.

- **2026-09** Titular: la dueña de la marca, no el desarrollador. El dominio es
  activo de Velua; ponerlo a otro nombre obliga a una transferencia ante NIC
  más adelante.

- **2026-09** El handle de Instagram es `@velua.nature`, con punto. El sitio lo
  cita exacto en footer y contacto.

## Hosting

- **2026-09** API y MySQL en Railway, desde USD 5/mes. Provisiona MySQL nativo.
- **2026-09** SPA en Vercel o Netlify. Gratis, estático, servido por CDN.
- **2026-09** Descartado Render. Solo soporta PostgreSQL y Redis de forma nativa,
  y su tier gratuito duerme los servicios tras unos 15 minutos de inactividad.
  Una tienda de bajo volumen está inactiva casi siempre, así que el webhook de
  Mercado Pago llegaría con el servicio dormido y 30 segundos de arranque en
  frío. MP reintenta, pero no vale la pena poner esa carrera justo en la parte
  que no puede fallar.
- **2026-09** El backend debe estar siempre encendido; el frontend no. De ahí la
  separación: se paga solo por la pieza que lo necesita.
  - **2026-09** En producción, `rejectUnauthorized: false` en la conexión a MySQL.
    Railway usa certificado autofirmado y la comunicación va por su red privada.
    Si la base se mudara a un proveedor con tráfico por internet, hay que cargar
    su certificado en vez de desactivar la verificación.
- **2026-09** API en producción: https://velua-api-production.up.railway.app
  Ruta base `/api/v1`. Migraciones y seed corridos desde la consola de Railway.

## Imágenes

- **2026-09** Cloudinary, plan free con 25 créditos mensuales. Las fotos no van
  en Railway ni en el repo: el filesystem del contenedor es efímero y se pierde
  en cada deploy.
- **2026-09** `imagenes_producto` guarda `url` y `public_id`. El `public_id` es
  necesario para borrar el archivo remoto al eliminar un producto; sin él quedan
  imágenes huérfanas consumiendo cuota para siempre.
- **2026-09** Subida con multer en `memoryStorage`, nunca `diskStorage`.
- **2026-09** Tope de 5 MB por archivo y formatos jpg, png y webp. El frontend
  valida antes de enviar; el backend rechaza igual. Con `memoryStorage` el
  archivo vive en la RAM del contenedor, que en Railway es acotada.
- **2026-09** Alternativas evaluadas y descartadas: ImageKit (20 GB de ancho de
  banda, transformaciones ilimitadas) y Cloudflare R2 (10 GB, sin transformaciones).

  ## Código

- **2026-09** Los modelos no llevan `defaultScope`. El filtro por `activo` lo hace
  el repositorio de forma explícita, para que el panel pueda ver los inactivos sin
  tener que usar `unscoped()`.
