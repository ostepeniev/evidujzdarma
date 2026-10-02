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

## 2. Домен evidujzdarma.cz (Webglobe) і DNS

Домен зареєстровано через Webglobe. DNS залишаємо в Webglobe: окремий DNS-провайдер на старті не потрібен. У застосунку домен уже прописаний: `DOMAIN=evidujzdarma.cz` у `infra/.env.production.example` і `SITE.domain` у `apps/web/src/lib/site.ts`.

**Перед перемиканням (за добу):** в адмініструванні Webglobe відкрийте Domény → evidujzdarma.cz → DNS záznamy і знизьте TTL наявних записів до 300 с. Тоді зміни застосуються за хвилини, а не за години.

**Записи в DNS Webglobe:**

| Тип | Ім'я (host) | Значення | Примітка |
| --- | --- | --- | --- |
| A | `@` (evidujzdarma.cz) | IPv4 сервера Hetzner | старий A-запис паркування Webglobe видаліть |
| AAAA | `@` | IPv6 сервера Hetzner | якщо є запис паркування — видаліть |
| CNAME | `www` | `evidujzdarma.cz.` | якщо Webglobe не дозволить CNAME, додайте A/AAAA `www` на ті самі IP |
| CAA | `@` | `0 issue "letsencrypt.org"` і `0 issue "sectigo.com"` | необов'язково; Caddy бере сертифікат у Let's Encrypt, резерв — ZeroSSL (Sectigo) |
| MX | `@` | за поштовим провайдером (див. нижче) | для отримання листів на ahoj@ / admin@ |
| TXT | `@` | один SPF: `v=spf1 include:<поштовий хостинг> include:<SMTP-провайдер> ~all` | **лише один** SPF-запис, усі include в ньому |
| CNAME / TXT | за інструкцією SMTP-провайдера | DKIM-ключі | без DKIM листи з кодом входу потраплятимуть у спам |
| TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:admin@evidujzdarma.cz` | через 2–4 тижні без проблем змініть на `p=quarantine` |
| TXT | `@` | коди підтвердження Google Search Console, Bing, Seznam | додайте під час реєстрації в цих сервісах (розділ 7) |

**Пошта.** Застосунок пише з `ahoj@evidujzdarma.cz` (`MAIL_FROM`, `SITE.email`), а Let's Encrypt надсилає листи на `admin@evidujzdarma.cz` (`ACME_EMAIL`). Потрібні дві речі:

1. **Скринька для вхідних** (відповіді клієнтів, GDPR-námitky, алерти монітора EET). Найпростіше взяти пошту у Webglobe до домену: тоді MX і SPF вони налаштують самі. Альтернатива — Seznam Email Profi.
2. **SMTP для транзакційних листів** (вхід, чеки, план EET). Беріть провайдера з серверами в ЄС, наприклад Brevo, Postmark (EU), Ecomail або AWS SES eu-central-1. Після верифікації домену у провайдера додайте його DKIM-записи і include у SPF, а `SMTP_URL` впишіть у `infra/.env`.

**DNSSEC.** Увімкніть у Webglobe для домену (для .cz — стандарт CZ.NIC). На роботу Caddy це не впливає.

**Додаткові домени.** `ALT_DOMAINS` у `.env` за замовчуванням порожній. Якщо купите, наприклад, `uctenkazdarma.cz`, вкажіть його A/AAAA на той самий сервер і допишіть у `ALT_DOMAINS=uctenkazdarma.cz www.uctenkazdarma.cz`. Caddy перенаправлятиме його на головний домен. Не вписуйте домени, які вам не належать: Caddy безуспішно запитуватиме для них сертифікати і впреться в ліміти Let's Encrypt.

**Перевірка:**

```bash
dig +short evidujzdarma.cz A
dig +short evidujzdarma.cz AAAA
dig +short www.evidujzdarma.cz
dig +short evidujzdarma.cz TXT
```

Коли A/AAAA вказують на сервер і порти 80/443 відкриті, Caddy сам отримає HTTPS-сертифікати під час першого запиту (`docker compose logs caddy`).

Також перевірте в Webglobe, що **власник домену — провайдер сервісу** (юридична особа, не приватна особа) і що ввімкнено **автоматичне продовження**.

## 3. Застосунок

```bash
su - deploy
git clone https://github.com/ostepeniev/evidujzdarma.git && cd evidujzdarma/infra
cp .env.production.example .env
# згенеруйте секрети:
for k in POSTGRES_PASSWORD APP_SECRET CRON_SECRET MASTER_KEY; do echo "$k=$(openssl rand -base64 32)"; done
nano .env          # вставте секрети, DOMAIN, SMTP_URL, ALERT_EMAIL (дані оператора — у коді, lib/site.ts)
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
