#!/usr/bin/env bash
# Verifica que la clave de B2 del backup SOLO pueda escribir.
# Uso (desde la raíz de velua-api, con B2_KEY_ID y B2_APPLICATION_KEY en el entorno):
#   docker run --rm -e B2_KEY_ID -e B2_APPLICATION_KEY \
#     -v "${PWD}/ops/backup/verificar-permisos.sh:/verificar.sh:ro" \
#     --entrypoint bash velua-backup:local /verificar.sh <ruta/del/archivo/en/el/bucket>
# Resultado esperado: listar y leer DENEGADOS. Borrar: ver nota al final.
set -uo pipefail

[[ -n "${B2_KEY_ID:-}" && -n "${B2_APPLICATION_KEY:-}" ]] || { echo "Faltan B2_KEY_ID / B2_APPLICATION_KEY"; exit 2; }
[[ -n "${1:-}" ]] || { echo "Uso: verificar.sh <ruta/del/archivo/en/el/bucket>"; exit 2; }

export RCLONE_CONFIG_VELUA_TYPE=s3
export RCLONE_CONFIG_VELUA_PROVIDER=Other
export RCLONE_CONFIG_VELUA_ACCESS_KEY_ID="$B2_KEY_ID"
export RCLONE_CONFIG_VELUA_SECRET_ACCESS_KEY="$B2_APPLICATION_KEY"
export RCLONE_CONFIG_VELUA_ENDPOINT="${B2_ENDPOINT:-https://s3.us-east-005.backblazeb2.com}"
export RCLONE_CONFIG_VELUA_REGION="${B2_REGION:-us-east-005}"
export RCLONE_CONFIG_VELUA_NO_CHECK_BUCKET=true
export RCLONE_CONFIG_VELUA_NO_HEAD_OBJECT=true

BUCKET="${B2_BUCKET:-velua-backups-rc2026}"
OBJ="velua:$BUCKET/$1"
OPC=(--retries 1 --low-level-retries 1 -q)
fallos=0

echo "== 1) Listar el bucket =="
if rclone lsf "velua:$BUCKET/" "${OPC[@]}"; then echo "!! PELIGRO: pudo listar"; fallos=$((fallos+1)); else echo "OK: listar denegado"; fi

echo "== 2) Leer un backup =="
if rclone cat "$OBJ" "${OPC[@]}" > /dev/null; then echo "!! PELIGRO: pudo leer"; fallos=$((fallos+1)); else echo "OK: leer denegado"; fi

echo "== 3) Borrar un backup =="
if rclone deletefile "$OBJ" "${OPC[@]}"; then
  echo "AVISO: el borrado respondió OK."
  echo "  En B2, borrar sin versión solo OCULTA el archivo (hide marker); el Object Lock impide eliminar la versión."
  echo "  Verificar en la web de Backblaze (Browse Files -> mostrar versiones) que la versión sigue existiendo."
else
  echo "OK: borrar denegado"
fi

echo "== Resultado: $fallos problema(s) =="
exit "$fallos"