#!/usr/bin/env bash
# Backup diario de Velua.
#   mysqldump (usuario de solo lectura) -> gzip -> age (clave pública) -> Backblaze B2 (clave solo escritura)
# Reglas: nunca escribe datos sin cifrar en disco y nunca imprime secretos.
#
# Variables:
#   BACKUP_MODO           real (por defecto) | prueba  -> "prueba" cifra y sube un texto sin datos personales
#   BACKUP_SALIDA_LOCAL   si está definida, deja el archivo cifrado en esa carpeta en vez de subirlo (pruebas locales)
#   MYSQL_HOST MYSQL_PORT MYSQL_DATABASE MYSQL_BACKUP_USER MYSQL_BACKUP_PASSWORD   (solo modo real)
#   AGE_RECIPIENT         clave pública age1...
#   B2_ENDPOINT B2_REGION B2_BUCKET B2_KEY_ID B2_APPLICATION_KEY                  (si no hay salida local)
set -Eeuo pipefail
umask 077

log() { printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }
fallar() { log "ERROR: $*" >&2; exit 1; }
requerir() {
  local v
  for v in "$@"; do
    [[ -n "${!v:-}" ]] || fallar "falta la variable $v" # solo el nombre, nunca el valor
  done
}

MODO="${BACKUP_MODO:-real}"
[[ "$MODO" == "real" || "$MODO" == "prueba" ]] || fallar "BACKUP_MODO debe ser 'real' o 'prueba'"

# 1) Validar configuración antes de tocar nada
requerir AGE_RECIPIENT
[[ "$AGE_RECIPIENT" =~ ^age1[02-9ac-hj-np-z]{58}$ ]] || fallar "AGE_RECIPIENT no es una clave pública age1... válida"
[[ "$MODO" == "real" ]] && requerir MYSQL_HOST MYSQL_PORT MYSQL_DATABASE MYSQL_BACKUP_USER MYSQL_BACKUP_PASSWORD
[[ -z "${BACKUP_SALIDA_LOCAL:-}" ]] && requerir B2_ENDPOINT B2_REGION B2_BUCKET B2_KEY_ID B2_APPLICATION_KEY

# 2) Carpeta temporal privada (0700), borrada siempre al salir, aunque falle
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

STAMP="$(date -u +%Y-%m-%dT%H%M%SZ)"

# 3) Generar el archivo cifrado. Los datos pasan por un pipe: nunca quedan en disco sin cifrar.
if [[ "$MODO" == "real" ]]; then
  PREFIJO="mysql"
  ARCHIVO="velua-${MYSQL_DATABASE}-${STAMP}.sql.gz.age"

  # Credenciales en un archivo 0600 y no como argumento: así no aparecen en la lista de procesos (ps).
  # Se escapan \ y " porque la contraseña es aleatoria y puede contenerlos.
  pw="${MYSQL_BACKUP_PASSWORD//\\/\\\\}"
  pw="${pw//\"/\\\"}"
  {
    printf '[client]\n'
    printf 'host=%s\nport=%s\nuser=%s\n' "$MYSQL_HOST" "$MYSQL_PORT" "$MYSQL_BACKUP_USER"
    printf 'password="%s"\n' "$pw"
  } > "$TMP/my.cnf"
  unset pw

  log "inicio: backup real de la base $MYSQL_DATABASE"
  # --single-transaction: copia consistente sin bloquear la tienda (InnoDB)
  # --no-tablespaces y --set-gtid-purged=OFF: evitan pedir privilegios globales (PROCESS, RELOAD)
  # --no-tablespaces y --set-gtid-purged=OFF: evitan pedir privilegios globales (PROCESS, RELOAD)
  # --skip-masking-policies: no usamos políticas de enmascaramiento; con un usuario restringido,
  #   mysqldump 9.x recibe "denegado" al buscarlas y lo informa como error (ver DECISIONES.md)
  mysqldump --defaults-extra-file="$TMP/my.cnf" \
    --single-transaction --quick --no-tablespaces --set-gtid-purged=OFF --skip-masking-policies \
    --triggers --hex-blob --default-character-set=utf8mb4 \
       "$MYSQL_DATABASE" 2> "$TMP/mysqldump.err" \
    | gzip -9 \
    | age --encrypt --recipient "$AGE_RECIPIENT" --output "$TMP/$ARCHIVO"
  rm -f "$TMP/my.cnf"
  # mysqldump puede informar un error y aun así salir con código 0.
  # Cualquier mensaje en stderr invalida el backup: se descarta y no se sube.
  if [[ -s "$TMP/mysqldump.err" ]]; then
    cat "$TMP/mysqldump.err" >&2
    fallar "mysqldump informó errores; el backup se descarta y no se sube"
  fi
else
  PREFIJO="prueba"
  ARCHIVO="prueba-${STAMP}.txt.age"
  log "inicio: modo prueba (sin datos personales)"
  printf 'Prueba de backup de Velua - %s - sin datos personales\n' "$STAMP" \
    | age --encrypt --recipient "$AGE_RECIPIENT" --output "$TMP/$ARCHIVO"
fi

TAM="$(stat -c %s "$TMP/$ARCHIVO")"
HASH="$(sha256sum "$TMP/$ARCHIVO" | cut -d' ' -f1)"
if [[ "$MODO" == "real" ]] && (( TAM < 1024 )); then
  fallar "el archivo cifrado es sospechosamente chico ($TAM bytes)"
fi
log "cifrado OK: $ARCHIVO ($TAM bytes, sha256 $HASH)"

# 4) Entregar el archivo cifrado
if [[ -n "${BACKUP_SALIDA_LOCAL:-}" ]]; then
  cp "$TMP/$ARCHIVO" "$BACKUP_SALIDA_LOCAL/$ARCHIVO"
  log "guardado local: $BACKUP_SALIDA_LOCAL/$ARCHIVO"
else
  # rclone configurado solo por variables de entorno (sin archivo de configuración).
  # NO_CHECK_BUCKET / NO_HEAD / NO_HEAD_OBJECT / --no-check-dest: la clave solo puede escribir,
  # así que rclone no debe intentar leer ni listar nada.
  export RCLONE_CONFIG_VELUA_TYPE=s3
  export RCLONE_CONFIG_VELUA_PROVIDER=Other
  export RCLONE_CONFIG_VELUA_ACCESS_KEY_ID="$B2_KEY_ID"
  export RCLONE_CONFIG_VELUA_SECRET_ACCESS_KEY="$B2_APPLICATION_KEY"
  export RCLONE_CONFIG_VELUA_ENDPOINT="$B2_ENDPOINT"
  export RCLONE_CONFIG_VELUA_REGION="$B2_REGION"
  export RCLONE_CONFIG_VELUA_NO_CHECK_BUCKET=true
  export RCLONE_CONFIG_VELUA_NO_HEAD=true
  export RCLONE_CONFIG_VELUA_NO_HEAD_OBJECT=true
  rclone copyto "$TMP/$ARCHIVO" "velua:$B2_BUCKET/$PREFIJO/$ARCHIVO" \
    --no-check-dest --retries 3 --low-level-retries 5 --stats 0
  log "subido OK: $B2_BUCKET/$PREFIJO/$ARCHIVO"
fi

log "fin OK"