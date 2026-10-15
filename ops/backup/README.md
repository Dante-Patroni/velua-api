# Backup diario de la base de Velua

Servicio de Railway `velua-backup` (cron `17 6 * * *` = 03:17 hora argentina).

```
MySQL (red privada) --mysqldump--> gzip --> age (clave pública) --> Backblaze B2
usuario velua_backup                                              bucket velua-backups-rc2026
(solo lectura)                                                    (Object Lock 30 días)
```

- Los datos nunca quedan en disco sin cifrar.
- El servicio **no puede leer, listar ni borrar** backups: su clave de B2 solo tiene `writeFiles`.
- Para descifrar hace falta la clave privada `age`, que está **offline** (pendrive + papel), nunca en Railway ni en el repo.

## Archivos

| Archivo                 | Para qué                                                                                             |
| ----------------------- | ---------------------------------------------------------------------------------------------------- |
| `Dockerfile`            | Imagen: mysqldump 9.7.2 + age 1.3.2 + rclone 1.75.2, fijadas por digest. Corre como usuario `mysql`. |
| `backup.sh`             | Hace el backup. `BACKUP_MODO=prueba` sube un texto sin datos personales.                             |
| `verificar-permisos.sh` | Comprueba que la clave de B2 no pueda listar ni leer.                                                |

## Variables en Railway (`velua-backup`)

| Variable                                       | Valor                                                                             |
| ---------------------------------------------- | --------------------------------------------------------------------------------- |
| `BACKUP_MODO`                                  | `real`                                                                            |
| `AGE_RECIPIENT`                                | `age1kf2qz9xc8e7he45aq3e6hv6hkwe7n662m74rrwy69dq96leh6a6q0cljx9`                  |
| `MYSQL_HOST` / `MYSQL_PORT` / `MYSQL_DATABASE` | `${{MySQL.MYSQLHOST}}` / `${{MySQL.MYSQLPORT}}` / `${{MySQL.MYSQLDATABASE}}`      |
| `MYSQL_BACKUP_USER`                            | `velua_backup`                                                                    |
| `MYSQL_BACKUP_PASSWORD`                        | secreto (solo en Railway)                                                         |
| `B2_ENDPOINT` / `B2_REGION` / `B2_BUCKET`      | `https://s3.us-east-005.backblazeb2.com` / `us-east-005` / `velua-backups-rc2026` |
| `B2_KEY_ID` / `B2_APPLICATION_KEY`             | clave `velua-railway-backup` (secreto; solo en Railway)                           |

Settings: Root Directory `/ops/backup`, rama `main`, Restart Policy `Never`, sin dominio público.

## Cómo restaurar (Windows + Docker)

1. Descargar el backup desde la web de Backblaze (Buckets → `velua-backups-rc2026` → Cargar/descargar → `mysql/`).
   El navegador puede agregarle el prefijo `mysql_` al nombre.
2. Verificar el hash contra el log del servicio (`cifrado OK: ... sha256 ...`):
   ```powershell
   (Get-FileHash "$HOME\velua-backup-salida\ARCHIVO.sql.gz.age" -Algorithm SHA256).Hash
   ```
3. Levantar un MySQL 9.7.2 separado (nunca restaurar encima de producción para "probar"):
   ```powershell
   docker network create velua-backup-test
   docker run -d --name mysql-test --network velua-backup-test -e MYSQL_ROOT_PASSWORD=solo-local-123 -p 127.0.0.1:3307:3306 mysql:9.7.2
   docker exec mysql-test mysql -uroot -psolo-local-123 -e "CREATE DATABASE restaurada CHARACTER SET utf8mb4;"
   ```
4. Descifrar y restaurar. La clave privada entra por stdin (Docker no ve el pendrive) y solo queda en memoria:
   ```powershell
   Get-Content E:\velua-backup.key.txt | docker run --rm -i --network velua-backup-test -v "$HOME\velua-backup-salida:/salida:ro" --entrypoint bash velua-backup:local -c "set -euo pipefail; age -d -i <(tr -d '\r\000\376\377' | grep '^AGE-SECRET-KEY-1') /salida/ARCHIVO.sql.gz.age | gzip -d | mysql -h mysql-test -uroot -psolo-local-123 --default-character-set=utf8mb4 restaurada && echo RESTAURADO_OK"
   ```
5. Verificar con conteos exactos (`COUNT(*)`, no `TABLE_ROWS`), sin navegar datos de clientes.
6. **Borrar** la base restaurada y el archivo descargado al terminar.

En una emergencia real: restaurar al costado, verificar, y recién después apuntar la API a la base restaurada.

## Controles periódicos

- **Mensual:** prueba de restauración completa (pasos 1 a 6) del backup más reciente.
- **Mensual:** `verificar-permisos.sh` y revisar `b2 key list` (no debe haber claves desconocidas).
- **Semanal:** en Backblaze, la cantidad de archivos en `mysql/` crece de a uno por día y los tamaños son parecidos.

## Rotar credenciales

- **MySQL:** `ALTER USER 'velua_backup'@'%' IDENTIFIED BY RANDOM PASSWORD;` → pegar en `MYSQL_BACKUP_PASSWORD`.
- **B2:** crear una clave nueva con la CLI (`b2 key create --bucket velua-backups-rc2026 <nombre> writeFiles`), cargarla en Railway, correr `BACKUP_MODO=prueba`, y recién después borrar la vieja (`b2 key delete <keyID>`). La clave maestra se regenera al terminar.
- **age:** generar un par nuevo, cambiar `AGE_RECIPIENT` y conservar la clave privada vieja hasta que venzan los backups cifrados con ella (30 días).
