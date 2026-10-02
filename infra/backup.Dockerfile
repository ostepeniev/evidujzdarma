# Záloha: pg_dump + age (šifrování veřejným klíčem, R3.12). Kontext buildu je jen backup.sh
# (backup.Dockerfile.dockerignore) – .env ani secrets/ se do buildu neposílají.
FROM postgres:16-alpine
RUN apk add --no-cache age
COPY backup.sh /backup.sh
ENTRYPOINT ["/bin/sh", "/backup.sh"]
