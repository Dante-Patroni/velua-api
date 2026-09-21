# H2 · Panel de administración

_Estado: por iniciar. Depende de H1 cerrado en el backend, que ya lo está._

## Objetivo

Que la dueña de la marca administre su catálogo sin depender de nadie.

**Terminado cuando:** carga un producto completo, con fotos, y lo ve publicado en
la tienda. Sin ayuda, sin instrucciones y sin que nadie toque la base.

Ese criterio es más exigente de lo que parece y conviene tenerlo presente todo el
tiempo: no alcanza con que los endpoints funcionen. Si hay que explicarle qué es
un slug o por qué un producto necesita una variante, el hito no está terminado.

---

## Por qué va ahora y no al final

Alguien tiene que cargar el catálogo real con sus fotos, y eso son semanas de
trabajo que corren en paralelo. Si el panel llega último, la tienda queda lista y
vacía.

Además, todo lo que se construya acá se reusa después: la autenticación, la
subida de imágenes y el patrón de formularios son los mismos que van a hacer falta
para pedidos, cupones y configuración.

---

## Alcance

### Backend

- [ ] Autenticación: login, logout y verificación de sesión
- [ ] CRUD de categorías
- [ ] CRUD de productos, con sus variantes en la misma operación
- [ ] Subida y borrado de imágenes en Cloudinary
- [ ] Reordenamiento de imágenes
- [ ] Generación de slugs
- [ ] Tests unitarios de los servicios nuevos
- [ ] Colección Newman de los endpoints del panel

### Frontend

- [ ] Rama de rutas `/admin` con su layout y carga diferida
- [ ] Pantalla de login
- [ ] Listado de productos con búsqueda y filtro por estado
- [ ] Formulario de producto con variantes e imágenes
- [ ] Listado y formulario de categorías
- [ ] Manejo de sesión expirada

### Fuera de alcance

Gestión de pedidos, cupones, configuración de la tienda, informes. Todo eso viene
después, cuando haya ventas que gestionar.

---

## Decisiones a tomar antes de empezar

### 1. El primer usuario

No se puede crear un admin desde el panel si no hay ninguno para entrar.

**Propuesta:** un seed que crea el usuario inicial leyendo mail y contraseña de
variables de entorno, y que obliga a cambiar la contraseña en el primer ingreso.
Nada de credenciales escritas en el código.

### 2. Duración de la sesión

**Propuesta:** un solo JWT de ocho horas, sin refresh. Con uno o dos usuarios que
entran a cargar productos, un esquema de refresh agrega complejidad sin resolver
nada. Si la sesión expira, vuelve a entrar.

Cuando expire, el frontend tiene que llevarla al login sin perder lo que estaba
escribiendo. Eso es más importante que la duración.

### 3. Los slugs

Es la decisión más delicada, porque el slug es la URL pública.

**Propuesta:** se genera solo a partir del nombre, normalizando acentos y
apóstrofes, pero se puede editar a mano. Y **si el producto ya está publicado, se
avisa antes de cambiarlo**: los links compartidos dejan de funcionar.

Hay un caso a resolver: dos productos con el mismo nombre. El slug es único, así
que hay que agregar un sufijo o rechazar la operación.

### 4. Variantes en la misma pantalla que el producto

El esquema exige al menos una variante por producto. Si son dos pantallas
distintas, ella va a guardar un producto y va a quedar inválido.

**Propuesta:** un solo formulario. Al crear un producto, el primer bloque de
variante viene abierto con "Único" como nombre por defecto.

### 5. Borrado

Ya está decidido que las bajas son lógicas. Pero hay que resolver qué pasa con las
imágenes: si un producto se despublica, sus fotos siguen ocupando cuota en
Cloudinary.

**Propuesta:** despublicar no borra las fotos. Solo se borran cuando ella elimina
una imagen explícitamente. Con veinticinco créditos mensuales alcanza de sobra.

### 6. Reordenar imágenes

**Propuesta:** arrastrar y soltar. Un campo numérico de orden funciona pero es
justo el tipo de cosa que hace que alguien no técnico se trabe. La primera imagen
es la principal, y eso tiene que verse en pantalla.

---

## Orden de trabajo

Cada paso es una rama y un PR.

### 1. Autenticación

`feat/auth-panel`

Login con bcrypt, cookie `httpOnly`, middleware ya existente. Endpoints:
`POST /auth/login`, `POST /auth/logout`, `GET /auth/yo`.

Seed del usuario inicial. Rate limit estricto en el login, que ya está en
`limitadorLogin`.

**Terminado cuando:** se entra y se sale desde Postman, y `GET /auth/yo` devuelve
el usuario con la cookie puesta.

**Lo que vamos a construir, en orden:**

El modelo Usuario, que la tabla ya existe pero el modelo no
El mapa de roles a permisos
Repositorio con su interfaz
AuthService con sus tests
Controller y rutas
Seed del usuario inicial
Documentación OpenAPI y colección Newman

### 2. CRUD de categorías

`feat/admin-categorias`

Es el recurso más simple y sirve de molde para lo que viene. Cuatro endpoints y su
pantalla.

**Terminado cuando:** se crea, edita, reordena y despublica una categoría desde el
panel.

### 3. CRUD de productos y variantes

`feat/admin-productos`

El más largo. Producto y variantes en la misma operación, con transacción:
si falla una variante, no queda el producto a medias.

Generación de slug con su función y sus tests.

**Terminado cuando:** se crea un producto con dos variantes y aparece en la tienda.

### 4. Imágenes

`feat/admin-imagenes`

Multer con `memoryStorage`, tope de 5 MB, jpg, png y webp. Subida a Cloudinary,
guardado de `url` y `public_id`. Borrado remoto al eliminar. Reordenamiento.

**Terminado cuando:** se suben tres fotos a un producto, se reordenan, se borra una
y desaparece también de Cloudinary.

### 5. Pantallas del panel

`feat/panel-admin`

La rama de rutas, el layout con sidebar, y las pantallas conectadas a los
endpoints anteriores.

**Terminado cuando:** la dueña de la marca carga un producto completo sin ayuda.

---

## Reparto

**Dante:** autenticación, endpoints y servicios del panel, integración con
Cloudinary, slugs.

**Pablo:** las pantallas del panel, el manejo de sesión y el componente de subida
de imágenes.

**La frontera sigue siendo el OpenAPI.** Los endpoints del panel se documentan
igual que los públicos, con su `security: [{ cookieAuth: [] }]`.

---

## Riesgos

**La prueba con la usuaria real.** El criterio de terminado depende de que ella
pueda sola. Conviene sentarse a mirarla cargar un producto antes de dar el hito
por cerrado, sin ayudarla y anotando dónde duda. Esa media hora vale más que
cualquier revisión de código.

**Cloudinary con `memoryStorage`.** El archivo pasa por la RAM del contenedor.
Tres fotos grandes en paralelo pueden tumbarlo en Railway. El tope de 5 MB no es
opcional.

**Los slugs de productos publicados.** Si ella renombra un producto que ya circula
por WhatsApp, los links se rompen. El aviso tiene que ser claro, no un texto chico.

**El alcance.** Un panel invita a agregar cosas: informes, estadísticas, filtros
avanzados. Todo eso a `IDEAS.md`.

---

## Lo que desbloquea

Con el panel andando, la carga del catálogo real puede arrancar en paralelo con
H3. Y las fotos, que siguen siendo el riesgo número uno del proyecto, dejan de
depender de que alguien las suba por código.
