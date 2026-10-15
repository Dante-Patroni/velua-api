# Backup diario de Velua: mysqldump -> gzip -> age -> Backblaze B2 (rclone).
# Imágenes fijadas por digest. Para actualizar: cambiar tag y digest en un PR.

# 1) age compilado desde el código fuente; Go verifica el módulo contra sum.golang.org
FROM golang:1.27.2-alpine@sha256:f92b6ef800e499660581efdabdf25d9d817a9d124eaf900924f0504e7e27e12d AS age
RUN CGO_ENABLED=0 go install -trimpath filippo.io/age/cmd/age@v1.3.2

# 2) rclone: binario estático oficial
FROM rclone/rclone:1.75.2@sha256:2687085f718d3c628f7fdfb77c52a1d344332aed543110bb88088f2c70d43eb5 AS rclone

# 3) Imagen final: misma versión de MySQL que producción, para que mysqldump sea compatible
FROM mysql:9.7.2@sha256:c7cb87a9822f499375287930cbff71d6d3b201e346b45108b1115b435ee2df13
COPY --from=age /go/bin/age /usr/local/bin/age
COPY --from=rclone /usr/local/bin/rclone /usr/local/bin/rclone
COPY backup.sh /usr/local/bin/backup.sh
RUN chmod 0755 /usr/local/bin/backup.sh

# No correr como root: el usuario mysql ya existe en la imagen
USER mysql

# Reemplaza el entrypoint original, que arrancaría un servidor MySQL
ENTRYPOINT ["/usr/local/bin/backup.sh"]