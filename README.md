# Velua API

Backend de la tienda online de [Velua](https://veluanature.com.ar), marca de
cosmética natural artesanal de Río Cuarto, Córdoba.

API REST en Node + Express con MySQL. El cliente vive en un repositorio aparte,
[`velua-web`](https://github.com/Dante-Patroni/velua-web), y consume esta API
contra el contrato definido en [`docs/openapi.json`](docs/openapi.json).

---

## Requisitos

- Node.js 20 o superior
- MySQL 8
- npm 10 o superior

---

## Puesta en marcha

```bash
git clone git@github.com:Dante-Patroni/velua-api.git
cd velua-api
npm install
```

Copiar `.env.example` a `.env` y completar los valores:

```bash
cp .env.example .env
```

Generar un secreto para los tokens:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Crear la base de datos vacía. Las tablas las crean las migraciones, no hace
falta ejecutar ningún `.sql`:

```sql
CREATE DATABASE velua CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Aplicar migraciones y datos de prueba:

```bash
npx sequelize-cli db:migrate
npm run seed
```

Levantar el servidor:

```bash
npm run dev
```

Verificar que responde:

- API: http://localhost:3000/api/v1/salud
- Documentación: http://localhost:3000/api-docs

---

## Scripts

| Script              | Qué hace                                |
| ------------------- | --------------------------------------- |
| `npm run dev`       | Servidor con recarga automática         |
| `npm start`         | Servidor en modo producción             |
| `npm run lint`      | ESLint, incluida la validación de JSDoc |
| `npm run format`    | Prettier sobre todo el repositorio      |
| `npm run test:unit` | Tests unitarios con Jest                |
| `npm test`          | Tests de endpoints con Newman           |
| `npm run seed`      | Carga los datos de prueba               |

---

## Variables de entorno

Todas están listadas en `.env.example`. Las que no tienen valor por defecto y
hacen fallar el arranque si faltan:

| Variable                                    | Para qué                                |
| ------------------------------------------- | --------------------------------------- |
| `DB_USERNAME`, `DB_PASSWORD`, `DB_DATABASE` | Conexión a MySQL                        |
| `JWT_SECRET`                                | Firma de los tokens de sesión del panel |
| `CORS_ORIGENES`                             | Orígenes permitidos, separados por coma |

En producción se usa `DATABASE_URL` en lugar de las tres primeras.

---

## Documentación

| Archivo                                              | Qué contiene                                                              |
| ---------------------------------------------------- | ------------------------------------------------------------------------- |
| [`PLAN.md`](PLAN.md)                                 | Arquitectura, decisiones de diseño e hitos del proyecto                   |
| [`AGENTS.md`](AGENTS.md)                             | Cómo se trabaja en este repositorio. **Leer antes de escribir código**    |
| [`DECISIONES.md`](DECISIONES.md)                     | Acuerdos que afectan también al frontend. Copia idéntica en los dos repos |
| [`FLUJO-DE-TRABAJO.md`](FLUJO-DE-TRABAJO.md)         | Ramas, commits y pull requests                                            |
| [`IDEAS.md`](IDEAS.md)                               | Mejoras pendientes que no entran en el hito actual                        |
| [`docs/openapi.json`](docs/openapi.json)             | Contrato de la API. Fuente de verdad del frontend                         |
| [`docs/esquema.sql`](docs/esquema.sql)               | Esquema de referencia. **Las migraciones son la fuente de verdad**        |
| [`docs/maquina-estados.md`](docs/maquina-estados.md) | Transiciones de estado del pedido y sus efectos                           |

---

## Antes de escribir código

Tres reglas del `AGENTS.md` que conviene tener presentes, porque la solución más
obvia las rompe:

1. **Los totales se calculan solo en `services/cotizador`.** Ningún controller ni
   el frontend calcula precios.
2. **Los estados del pedido solo cambian por su máquina de estados.** Nunca con un
   `update` suelto.
3. **Los ítems de un pedido guardan nombre y precio congelados.** No se
   reemplazan por un join contra `variantes` al mostrar un pedido histórico.

---

## Trabajo con agentes de IA

El archivo `CLAUDE.md` importa el `AGENTS.md` automáticamente. Cualquier asistente
que trabaje sobre este repositorio debe leer la sección 4 del `AGENTS.md` antes de
implementar.

---

## Estado

En desarrollo. Ver los hitos en `PLAN.md` y el avance en `docs/h0-fundaciones.md`.

---

## Autores

Dante Patroni y Pablo Tomatis.
