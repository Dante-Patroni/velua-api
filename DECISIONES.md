# Decisiones compartidas · Velua

Copia idéntica en `velua-api` y `velua-web`. Cambiar algo de acá se habla entre los dos
antes de tocar código. Cada línea lleva fecha.

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
  
## Pendientes de decidir

- Servicio de conciliación automática de transferencias por CVU. Definir antes del hito 4.
- Umbral de envío gratis y porcentaje de descuento por transferencia. Los define la dueña de la marca.
- 2026-09 Override de `uuid` a ^11 para resolver el aviso de seguridad que arrastra Sequelize 6. Verificar Newman cuando haya colección.
