# Día 1 · Checklist

Objetivo del día: **los dos repos creados, protegidos, con el andamiaje del backend limpio y corriendo en local.**

No se escribe lógica de negocio hoy. Si al final del día tenés `GET /api/v1/salud` respondiendo y un PR aprobado, el día fue un éxito.

Tiempo estimado total: cinco a seis horas. Se puede partir en dos tardes.

---

## Bloque 0 · Preparar el terreno · 20 min

- [ ] Decidir dónde viven los repos. **Recomendación: tu cuenta personal de GitHub**, con Pablo como colaborador. Así los repos aparecen en tu perfil, que es el punto de tenerlos.
- [ ] Tener a mano los archivos que ya preparamos: `AGENTS.md`, `CLAUDE.md`, `PLAN.md`, `DECISIONES.md`, `esquema.sql`.
- [ ] Confirmar que tenés SSH configurado contra GitHub:
      `ssh -T git@github.com` tiene que saludarte por tu nombre de usuario.
- [ ] Crear una carpeta madre local, por ejemplo `~/proyectos/velua/`.

---

## Bloque 1 · Crear los repos · 30 min

### En GitHub

- [ ] Nuevo repositorio `velua-api`. Privado. Sin README, sin `.gitignore`, sin licencia: lo subimos nosotros.
- [ ] Nuevo repositorio `velua-web`. Igual.
- [ ] En cada uno: *Settings → Collaborators* → agregar a Pablo con permiso de escritura.

### En local, para `velua-api`

```bash
cd ~/proyectos/velua
mkdir velua-api && cd velua-api
git init -b main
mkdir -p docs
# copiar acá: AGENTS.md  CLAUDE.md  PLAN.md  DECISIONES.md
# y el esquema a docs/esquema.sql
```

- [ ] Crear el `.gitignore` **antes** del primer commit:

```gitignore
node_modules/
.env
.env.local
coverage/
dist/
*.log
.DS_Store
```

- [ ] Primer commit y push:

```bash
git add .
git commit -m "docs: contexto del proyecto, plan, decisiones y esquema inicial"
git remote add origin git@github.com:TU-USUARIO/velua-api.git
git push -u origin main
```

- [ ] Repetir para `velua-web`, con `AGENTS.md`, `CLAUDE.md` y `DECISIONES.md`.

> El primer commit de un repo siendo documentación y no código es intencional. Todo lo que venga después nace dentro de esas reglas.

---

## Bloque 2 · Proteger `main` · 15 min

En cada repo: *Settings → Branches → Add branch ruleset*, sobre `main`.

- [ ] Activar **Require a pull request before merging**.
- [ ] Pedir **1 aprobación**.
- [ ] Activar **Require branches to be up to date before merging**.
- [ ] Dejar el bypass de administrador habilitado, pero acordar entre ustedes no usarlo.

Desde ahora no volvés a hacer `git push` sobre `main`. Todo entra por pull request, incluso cuando el cambio sea de una línea y estés solo.

---

## Bloque 3 · Vaciar El Buen Sabor · 2 a 3 h

**Regla de oro: no clonar como base ni hacer fork.** No queremos arrastrar el historial ni el dominio del restaurante. Se clona aparte y se copian archivos a mano.

```bash
cd ~/proyectos
git clone git@github.com:TU-USUARIO/el-buen-sabor-backend.git referencia-ebs
cd velua/velua-api
git switch -c chore/andamiaje
```

### Qué se copia

- [ ] `package.json` y `package-lock.json`
- [ ] Configuración de ESLint y Prettier
- [ ] Configuración de Jest
- [ ] `.github/workflows/ci.yml`
- [ ] Setup de Swagger
- [ ] `src/config/` (conexión, variables de entorno)
- [ ] `src/middlewares/` (`errorMapper`, `manejarErrorHttp`, validación)
- [ ] `app.js` y `server.js`, despojados
- [ ] `.sequelizerc` y la configuración de sequelize-cli

### Qué NO se copia

- [ ] Nada de `models/`, `controllers/`, `services/`, `repositories/` del dominio restaurante
- [ ] Mongoose y toda referencia a MongoDB
- [ ] Socket.IO, `events/`, `listeners/`
- [ ] Multer y la carpeta `uploads/`
- [ ] `cocina.html`, `caja.html`
- [ ] Migraciones, seeders y colección de Postman viejos

### Depurar

- [ ] Sacar del `package.json`: `mongoose`, `socket.io`, `multer` y lo que haya quedado huérfano.
- [ ] `rm -rf node_modules package-lock.json && npm install` para regenerar limpio.
- [ ] Crear el árbol de carpetas vacío según la sección 3 del `PLAN.md`, con un `.gitkeep` en cada una.

### El primer endpoint

- [ ] Implementar `GET /api/v1/salud` que devuelva versión, entorno y estado de la conexión a la base.
- [ ] Verificar: `npm run dev`, abrir la URL, ver el JSON.
- [ ] Verificar: `npm run test:unit` corre, aunque sea sin tests.
- [ ] Verificar: `http://localhost:3000/api-docs` levanta Swagger.

**Hacé este bloque a mano, no con el agente.** Es el único momento del proyecto en que vas a saber exactamente qué hay adentro del repo, y vale la pena.

---

## Bloque 4 · Base de datos local · 1 h

- [ ] Crear la base y correr `docs/esquema.sql` completo en tu MySQL local. Sirve para validar que no tiene errores de sintaxis ni de claves foráneas.
- [ ] Crear `.env` local con tus credenciales.
- [ ] Crear y commitear `.env.example` con las mismas claves y valores vacíos.
- [ ] Confirmar que `/api/v1/salud` reporta la base conectada.

> Las migraciones quedan para el día 2. A partir de ahí, **las migraciones son la fuente de verdad** y `esquema.sql` pasa a ser solo documentación de referencia.

---

## Bloque 5 · Cerrar el día · 30 min

```bash
git add .
git commit -m "chore: andamiaje inicial del backend con endpoint de salud"
git push -u origin chore/andamiaje
```

- [ ] Abrir el pull request en GitHub, describiendo qué se copió y qué se descartó.
- [ ] Pedirle a Pablo que lo revise. Que lo lea de verdad: es el esqueleto sobre el que va a correr todo.
- [ ] Merge con **squash**, borrar la rama, y en local:

```bash
git switch main && git pull && git branch -d chore/andamiaje
```

- [ ] Crear los issues del hito 0 en GitHub: migraciones, seed, contrato OpenAPI, máquina de estados, deploy.
- [ ] Anotar en `DECISIONES.md` cualquier cosa que hayas resuelto hoy y no estuviera escrita.

---

## Lo que NO se hace hoy

Modelos, migraciones, autenticación, productos, nada de dominio. El día uno es infraestructura. La tentación de empezar a escribir el CRUD de productos porque "ya está todo listo" es exactamente lo que convierte un proyecto ordenado en El Buen Sabor otra vez.

---

## Día 2, para que lo tengas en el horizonte

Traducir el esquema a migraciones, escribir el seed con datos realistas, y el contrato OpenAPI de catálogo. Recién con el OpenAPI arriba, Pablo puede generar tipos y arrancar de verdad.

---

## Lo que siguió en H0

Además del andamiaje, el hito incluyó:

- Migraciones del esquema completo, en cinco grupos lógicos
- Decisiones de hosting: Railway para API y base, Vercel para el frontend
- Columna `public_id` en `imagenes_producto` para Cloudinary
- Seed con datos realistas *(pendiente: esperando el catálogo de la marca)*
- Contrato OpenAPI de catálogo *(en curso)*
- Deploy vacío en producción *(pendiente)*
