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

**На своєму комп'ютері (не на сервері)** створіть ключ для бекапів. Знадобиться програма [age](https://github.com/FiloSottile/age) (`brew install age`, `apt install age`):

```bash
age-keygen -o evidujzdarma-backup.key
# виведе "Public key: age1…" — це значення для BACKUP_AGE_RECIPIENT
```

Файл `evidujzdarma-backup.key` — це **приватний** ключ. На сервер його не копіюйте. Збережіть у менеджері паролів і ще в одному місці офлайн: без нього бекап не відновити.

**На сервері:**

```bash
su - deploy
git clone https://github.com/ostepeniev/evidujzdarma.git && cd evidujzdarma/infra
cp .env.production.example .env
# паролі БД стоять у DATABASE_URL, тому лише hex (у base64 буває «/», і URL ламається):
for k in POSTGRES_PASSWORD APP_DB_PASSWORD; do echo "$k=$(openssl rand -hex 32)"; done
for k in APP_SECRET CRON_SECRET; do echo "$k=$(openssl rand -base64 32)"; done
nano .env          # вставте секрети, DOMAIN, SMTP_URL, ALERT_EMAIL, BACKUP_AGE_RECIPIENT=age1…
exit               # назад до root
```

`MASTER_KEY` лежить не в `.env`, а в окремому файлі. Його може прочитати лише користувач застосунку в контейнері (uid 1001). Від root:

```bash
cd /home/deploy/evidujzdarma/infra
mkdir -p secrets && chmod 700 secrets
openssl rand -base64 32 > secrets/master_key   # або вставте наявний MASTER_KEY
chown 1001:1001 secrets/master_key && chmod 0400 secrets/master_key
cat secrets/master_key                          # перепишіть у менеджер паролів
su - deploy -c 'cd evidujzdarma/infra && docker compose up -d --build && docker compose logs -f web worker'
```

> **MASTER_KEY** збережіть окремо, у менеджері паролів. Ним зашифровані приватні ключі касових сертифікатів. Без нього їх не відновити, і в бекапах його немає (так задумано). Якщо `MASTER_KEY` лишиться в `.env` або файл буде з правами ширшими за 0400, сервер не стартує й напише причину.
>
> `web` і `worker` підключаються до БД роллю `evidujzdarma_app`. Вона може читати й писати рядки, але не може змінювати схему. Роль створює сервіс `migrate` з `APP_DB_PASSWORD`.

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

**Оновлення зі старішої версії, де `MASTER_KEY` був у `.env` (R3.12).** Без цих кроків `docker compose up` не стартує й напише, чого бракує:

1. Згенеруйте ключ для бекапів на своєму комп'ютері (розділ 3) і впишіть `BACKUP_AGE_RECIPIENT=age1…` у `.env`.
2. Допишіть у `.env` рядок `APP_DB_PASSWORD=` зі значенням з `openssl rand -hex 32`.
3. Перенесіть `MASTER_KEY` з `.env` у файл (від root; ключ той самий, сертифікати розшифровуються, як і раніше):

```bash
cd /home/deploy/evidujzdarma/infra && mkdir -p secrets && chmod 700 secrets
grep '^MASTER_KEY=' .env | cut -d= -f2- > secrets/master_key
chown 1001:1001 secrets/master_key && chmod 0400 secrets/master_key
sed -i '/^MASTER_KEY=/d' .env
```

4. `docker compose up -d --build`, потім `docker compose logs migrate web backup`. У логах мають бути рядки `runtime role evidujzdarma_app` і `[backup] OK …dump.age`.

## 6. Бекапи

- Сервіс `backup` щодня робить `pg_dump`, одразу шифрує його програмою `age` **публічним** ключем із `BACKUP_AGE_RECIPIENT` і пише в `infra/backups/evidujzdarma-ДАТА-ЧАС.dump.age` (права 0600). Незашифрований дамп на диск не потрапляє. Без `BACKUP_AGE_RECIPIENT` сервіс не стартує.
- Приватний ключ є лише у вас, тому ні сервер, ні офсайт-копія без нього бекап не прочитають. Можна вказати кілька публічних ключів через кому, наприклад ваш і резервний.
- Старі копії видаляються через `BACKUP_KEEP_DAYS` (14) днів, але лише після успішного нового бекапу. Якщо бекапи кілька днів поспіль падають, старі копії лишаються.
- Ручний бекап: `docker compose run --rm -e BACKUP_ONCE=1 backup`.
- Офсайт: синхронізуйте `infra/backups/` у Hetzner Storage Box, наприклад так:

```bash
# одноразово: restic init, потім через cron щоночі
restic -r sftp:uXXXX@uXXXX.your-storagebox.de:/evidujzdarma backup ~/evidujzdarma/infra/backups
```

- Відновлення. Розшифровуйте на своєму комп'ютері з приватним ключем, приватний ключ на сервер не копіюйте:

```bash
# на своєму комп'ютері: розшифрувати
age -d -i evidujzdarma-backup.key evidujzdarma-YYYYMMDD-HHMMSS.dump.age > restore.dump
# перенести restore.dump на сервер (scp) і відновити
docker compose exec -T postgres pg_restore -U evidujzdarma -d evidujzdarma --clean --if-exists < restore.dump
shred -u restore.dump   # розшифрований дамп не залишайте ні на сервері, ні в себе
docker compose run --rm migrate   # відновить права ролі evidujzdarma_app
```

- **Перевірка раз на квартал:** розшифруйте свіжий бекап і відновіть його в тестову БД (`createdb restore_check`, потім `pg_restore -d restore_check --no-owner`). Бекап, який ніхто не відновлював, — не бекап.
- **Старі нешифровані бекапи** (`*.dump`, зроблені до R3.12) видаляються за тим самим строком. Поки вони є, сервіс пише попередження в лог. Щойно ви успішно відновите шифрований бекап, видаліть їх одразу (`rm infra/backups/*.dump`) і так само в офсайт-сховищі.

## 7. Після запуску (SEO / GEO)

- [ ] Google Search Console і **Bing Webmaster Tools** (ChatGPT-пошук спирається на індекс Bing): додайте `sitemap.xml`.
- [ ] Seznam Webmaster (seznam.cz — важливий пошук у ЧР).
- [ ] Перевірте, що `robots.txt` дозволяє GPTBot, ClaudeBot, PerplexityBot, Google-Extended.
- [ ] Каталог: `CATALOG_INDEX_REGIONS=51`. Почніть з KV-краю, потім поступово додавайте краї.
- [ ] Гайди: після рецензії daňovým poradcem заповніть `reviewedBy` у файлі гайду. Тоді гайд індексується.

## 8. Наш прод: наявний сервер з nginx (Т7)

EvidujZdarma працює на сервері власника `46.225.132.220` (Ubuntu 24.04, 2 vCPU, 4 ГБ RAM). Там уже є інші застосунки за nginx 1.24, тож порти 80/443 зайняті. Тому Caddy не запускаємо, а беремо `infra/docker-compose.nginx.yml` і vhost `infra/nginx/evidujzdarma.conf`. Чужі vhost-и не змінюємо, перед кожним reload — `nginx -t`.

| Що | Де на сервері |
| --- | --- |
| Репозиторій (клон по HTTPS, лише читання) | `/opt/evidujzdarma` |
| Секрети | `/opt/evidujzdarma/infra/.env` (0600), `/opt/evidujzdarma/infra/secrets/master_key` (0400, uid 1001) |
| Бекапи (лише `*.dump.age`) | `/opt/evidujzdarma/infra/backups` |
| vhost | `/etc/nginx/sites-available/evidujzdarma.cz` → `sites-enabled` |
| Basic auth | `/etc/nginx/evidujzdarma.htpasswd` |
| Web | `127.0.0.1:3100` |

**Збирання.** Пам'яті на сервері мало, а поруч працюють інші застосунки. Тому образи збираємо окремим builder-ом з лімітом пам'яті: якщо збирання не вміститься, впаде лише воно. Потім builder видаляємо, щоб кеш не їв диск:

```bash
cd /opt/evidujzdarma && git pull --ff-only
docker buildx create --name ezbuild --driver docker-container \
  --driver-opt memory=1500m --driver-opt memory-swap=3000m --driver-opt cpu-quota=150000
for t in web worker migrate; do
  docker buildx build --builder ezbuild --load --target $t \
    --build-arg NEXT_PUBLIC_SITE_URL=https://evidujzdarma.cz -t evidujzdarma-$t:latest .
done
docker buildx build --builder ezbuild --load -f infra/backup.Dockerfile -t evidujzdarma-backup:latest infra
docker buildx rm ezbuild
cd infra && docker compose -f docker-compose.yml -f docker-compose.nginx.yml up -d --no-build
```

**HTTPS.** Сертифікат — через webroot, щоб certbot не переписував конфіг:

1. Поки сертифіката немає, вмикаємо лише перший `server` (порт 80).
2. Запускаємо `certbot certonly --webroot -w /var/www/certbot -d evidujzdarma.cz -d www.evidujzdarma.cz`.
3. Ставимо повний файл, `nginx -t`, `systemctl reload nginx`.

Продовження робить системний таймер certbot.

**Секрети на проді.** Усі робочі секрети лежать в одному місці: `infra/.env` (0600) і `infra/secrets/master_key` (0400). Новий секрет додає власник однією командою: значення вводиться в приховане поле і йде прямо в `.env`, без файлів і без чату. Після запису web і worker перезапускаються. Попередня версія лишається в `.env.bak`.

```bash
ssh -t root@46.225.132.220 ez-secret brevo        # ключ Brevo SMTP → SMTP_URL
ssh -t root@46.225.132.220 ez-secret ALERT_EMAIL  # будь-яка змінна з .env
```

Окремі копії поза сервером потрібні лише для двох ключів, які не можна згенерувати знову: `MASTER_KEY` і приватного ключа бекапів age. Їх зберігають у менеджері паролів власника і на папері. Решту (SMTP, паролі БД, basic auth) при втраті просто створюють заново.

**Поки немає SMTP.** Production не стартує без `SMTP_URL` (Б2). До вибору провайдера в `.env` стоїть заглушка `smtp://127.0.0.1:25`: листи не відправляються, лишаються в черзі з повторами, у лог не потрапляють. Сайт до того закритий basic auth (відкритий лише `/api/health`), бо без пошти не працює вхід. Коли буде SMTP:

1. Впишіть справжній `SMTP_URL` і `docker compose … up -d`.
2. Додайте DKIM і SPF провайдера в DNS.
3. Видаліть два рядки `auth_basic*` з vhost, `nginx -t`, reload.

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
