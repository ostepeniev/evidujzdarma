# Рецензія №2 — безпека + зміст/право (R2, R3)

## 1. Що рецензовано, прогони

- **Репозиторій:** `ostepeniev/evidujzdarma`, гілка `claude/pensive-mayer-wcam12`.
- **Коміт:** `c6f5b440ebc86e67f98b2c074fe0961eacefc18c` (HEAD гілки; новіших немає — `git fetch` дав той самий `c6f5b44`).
- **Спосіб:** читання коду (file:line), `pnpm -r test`, `pnpm audit --prod`, точкові перевірки резолву `node-forge` і структури p12. `next build`/`next start`/живий Postgres не запускав (не потрібні — гейти покриті PGlite-інтеграціями в репо).

**Тести — `corepack enable && pnpm install --frozen-lockfile && pnpm -r test`:**

| Пакет | Результат |
|---|---|
| `packages/cz` | 29/29 ✅ |
| `packages/fiscal-core` | 53/53 ✅ (зокрема `p12-dos.test.ts`) |
| `apps/web` | 162/162 ✅ (36 файлів; інтеграції на PGlite, БД не потрібна) |
| `apps/worker` | немає скрипта `test` (пропущено) |
| **Разом** | **244/244 зелені**, EXIT 0 |

Пропущено лише `it.skipIf(!hasRealAge)` у `r3-12-backup-secrets.test.ts` (без бінарника `age`).

**`pnpm audit --prod`:** **1 вразливість (1 high)** — `node-forge ≤1.4.0` (GHSA-86w9-cpqp-85rv, PKCS#1 v1.5). Виправленої версії немає (1.4.0 остання). У коді вразлива функція не викликається: підписи й ланцюжок — через `node:crypto`, forge лише парсить PKCS#12; є tripwire-тест. Прийнятно, у `LATER`. 13 вразливостей `nodemailer` закрито оновленням до 10.0.13.

---

## 2. Статуси R2.x і R3.x

Усі посилання — на `apps/web/src/…`, якщо не вказано інше.

### Блок R2 (лендинг, тексти, право)

| Пункт | Стан | Докази (file:line) | Коментар |
|---|---|---|---|
| R2.1 дата обов'язку | ✅ | `content/facts.ts:168,198,236-239`; `components/timeline.tsx:1,4,8`; гейт `test/content-dates.test.ts:12-55` | `EFFECTIVE_DATE="2027-01-01"`, лічильник «do povinné evidence (1. 1. 2027)»; січень = «pilotní režim», без «dobrovolný/nanečisto/zkušební/bez sankcí» (гейт ±160 знаків зелений). Джерело FS dotaz č. 4968 у `FACTS.pilot.sources` і TIMELINE 1.1 та 1.2. |
| R2.2 FAQ QR-платба | ✅ | `app/(site)/qr-platba/page.tsx:19,35,56` | «Ano, …eviduje stejně jako hotovost»; рядок «Zdroje». |
| R2.3 порівняння MOJE eet | ✅ | `content/comparison.ts:8,10-13`; hero `app/(site)/page.tsx`; гейт `test/content-claims.test.ts` | неперевірене → «Nezveřejněno»; «Jednodušší než státní aplikace» у `src` немає (grep порожній, і OG теж). |
| R2.4 дані оператора §435 | ✅ | `lib/site.ts:18-31` (`OPERATOR`, `operatorLine()`); `test/operator.test.ts` | IČO 22269134, DIČ CZ22269134, Chebská 38/5, Dvory, 360 06 Karlovy Vary, KS v Plzni odd. C vl. 47634 — захардкоджено (не env), у футері/`o-nas`/`podminky`/zásadách/листах. |
| R2.5 юр. тексти = код | ✅ | `ochrana-osobnich-udaju/page.tsx:153-154,268-269`; `podminky/page.tsx:219,224,259,352-353`; `o-nas/page.tsx:145`; `lib/server/lifecycle.ts`; гейт `test/integration/r2-5-legal.test.ts` | Неправдиві фрази прибрано: тепер «privátní klíče certifikátů šifrovaně», «heslo neukládáme», «data na serverech v EU» (без обіцянки шифрування диска). `terms_version`/`terms_accepted_at`, čl. 28 doložka, `removeCertificate`/`unlinkAccountant`/`closeAccount`, `runRetention`. |
| R2.6 маркетинг лише з DOI | ✅ | `lib/server/mail.ts:7-20,87-91`; `api/preregistrace/route.ts` (більше не ставить `dis-launch` одразу); міграція `0010`; гейт `test/integration/r2-6-marketing.test.ts` | `blockedReason()` перевіряє `confirmed_at` + `marketing_consent` + не `unsubscribed_at` **у момент відправки**; obchodní sdělení + ідентифікація оператора; реферал прибрано з транзакційного листа. |
| R2.7 GET не змінює стан | ✅ | `api/odhlasit/route.ts:34-51`; `api/registrace/potvrdit/route.ts`; `registrace/potvrzeni/page.tsx` | GET → сторінка з кнопкою; POST відписує (one-click → 204); підтвердження лише POST. |
| R2.8 EET OFF / обережні формулювання | ✅ | `components/tools/eet-off-calculator.tsx`, `quiz.tsx`; `content/facts.ts` (§10 ZDP, `startDeadline`); гейт `test/r2-8-tools.test.ts` | «pravděpodobně», дисклеймер у картці результату, «ostatní (příležitostné) příjmy podle § 10 ZDP», тести межі 1 000 000 і tie. |
| R2.9 llms лише індексовані + 0 404 | ✅ | `lib/llms.ts:10` (`GUIDES.filter(isIndexable)`); гейт `test/internal-links.test.ts` | жоден нерецензований гайд у llms (зараз розділ порожній). **Примітка:** MCP `eet_search_guides` досі віддає нерецензовані гайди — це R4/Ф9, поза R2.9 (див. нові знахідки). |
| R2.10 «připravujeme» | ✅ | `content/comparison.ts:5,10-13`; `content/pricing.ts`; гейт `test/r2-10-features.test.ts` | SMS/PDF/USB-принтер/чтечка/експорт Pohoda-Money/термінал позначено «připravujeme». |

### Блок R3 (безпека до відкриття реєстрації)

| Пункт | Стан | Докази (file:line) | Коментар |
|---|---|---|---|
| R3.1 DoS через .p12 | ✅ | `packages/fiscal-core/src/p12.ts:104-241`; `api/ucet/certifikat/route.ts:13-28`; гейт `test/p12-dos.test.ts` | `inspectP12` пре-скан ітерацій (≤200k/оп, ≤1M разом, ≤16 оп, ≤50k вузлів/гл.24) **до** дешифрування; парсинг у `worker_threads` з таймаутом 5 с і `terminate()`; `Content-Length` 411/413 **до** `formData()`; 5 імпортів/год на акаунт. Фолбек у головний потік — **лише після** пре-скану (ітерації вже обмежені), тож DoS-безпечний. «перевірити»: чи резолвиться `node-forge` воркером у Next standalone (інакше завжди фолбек без таймаут-ізоляції). |
| R3.2 ліміти тіла | ⚠️ | `infra/Caddyfile:9-15` | У Caddyfile є (128 КБ для `/api/ucet/certifikat`, 1 МБ інше). **АЛЕ прод = nginx (Т7), а конфіг nginx у репо відсутній** — у коді ліміт тіла реально стоїть лише на маршруті сертифіката. Див. розділ 3 і нову знахідку. |
| R3.3 заповнення диска ISR | ✅ | `firma/[slug]/page.tsx:21`; `provozovna/[slug]/page.tsx:15`; `components/catalog/paths.ts:46-53`; `lib/server/firm-page.ts:14-30`; гейт `test/r3-3-isr.test.ts` | `dynamic="force-dynamic"` (на диск не пишеться); `slugDecision` → 404 на довільний суфікс, редирект лише з порожнього; live-фірми поза БД `rateLimit('firm-live:<ip>',30/год)`, дедуп у межах запиту. |
| R3.4 кабінет бухгалтера (IDOR) | ✅ | `lib/server/cabinet.ts:135-204`; гейт `test/integration/r3-4-cabinet.test.ts` | `acceptInvite` вимагає `account.ico === invite.ico` (інакше 403); токен у БД лише `sha256`, TTL 14 днів (`gt(inviteExpiresAt,now)`); токен згорає; лист власникам про нове з'єднання; `unlinkAccountant` (DELETE `/api/ucet/ucetni/[id]`). |
| R3.5 námitka | ✅ | `api/namitka/route.ts:46-84`; `lib/server/objections.ts:14-75`; гейт `test/integration/r3-5-objection.test.ts` | OSVČ → noindex одразу; юрособа → noindex лише після DOI (`confirmObjection`, POST); токен хешований; оператору денний дайджест (dedupe за днем), не лист на кожен запит. |
| R3.6 логи/fail-closed/env | ✅ | `lib/server/log.ts:5-16`; `lib/server/auth.ts:166-169`; `lib/server/mail.ts:104-109`; `lib/server/env-check.ts`; `src/instrumentation.ts`; `infra/docker-compose.yml:36-40` | `safeError` ріже `params:`, маскує token/secret/password/key і рядки ≥32 зн.; у проді без SMTP лист лишається в черзі (вміст не логується); `checkProductionEnv` валить старт без DATABASE_URL/SMTP_URL/MASTER_KEY(файл)/CRON_SECRET/APP_SECRET; `x-logging` 5×10 МБ. **`/api/internal/*` захищений `CRON_SECRET` у самому застосунку** (`api/internal/cron/route.ts:18-20`, `indexnow/route.ts:7-8`, `safeEqual`/timing-safe) — не лише проксі-404. |
| R3.7 magic link | ✅ | `api/auth/callback/route.ts:8-33`; `api/auth/login/route.ts:52-64`; `lib/server/auth.ts` (`consumeLoginToken`, `requireFreshLogin`); гейт `test/integration/r3-7-magic-link.test.ts` | GET лише редіректить (токен не споживається); POST споживає токен **разом з nonce** з `__Host-ez_login`; свіжий вхід ≤15 хв для сертифіката/production/закриття акаунта. |
| R3.8 чеки e-mailem | ✅ | `api/pokladna/uctenka/route.ts:14-57`; гейт `test/integration/r3-8-receipt-mail.test.ts` | mock/playground — лише власнику; третім особам лише в production з сертифікатом, `eic == account.eic`; ліміти 60/год акаунт, 5/добу адресат, 2000/год глобально; URL у чеку defang; рядок «Nahlásit zneužití». |
| R3.9 nonce-CSP + frame-ancestors | ✅ | `src/proxy.ts:8-62`; `next.config.ts:42-43`; гейт `test/r3-9-csp.test.ts` | строга CSP з nonce, без `'unsafe-inline'` у `script-src`, `frame-ancestors 'none'` + `X-Frame-Options: DENY` для `/pokladna*`,`/u/*`,`/prihlaseni*`,`/kabinet`,`/pozvanka/*`; глобальна CSP їх виключає. `style-src 'unsafe-inline'` лишено свідомо (React style=), поза вимогою рецензії. |
| R3.10 PIN власника + MAC vratky | ✅ | `api/pokladna/config/route.ts:47`; `lib/server/staff-pin.ts:14-86`; `lib/server/sales.ts:87-105`; гейти `test/integration/r3-10-pin.test.ts` | власнику `pinHash:null, onlinePin:true` (хеш на касу не йде); PIN власника ≥6 цифр, перевірка серверна з експо-затримкою; vratka лише зі схваленням (HMAC, прив'язка акаунт/пристрій/час); **MAC порівнюється як канонічний текст** `safeEqual` (`staff-pin.ts:52`, виправлено malleability у `5c32ad1`); `staffId`/`refundOf`/сума/дубль перевіряє сервер. |
| R3.11 X-Real-IP, IPv6/64, бюджет ARES | ✅ | `lib/server/rate-limit.ts:34-52`; `lib/server/ares.ts:15-47`; `kontrola-ico/page.tsx:53`; гейт `test/r3-11-ip-ares.test.ts` | IP лише з `x-real-ip` (XFF ігнорується), IPv6 за /64, IPv4-mapped розгортається; пули ARES interactive 120/bulk 60/catalog 30/mcp 30; `/kontrola-ico` 30/хв на IP. ⚠ дрібне: кеш `memory` у гілці з БД не обрізається (нова знахідка); коментар каже «nastavuje Caddy» (Т7 просив узагальнити). |
| R3.12 бекапи/MASTER_KEY/роль БД | ✅ | `infra/backup.sh`; `packages/db/src/roles.ts:13-78`; `migrate.ts:17-26`; `lib/server/env-check.ts:22-41`; гейти `test/r3-12-backup-secrets.test.ts`, `test/integration/r3-12-db-role.test.ts` | `pg_dump | age -r` (без отримувача не стартує; приватний ключ поза сервером; перевірка заголовка age; prune лише після успіху); `MASTER_KEY` у проді лише файл, перевірка прав `mode & 0o077 == 0` і 32 байти; роль `evidujzdarma_app` без DDL, `REVOKE CREATE`; пароль як **SCRAM verifier** (не відкритим текстом у SQL/лозі). **SQL-ін'єкція через `APP_DB_PASSWORD` неможлива:** `PASSWORD_RE=^[A-Za-z0-9._~-]{24,128}$` + пароль іде лише в PBKDF2 → verifier, verifier валідується `VERIFIER_RE` і екранується `literal()`. |
| R3.13 nodemailer ≥10 | ✅ | `apps/web/package.json`, `apps/worker/package.json` (`^10.0.13`); гейт `test/r3-13-deps.test.ts`, `test/integration/r3-13-smtp.test.ts` | обидва пакети на 10.0.13; `pnpm audit --prod` без вразливостей nodemailer; лишається тільки `node-forge` (недосяжний шлях, tripwire-тест, LATER). |

---

## 3. Деплой за host nginx замість Caddy (Т7) — що МАЄ зробити vhost

**Головне застереження.** Рішення Т7 (прод за наявним nginx 1.24, 80/443 зайняті) у коді на `c6f5b44` **не має артефактів**: у репо немає `infra/nginx/` і в `docs/deploy.md` немає розділу про nginx (deploy.md описує лише Caddy — DNS CAA для Caddy, автоматичний HTTPS, `docker compose up` із сервісом `caddy`). Усі проксі-рівневі захисти наразі є **тільки** в `infra/Caddyfile`. Якщо власник розгортає за nginx «по тому, що є в репо», він ці правила не скопіює. Тому vhost nginx **обов'язково** має:

1. **Перезаписати `X-Real-IP` справжнім IP і НЕ пропускати клієнтський заголовок:**
   `proxy_set_header X-Real-IP $remote_addr;`
   `proxy_set_header X-Forwarded-For $remote_addr;` (або взагалі не передавати XFF).
   Код читає **лише** `x-real-ip` (`rate-limit.ts:35`). Якщо nginx його не виставить → усі клієнти стають `unknown`, спільне відро → самоблокування реальних користувачів; якщо nginx пропустить клієнтський `X-Real-IP` як є → підробка IP і обхід **усіх** лімітів (login, preregistrace, namitka, firm-live, kontrola-ico). Це реактивує В-1/В-2/Н-1/Н-2.
2. **Ліміти тіла** (R3.2, бо в коді їх немає, крім маршруту сертифіката):
   `client_max_body_size 1m;` глобально і `location = /api/ucet/certifikat { client_max_body_size 128k; … }`.
   Без цього неавтентифіковані `req.json()`/`req.formData()` (login, preregistrace, namitka) приймають великі тіла → ризик OOM на 4 ГБ VM (В-9).
3. **`/api/internal/*` → 404** (захист у глибину). Примітка: у самому застосунку ці маршрути вже закриті `CRON_SECRET` (timing-safe), тож 404 — додатковий, не єдиний бар'єр.
4. **`www` і додаткові домени → 301** на головний домен.
5. Проксі лише на `127.0.0.1:3100` (web слухає локально), `proxy_set_header Host $host;`, `X-Forwarded-Proto https;` щоб `Secure`-cookie й HSTS працювали; `nginx -t` перед reload, чужі vhost-и не чіпати.

Також у коді варто узагальнити коментар `rate-limit.ts:30-31` «nastavuje Caddy ({remote_host})» на «reverse proxy (Caddy nebo nginx)» — просив контролер (відповідь №4).

---

## 4. Нові знахідки (інтродуковані або лишені фіксами)

### Критично
Нових суто-кодових критичних немає. Найвищий ризик — **конфігураційно-деплойний (розділ 3):** при неправильному vhost nginx падають усі IP-ліміти й ліміт тіла. Класифікую як Важливо-деплойне, але це головний пункт перед відкриттям реєстрації.

### Важливо

**Н2-1. Кеш ARES `memory` у гілці з БД росте без межі (залишок В-2).**
- **Де:** `lib/server/ares.ts:63-87`. Обрізання `if (memory.size > 5000) …` стоїть **лише** в гілці без БД (рядок 85). У production (БД є) `memory.set` викликається на рядках 72 і 80, але жодного обрізання немає; записи не видаляються за TTL, лише перезаписуються при повторному запиті того самого ключа.
- **Що стається:** ключі `subject:<ico>`/`rzp:<ico>` накопичуються за кожним унікальним IČO (через `/api/ico`, `/kontrola-ico`, live-`/firma`). ~9 млн валідних IČO × ~1–2 КБ → поступове вичерпання RAM на VM 4 ГБ (повільний OOM). Ліміти на IP уповільнюють, але IPv6 /64 дає багато джерел.
- **Фікс:** LRU/обрізання і в гілці з БД (як на рядку 85), або викидати за TTL під час читання.
- **Гейт (червоний зараз):** викликати `cached()` у режимі з БД для N > ліміту різних ключів і перевірити, що `memory.size` обмежений.

**Н2-2. Застосунковий ліміт тіла лише на маршруті сертифіката; решта — лише на проксі.**
- **Де:** `api/ucet/certifikat/route.ts:13-16` має перевірку `Content-Length` до парсингу; інші (`api/auth/login` `req.json()`, `api/preregistrace`, `api/namitka`, `api/pokladna/*`) покладаються на ліміт проксі.
- **Що стається:** за nginx без `client_max_body_size` (розділ 3) великі тіла доходять до Next і буферизуються → RSS росте, на 4 ГБ VM можливий OOM кількома паралельними запитами (В-9 у коді лишилася відкритою; закрита лише інфраструктурою).
- **Фікс:** або гарантувати `client_max_body_size` у vhost (мінімум), або додати спільну перевірку `Content-Length` у `proxy.ts`/хелпері для не-GET.
- **Гейт (червоний зараз):** POST 5 МБ тіла на `/api/auth/login` → очікувати 413 до читання тіла.

### Дрібне

**Н2-3. Фолбек p12 у головному потоці не перевірено на Next standalone.** `parseP12Safe` (`p12.ts:217-219,237-238`) парсить у головному потоці, якщо `forgeModulePath()` поверне `null` або воркер не завантажить `node-forge`. Фолбек **безпечний** (ітерації вже обмежені пре-сканом), але втрачає таймаут-ізоляцію воркера. У dev резолв працює; у standalone-бандлі Next не перевірено живим імпортом. **перевірити** після деплою, що імпорт сертифіката йде через воркер (лог/метрика), інакше кожен імпорт — у головному потоці.

**Н2-4. Коментар про Caddy в `rate-limit.ts:30-31`** суперечить Т7 (прод = nginx). Лише документація, поведінка коректна.

**Н2-5. `node-forge ≤1.4.0` high (GHSA-86w9-cpqp-85rv)** лишається в `pnpm audit --prod`. Виправленої версії немає; вразлива функція не викликається (підписи через `node:crypto`), є tripwire-тест. Прийнятно, тримати в `LATER`, оновити коли вийде патч.

**Н2-6. MCP `eet_search_guides` віддає нерецензовані гайди** (`api/mcp/route.ts` без фільтра `isIndexable`) — суперечить Ф9. Поза R2.9 (той лише про llms.txt); контролер залишив на R4. Нагадування, не регрес R2/R3.

---

## Висновок
Усі 10 пунктів R2 і 13 пунктів R3 закриті в коді так, як вимагалося; 244/244 тести зелені; аудит чистий, крім недосяжного `node-forge`. Головний ризик — не код, а **деплой за nginx без обов'язкового vhost** (X-Real-IP + ліміт тіла): без нього реактивуються В-1/В-2/В-9. Плюс дві відкриті дрібниці продуктивності/памʼяті (ARES-кеш, застосунковий ліміт тіла).
