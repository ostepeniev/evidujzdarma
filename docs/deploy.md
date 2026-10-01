# Деплой на Hetzner (або будь-який VPS у ЄС)

Займає близько 30 хвилин. Потрібні домен, сервер і SMTP.

## 1. Сервер

1. Hetzner Cloud: створіть проєкт і сервер.
   - Тип **CCX13** або **CPX31**.
   - Образ Ubuntu 24.04, локація Falkenstein або Nürnberg.
   - Додайте свій SSH-ключ. Увімкніть Backups (+20 %) як додатковий захист.
2. Firewall (Hetzner Cloud Firewall): вхідні TCP 22, 80, 443 і UDP 443. Решту закрийте.
3. Встановіть Docker:

```bash
ssh root@SERVER_IP
curl -fsSL https://get.docker.com | sh
apt-get install -y git
adduser --disabled-password deploy && usermod -aG docker deploy
```

## 2. Домен і DNS

У реєстратора (наприклад, через CZ.NIC-реєстратора) створіть записи:

| Тип | Ім'я | Значення |
| --- | --- | --- |
| A | `@` | IPv4 сервера |
| AAAA | `@` | IPv6 сервера |
| CNAME | `www` | `evidujzdarma.cz.` |
| A / CNAME | `uctenkazdarma.cz`, `www.uctenkazdarma.cz` | той самий сервер (перенаправлення) |
| TXT (SPF), CNAME (DKIM), TXT `_dmarc` | — | за інструкцією SMTP-провайдера |

HTTPS-сертифікати Caddy отримає автоматично (Let's Encrypt), щойно DNS почне вказувати на сервер.

## 3. Застосунок

```bash
su - deploy
git clone https://github.com/ostepeniev/evidujzdarma.git && cd evidujzdarma/infra
cp .env.production.example .env
# згенеруйте секрети:
for k in POSTGRES_PASSWORD APP_SECRET CRON_SECRET MASTER_KEY; do echo "$k=$(openssl rand -base64 32)"; done
nano .env          # вставте секрети, DOMAIN, SMTP_URL, OPERATOR_ICO, OPERATOR_ADDRESS
docker compose up -d --build
docker compose logs -f web worker
```

> **MASTER_KEY** збережіть окремо, у менеджері паролів. Ним зашифровані приватні ключі касових сертифікатів. Без нього їх не відновити, і в бекапах його немає (так задумано).

Перевірка:

- `https://evidujzdarma.cz/api/health` → `{"ok":true}`;
- `https://evidujzdarma.cz/robots.txt`;
- `https://evidujzdarma.cz/llms.txt`.

## 4. Мережа до Finanční správy

Сервер має мати вихід на HTTPS (443) до:

- `pg.trzbyeet.gov.cz` — Playground;
- `trzbyeet.gov.cz` — продакшн.

## 5. Оновлення

```bash
cd ~/evidujzdarma && git pull && cd infra && docker compose up -d --build
```

Міграції БД застосовуються автоматично: сервіс `migrate` запускається перед `web`.

## 6. Бекапи

- Сервіс `backup` щодня робить `pg_dump` у `infra/backups/` і зберігає копії за 14 днів.
- Офсайт: синхронізуйте `infra/backups/` у Hetzner Storage Box, наприклад так:

```bash
# одноразово: restic init, потім через cron щоночі
restic -r sftp:uXXXX@uXXXX.your-storagebox.de:/evidujzdarma backup ~/evidujzdarma/infra/backups
```

- Відновлення:

```bash
docker compose exec -T postgres pg_restore -U evidujzdarma -d evidujzdarma --clean < backups/evidujzdarma-YYYYMMDD-HHMM.dump
```

## 7. Після запуску (SEO / GEO)

- [ ] Google Search Console і **Bing Webmaster Tools** (ChatGPT-пошук спирається на індекс Bing): додайте `sitemap.xml`.
- [ ] Seznam Webmaster (seznam.cz — важливий пошук у ЧР).
- [ ] Перевірте, що `robots.txt` дозволяє GPTBot, ClaudeBot, PerplexityBot, Google-Extended.
- [ ] Каталог: `CATALOG_INDEX_REGIONS=51`. Почніть з KV-краю, потім поступово додавайте краї.
- [ ] Гайди: після рецензії daňovým poradcem заповніть `reviewedBy` у файлі гайду. Тоді гайд індексується.

## Локальна розробка

```bash
pnpm install
# Postgres: docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=pg postgres:16-alpine
cp .env.example apps/web/.env.local   # DATABASE_URL, MASTER_KEY, APP_SECRET, CRON_SECRET, ARES_MOCK=1
pnpm db:migrate
pnpm dev                                # http://localhost:3000
pnpm test                               # усі unit-тести
pnpm --filter @ez/worker catalog:seed   # демо-дані каталогу
```

Без `SMTP_URL` листи виводяться в консоль (dev). `ARES_MOCK=1` використовує тестові IČO: 12345679, 11111119, 22222227.
