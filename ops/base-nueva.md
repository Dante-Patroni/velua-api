# Base de producción nueva o perdida

Qué hacer si la base de producción se pierde, se daña o hay que armar una nueva.

## Regla

En producción **nunca** se corren los seeders de ejemplo (`npm run seed`,
`db:seed:all`): cargarían un catálogo y pedidos falsos encima de los reales. Desde
el #64 fallan solos si `NODE_ENV` no es `development` ni `test`.

Las migraciones no hace falta correrlas a mano: el pre-deploy de Railway corre
`npx sequelize-cli db:migrate --env migraciones` en cada despliegue.

## Caso 1: la base se perdió o se dañó

Se **restaura el último backup** siguiendo `ops/backup/README.md`. El backup trae
el catálogo real, los pedidos y los usuarios. No se vuelve a sembrar nada.

## Caso 2: base vacía, sin backup útil

1. Desplegar la API: el pre-deploy crea las tablas.
2. Crear la primera admin. La base de Railway solo es accesible desde su red
   privada, así que el seeder `usuario-inicial` no se puede correr desde una
   máquina local. Se usa el mismo método que `ops/restablecer-contrasena.md`:
   - Generar el hash con `node scripts/hash-contrasena.js`. La contraseña la
     escribe la dueña, que es la única que la conoce.
   - En la pestaña Data de Railway, verificar primero que el mail no exista:
     `SELECT id FROM usuarios WHERE email = '<mail>';` (0 filas).
   - Insertar:
     `INSERT INTO usuarios (nombre, email, password_hash, rol, activo, creado_en)
     VALUES ('<nombre>', '<mail>', '<hash>', 'admin', 1, NOW());` (1 fila afectada).
   - Limpiar la terminal (`cls`): el hash no queda en pantalla ni se copia a
     ningún otro lado.
3. La dueña inicia sesión en el panel y carga el catálogo, o se restaura
   un backup parcial si existe.

Las variables `ADMIN_NOMBRE`, `ADMIN_EMAIL` y `ADMIN_PASSWORD` no se cargan
en Railway: solo las usa el seeder en desarrollo y en el CI.