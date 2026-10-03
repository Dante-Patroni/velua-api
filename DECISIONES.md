# Decisiones compartidas · Velua

Copia idéntica en `velua-api` y `velua-web`. Cambiar algo de acá se habla entre los dos
antes de tocar código. Cada línea lleva fecha.

---

## Trabajo en equipo

- **2026-09** En `velua-api`, el PR es obligatorio pero no requiere aprobación: es el
  repo de Dante y esperar revisión frena todo. En `velua-web` la aprobación sí se
  mantiene, porque los dos tocan los mismos archivos.
- **2026-09** Merge con squash, siempre, en los dos repos.
- **2026-09** Archivo de instrucciones para agentes: `AGENTS.md` en ambos repos,
  importado desde `CLAUDE.md`.

---

## Contrato de la API

- **2026-09** Prefijo `/api/v1`. Recursos en plural.
- **2026-09** Error: `{ "error": "CODIGO_DOMINIO" }`, y
  `{ "error": "DATOS_INVALIDOS", "details": {} }` en validaciones, con `details`
  como objeto plano por campo: `{ "email": "mensaje" }`.
- **2026-09** Los textos legibles los arma el frontend desde el código de dominio.
  La API no manda mensajes para mostrar.
- **2026-09** Paginación: `?pagina=1&limite=20`. Respuesta
  `{ datos: [], meta: { pagina, limite, total } }`.
- **2026-09** Los importes viajan como cadena decimal, nunca como número.
- **2026-09** Validación de entrada con express-validator.
- **2026-09** Los tipos del frontend se generan desde el OpenAPI. Endpoint sin
  documentar no se aprueba.
- **2026-09** `docs/openapi.json` es un archivo generado: la documentación vive en
  comentarios `@openapi` en las rutas y el JSON sale de `npm run openapi`. Nunca se
  edita a mano.

---

## Catálogo y dominio del negocio

- **2026-09** Todo se vende por variante. Un producto sin variantes reales lleva una
  variante única.
- **2026-09** Cada aroma o fórmula es un producto propio, con su slug. El eje de
  variante es el tamaño.
- **2026-09** Las categorías son colecciones, no tipos de producto.
- **2026-09** Los combos son cajas fijas armadas de antemano, no configurables. Cada
  combo es un producto más, con stock propio.
- **2026-09** Édition Unique: lo irrepetible es el diseño de cada pieza, no la
  fórmula. Se repone y se produce como cualquier otra colección.
- **2026-09** Los totales los calcula únicamente el backend, en `services/cotizador`.
- **2026-09** Orden de cálculo: subtotal → cupón → ajuste por medio de pago → envío.
  Redondeo al peso, una vez, sobre el total.
- **2026-09** Los ítems de un pedido guardan nombre y precio congelados al momento de
  la compra.
- **2026-09** El carrito del frontend guarda `{ varianteId, cantidad }`. Nunca precios.
- **2026-09** Descuento por transferencia: porcentaje único y global, no por producto.
- **2026-09** El badge de oferta se muestra solo si hay precio anterior mayor al
  actual.
- **2026-09** Cambiar el nombre de una categoría o producto no cambia su slug. Para
  cambiar la URL hay que editar el slug a propósito, y el panel avisa que los links
  anteriores dejan de funcionar.
- **2026-09** Desactivar una categoría oculta de la tienda todos sus productos, aunque
  cada uno siga activo. El listado del panel trae `cantidadProductos` para poder
  avisarlo antes de confirmar.
- **2026-10** Las variantes no se borran, se desactivan: los pedidos históricos las
  referencian. Y no se puede desactivar la última activa de un producto.
- **2026-10** Un producto se puede borrar de verdad **solo si nunca se vendió**. Si
  tiene ventas, se despublica. Permiso `CATALOGO_BORRAR`, que solo tiene el admin.

---

## Estilo e identidad

- **2026-09** Paleta medida del logo real: lavanda #9084AE, rosa #D89CA8, crema
  #FAF5EA, dorado #DBB261. Los valores anteriores (#464BB3 y #D985C7) eran
  incorrectos, salieron de un JPG de muestra.
- **2026-09** Para texto solo sirven tinta #4A4066, texto-suave #5B5178, texto-tenue
  #6B6188, etiqueta #6F6036, salvia-hondo #47562B y dorado-texto #985C14. El lavanda
  da 3.04 de contraste sobre la crema y el dorado-hondo 2.87, cuando el mínimo
  legible es 4.5: esos son para superficies y trazos.
- **2026-09** Tipografías: Cormorant Garamond para títulos y precios, Karla para
  textos y botones.

---

## Código

- **2026-09** Los modelos no llevan `defaultScope`. El filtro por `activo` lo hace el
  repositorio de forma explícita, para que el panel pueda ver los inactivos sin tener
  que usar `unscoped()`.
- **2026-09** El repositorio devuelve datos crudos. El mapeo al contrato lo hace el
  service, así el panel puede usar los mismos métodos aunque necesite otros campos.
- **2026-10** En el frontend, un archivo que exporta componentes no exporta otra cosa:
  las actions van en `Pagina.action.ts` y los auxiliares en `Componente.utils.ts`. Es
  lo que pide la recarga en caliente de Vite.
- **2026-10** Las carpetas van siempre en minúscula. Windows no distingue mayúsculas
  pero Linux sí, y el CI corre en Linux.

---

## Infraestructura

- **2026-09** Solo MySQL. Sin MongoDB. Se evaluó pasar a PostgreSQL y se sostuvo
  MySQL: el esquema, las migraciones y el CI ya estaban hechos, y varias migraciones
  usan construcciones propias (`ON UPDATE CURRENT_TIMESTAMP`, enteros sin signo, ENUM
  en columna).
- **2026-09** MySQL 9 en producción y en CI. Las dos tienen que coincidir: una
  diferencia de versión entre lo que se prueba y lo que corre es de las cosas que
  aparecen en el peor momento.
- **2026-09** Sin Socket.IO. El panel consulta cada treinta segundos.
- **2026-09** Los secretos viven en las variables de entorno de Railway y Vercel.
  `.env` es solo para desarrollo local y está en `.gitignore`. `.env.example` se
  commitea con las claves vacías.
- **2026-09** Override de `uuid` a ^11, para resolver el aviso de seguridad que
  arrastra Sequelize 6.
- **2026-09** En producción, `rejectUnauthorized: false` en la conexión a MySQL.
  Railway usa certificado autofirmado y la comunicación va por su red privada.
- **2026-09** El acceso público a MySQL en Railway queda desactivado. La API se
  conecta por la red interna con `DATABASE_URL`.
- **2026-10** En Railway, una variable nueva o modificada **no llega al contenedor
  hasta que se redespliega**. Verificar con `echo "[$VARIABLE]"` desde la consola
  antes de dar por hecho que se aplicó.

---

## Hosting y dominio web

- **2026-09** API y MySQL en Railway, desde USD 5/mes. SPA en Vercel, gratis y
  servida por CDN. El backend debe estar siempre encendido, el frontend no: se paga
  solo por la pieza que lo necesita.
- **2026-09** Descartado Render: solo soporta PostgreSQL y Redis de forma nativa, y
  su tier gratuito duerme los servicios tras unos 15 minutos. El webhook de Mercado
  Pago llegaría con el servicio dormido y 30 segundos de arranque en frío.
- **2026-09** Dominio `veluanature.com.ar`; `velua.com.ar` estaba registrado por un
  tercero. Trámite por TAD en NIC Argentina, con CUIT y Clave Fiscal nivel 2.
  $8.500 de alta y lo mismo de renovación anual.
- **2026-09** Titular: la dueña de la marca, no el desarrollador. El dominio es activo
  de Velua; ponerlo a otro nombre obligaría a una transferencia ante NIC.
- **2026-09** El handle de Instagram es `@velua.nature`, con punto. El sitio lo cita
  exacto en el pie y en contacto.
- **2026-10** Dominio delegado a Vercel con sus nameservers. El sitio en
  `veluanature.com.ar` y la API en `api.veluanature.com.ar`, por CNAME a Railway.

---

## Sesión del panel

- **2026-09** Sesión en cookie `httpOnly`, no en `localStorage`. Nombre `velua_sesion`,
  SameSite lax, path `/api/v1`.
- **2026-10** La cookie lleva `domain` con punto adelante, `.veluanature.com.ar`, para
  valer en todos los subdominios. Con dominios distintos el navegador la guarda para
  la API y no la manda desde el panel. Se descartó `SameSite=none`, que habría
  obligado a verificar el origen en cada escritura.
- **2026-10** El dominio de la cookie se lee de `COOKIE_DOMINIO` y no está escrito en
  el código: en desarrollo no tiene que haber ninguno, porque `localhost` rechaza las
  cookies con dominio declarado.

---

## Imágenes

- **2026-09** Cloudinary, plan free con 25 créditos mensuales. Las fotos no van en
  Railway ni en el repo: el filesystem del contenedor es efímero y se pierde en cada
  deploy.
- **2026-09** `imagenes_producto` guarda `url` y `public_id`. El `public_id` es
  necesario para borrar el archivo remoto; sin él quedan imágenes huérfanas
  consumiendo cuota para siempre.
- **2026-09** Subida con multer en `memoryStorage`, nunca `diskStorage`.
- **2026-09** Tope de 5 MB por archivo y formatos jpg, png y webp. El frontend valida
  antes de enviar; el backend rechaza igual y verifica los primeros bytes del
  archivo, no el tipo que declara el navegador.
- **2026-09** Alternativas evaluadas y descartadas: ImageKit y Cloudflare R2.

---

## Fuera de alcance

- **2026-09** Notificación de reposición. El link "Avisarme" de las tarjetas agotadas
  abre WhatsApp: cuando vuelve el stock se avisa a mano.
- **2026-09** Combos configurables con casilleros. Descartado.

---

## Pendientes de decidir

- Servicio de conciliación automática de transferencias por CVU. Definir antes del
  hito 4.
- Umbral de envío gratis y porcentaje de descuento por transferencia. Los define la
  dueña de la marca.
- Archivar productos: un estado más allá de despublicado, para que un combo de
  temporada con ventas desaparezca del listado sin borrarse.
