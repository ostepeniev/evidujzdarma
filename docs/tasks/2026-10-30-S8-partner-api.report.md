# Звіт кодової сесії: S8 — EET API pro partnery, v1

Гілка `claude/pensive-mayer-wcam12`. Задача — `docs/tasks/2026-10-30-S8-partner-api.md` (коміт `179008b`).

Загальне для всіх комітів:
- `/api/pokladna/*` і PWA (`src/app/(app)/pokladna/*`, `src/components/pos/*`, `src/lib/pos/*`) не змінювались.
- Наявні тести не правились.
- `infra/nginx`, `docs/deploy.md`, `apps/web/AGENTS.md` і прод не чіпав. Деплою не було.

## Що вже є (з коду, правило 1)

**Тржба з каси.** Каса шле тржби на `POST /api/pokladna/sales` (`app/api/pokladna/sales/route.ts`) пакетом до 100.
- **Валідація:** `DeviceSaleSchema` (`lib/server/sales.ts`), далі `ingestSales`.
- **Ідемпотентність** — за `id`: `onConflictDoNothing`, далі `sameSale` порівнює вміст стабільним JSON.
- **Часові межі:** +10 хв / −45 днів. Перевіряються також режим (`MODE_MISMATCH`, R5.1), закритий акаунт (R6.2), одиниця з `fsUnitId`, ліміт суми `MAX_EET_AMOUNT`.
- **Карантин:** усе, що не пройшло, з uuid-`id` іде в `sale_quarantine` (`quarantine.ts`) з листом власнику.
- **Вратки:** схвалення PIN-ом власника, підписане сервером (`verifyApproval`, R3.10/R5.5). Сума всіх вратек перевіряється під `FOR UPDATE` оригіналу (`refundCapacity`, Т11).

**Відправка.** `processSale` (`lib/server/fiscal.ts`) атомарно «забирає» рядок (claim token), бере сертифікат режиму тржби і будує знімок `eetData` один раз. Транспорт `Eet2Transport` (`packages/fiscal-core`) підписує, шле SOAP і перевіряє підпис відповіді; результат пише `applyOutcome`, а кожна спроба — `sale_attempts`. Cron `processPending` дорозсилає чергу з backoff. Маршрут каси шле нові тржби синхронно з бюджетом 8 с.

**Пристрій і токен.** Пристрій — рядок `devices`: `registerId` = id_pokl, `sequencePrefix`, `tokenHash` = sha256. Автентифікація — `authenticateDevice` (`lib/server/auth.ts`). Скасований акаунт лише дочитує й дорозсилає; через 30 днів — 401.

**Що піде в FS.** `evidencedAmounts` (`fiscal-core/sale.ts`): `transfer` і `gift_voucher` не евідуються; рядок `kind: "prepayment"` дає urceno_cerp_zuct; `credit` дає cerp_zuct.

**Ліміт запитів** (`rate-limit.ts`) — у пам'яті процесу. Postgres-лічильника немає.

---

## Коміт 1 — розд. 1–3 і 9

### 1. Коміти

- `a09b345` — ядро EET API v1: міграція 0040, токени інтеграцій, `/api/v1` (account, units, sales, sales/{id}, refund, closings), журнал і облік запитів, ліміт 120/хв, гейти.
- Коміт цього звіту — окремо.

### 2. Було → стало

**Міграція 0040** (`packages/db/migrations/0040_s8_partner_api.sql`, `packages/db/src/schema.ts`):
- Нове поле `devices.kind` (enum `pos | integration`, default `pos`): усі наявні пристрої стають `pos`.
- У `sales` нові поля `integration_id` і `external_ref` (nullable; у наявних тржбах `null`). Індекси:
  - `sales_integration_ref_uq (integration_id, external_ref) where external_ref is not null`;
  - `sales_integration_sold_idx`.
- Нові таблиці — за розд. 1:
  - `integrations`, `api_requests`, `api_usage_daily`;
  - `webhook_endpoints`, `webhook_deliveries`, `partner_apps`, `oauth_codes`.
- Дві таблиці понад розд. 1 (див. «Самостійні рішення»): `api_sale_keys`, `api_rate_windows`.
- Перевірено на базі в стані 0039 з даними: пристрій і тржба до міграції → `kind = 'pos'`, `integration_id = null`, нові таблиці порожні (`test/integration/s8-migration.test.ts`).

**Токен і доступ** (розд. 2):
- **Формат.** `lib/server/integrations.ts`, `newApiToken`: `ezk_test_` / `ezk_live_` + 40 base62 (≈ 238 біт, без зсуву розподілу).
- **Створення** — `createIntegration`:
  - створює пристрій `kind = integration` (`unitId = null`, `registerId` `API-<НАЗВА>`, свій `sequencePrefix`) і рядок `integrations`;
  - зберігає лише sha256 і перші 12 символів; токен повертається один раз.
- **Live.** Live-токен видається лише за режиму production і чинного **перевіреного** production-сертифіката. Інакше — дослівно «Ostré prostředí zapnete, až budete mít produkční certifikát.»
- **Перевірка запиту** — `authenticateIntegration(req, scope)`:
  - Bearer `ezk_…`, `kind = integration`, `revokedAt`, область;
  - скасований акаунт: через 30 днів → 401;
  - `lastUsedAt` оновлюється не частіше разу на хвилину.
- **Каса.** `authenticateDevice` (`lib/server/auth.ts`) тепер відкидає `kind ≠ pos`: токен інтеграції на `/api/pokladna/*` → 401.
- **Середовище** задає токен (`modeOf`): test → `playground`, live → `production`. `mode` у тілі ігнорується.
- **Ізоляція:** чужа одиниця або одиниця поза `unitIds` → 404 `unit_not_found`; чужа тржба → 404 `sale_not_found`.
- **Ліміт** — Postgres, фіксоване хвилинне вікно (`api_rate_windows`, атомарний upsert): 120/хв, далі 429 `rate_limited` з `Retry-After` і `RateLimit-Limit/Remaining/Reset`.
- **Розміри:** тіло > 1 МБ → 413; > 100 тржб → 400.
- **Обгортка маршрутів** (`lib/server/api/http.ts`, `apiRoute`):
  - кожна відповідь має `X-Request-Id`, той самий id пишеться в `api_requests` разом із шаблоном маршруту (`/v1/sales/{id}`), статусом, тривалістю й кодом помилки;
  - `api_usage_daily.requests` зростає з кожним запитом.
- **Відкликання** — `revokeIntegration`: наступний запит → 401 `token_revoked`, прийняті тржби дорозсилає cron.
- **Retention:** `runRetention` (`lib/server/lifecycle.ts`) видаляє `api_requests` старші 30 днів і вікна ліміту старші години.

**REST `/api/v1`** (розд. 3). Маршрути лежать у `src/app/api/v1/…`, логіка — у `lib/server/api/v1.ts`.

- **Помилки:** єдиний формат `{ error: { code, message, field?, requestId } }`, `message` англійською. Каталог — `lib/server/api/errors.ts` `ERROR_CATALOG`.
- **`GET /v1/account`** (будь-яка область):
  - environment, eetMode, `eicMasked` (`CZ••••5679`);
  - стан сертифіката середовища: valid / expired / missing / not_verified, `validTo`, `daysLeft`;
  - integration: id, name, scopes, unitIds.
- **`GET /v1/units`** (`units:read`):
  - лише одиниці з `unitIds`;
  - `ready` і `notReadyReason`: `unit_missing_fs_id`, `certificate_missing`, `certificate_expired`, `account_closed`.
- **`POST /v1/sales`** (`sales:write`):
  - `SaleV1Schema` побудована зі спільних частин `sales.ts` (`SaleLineSchema`, `SalePaymentsSchema`, `SaleTipSchema`, `SaleDiscountSchema`, винесені з `DeviceSaleSchema`) — не копія.
  - `kind` — тільки `goods | credit_topup`; `credit_topup` → внутрішній `prepayment` → urceno_cerp_zuct. `prepayment`, `refundOf` і `approval` у тілі — помилка.
  - Помилки всього запиту (нічого не зберігається): нема uuid-`id` → 400 з `field`; чужа одиниця → 404; той самий `id` з іншим тілом → 409 `idempotency_conflict`; чужий `externalRef` → 409 `external_ref_conflict`.
  - Невалідна тржба з uuid іде в карантин, як у PWA, і в `results[]` отримує `status: quarantined`, `error.code` і `field`.
  - Валідні тржби проходять через `ingestSales`. Нові відправляються синхронно з бюджетом 2,5 с на весь запит. Тржба, що не вклалася, повертається як `sending` і досилається у фоні; решта лишається `queued` для cron.
  - Відповідь 200 — `results` у порядку запиту.
- **`ingestSales` для інтеграції** (`lib/server/sales.ts`):
  - не робить перевірки `MODE_MISMATCH`: режим дає токен, а не застаріла конфігурація;
  - перевіряє, що одиниця є в `unitIds`;
  - пише `integrationId` і `externalRef` у рядок `sales`;
  - для вратки замість PIN вимагає область `refunds:write`, а оригінал має бути тржбою цієї інтеграції. Інші перевірки вратки — спільна функція `checkRefundAgainst`: та сама, що в PWA, порядок перевірок для PWA не змінився.
- **`GET /v1/sales`** і **`GET /v1/sales/{id}`** (`sales:read`):
  - фільтри: `ids` (≤ 200, у порядку запиту, разом із карантином), `externalRef`, `status` (включно з `quarantined`), `unitId`, `since` / `until`, `limit` ≤ 200;
  - непрозорий `cursor` (base64url `[soldAt, id]`), сортування `soldAt desc, id desc`;
  - тржб PWA та інших інтеграцій не видно.
- **`POST /v1/sales/{id}/refund`** (`refunds:write`):
  - без `lines` — повернення всього, що лишилося (`refundableLines`, `fullSelection`); з `lines` (кладні кількості) — лише позиції оригіналу;
  - платежі віддзеркалюють оригінал (`refundPayments`), одиниця — оригіналу, час — зараз або `soldAt` з тіла;
  - перевищення перевіряється заздалегідь (`refundCapacityIssue`) → 422 `refund_exceeds_original`; гонку ловить `refundCapacity` під `FOR UPDATE`, такий випадок іде в карантин;
  - помилки: 404 `original_not_found`, 422 `original_is_refund`;
  - вратка до ще не підтвердженої тржби дозволена, як у PWA (перевірено: обидві тржби йдуть у чергу самостійно).
- **`GET /v1/closings`** (`closings:read`):
  - денні підсумки тржб інтеграції за празьким днем `soldAt`: count, total, evidenced, notEvidenced, byPaymentMethod, byVat, pending;
  - параметри `unitId`, `from` / `to` (YYYY-MM-DD, ≤ 62 днів).
- **`SaleStatusV1`** містить: `id`, `externalRef`, `status`, `pok`, `evidencedAmount`, `notEvidencedAmount`, `sentAt`, `deadlineAt` (= soldAt + 48 год), `attempts`, `warnings`, `error` (`code`, `message`, `retryable`, `fsCode`), `receiptUrl`. Поле `receipt` (розд. 4) додасть коміт 2.

**Безпека** (розд. 9):
- 9.1–9.2 і 9.4–9.6, 9.9 закриті тестами (див. п. 3).
- 9.3: обгортка логує лише ім'я помилки і SQLSTATE, без тексту. Текст може містити параметри SQL або дані тржби, тож навіть `safeError` для API не використовуємо.
- 9.7 (вебхуки) і 9.8 (OAuth) — у своїх комітах.

**Пристрої каси:** інтеграції не показуються в списку пристроїв налаштувань і не рахуються в ліміті пристроїв (`lib/server/account.ts`). Касу не можна зареєструвати з `registerId` відключеної інтеграції.

### 3. Гейти, що були червоними

Шість файлів, 37 тестів. До коду всі падали на відсутніх модулях (`Cannot find package '@/app/api/v1/account/route'` і `…/sales/route`); гейт міграції — на відсутніх таблицях і колонці `kind`.

- **`s8-api-auth`** (13 тестів):
  - формат і зберігання токена;
  - live лише з production-сертифікатом;
  - PWA ↔ API не взаємозамінні: 401 в обидва боки, а каса далі працює;
  - відсутній або неправильний токен;
  - області;
  - середовище з токена;
  - test-токен на акаунті, перемкнутому в production, без MODE_MISMATCH;
  - відкликання (401 і дорозсилка cron);
  - скасований акаунт (403 на нові, повтор і читання — 200, через 31 день — 401);
  - 120/хв → 429 із заголовками;
  - 101 тржба → 400, 1,1 МБ → 413, невалідний JSON → 400;
  - журнал і облік;
  - retention.
- **`s8-api-isolation`** (4): чужі unitId, sale id і externalRef → 404, нічого не збережено; одиниця поза `unitIds` → 404 (не 403); порожній `unitIds` — нічого; токен не бачить сертифіката, персоналу, PIN, каталогу, тржб PWA та іншої інтеграції.
- **`s8-api-sales`** (13): пакет 100; часткова валідність (карантин з `field`, `sale_in_future`, `amount_out_of_range`); 400 без uuid; `refundOf` і `prepayment` відкинуто; повтор → той самий результат; 10 паралельних із тим самим id → один рядок і одна відправка; 409 обох видів; автоматичний `sequence` 1..20 без пропусків при паралелі, повтор не бере нового номера; власний `sequence` і 26 знаків; `credit_topup` → `urceno_cerp_zuct = "1000.00"`; `transfer` → `not_evidenced` без відправки; бюджет 2,5 с (FS 3 с: перша `sending`, друга `queued`, далі обидві `confirmed`); фільтри й курсор.
- **`s8-api-refund`** (5): повне повернення з POK і ідемпотентне; часткові до межі, далі 422, чужа позиція → 422; одиниця оригіналу поза токеном → 404; без `refunds:write` → 403, вратка вратки → 422, невідомий оригінал → 404 `original_not_found`; вратка до непідтвердженого → `queued`.
- **`s8-no-body-logs`** (1): перехоплення `console.*` на всіх маршрутах, включно з падінням транспорту, відмовою FS, карантином, 409, невалідним JSON і збоєм БД. У лозі немає токена, EIČ, IČO, назв позицій, externalRef, тіл відповідей.
- **`s8-migration`** (1): міграція на базі зі станом 0039.

Регрес: усі наявні тести PWA зелені без змін. Разом web 997 (було 960), fiscal-core 105, cz 29, typecheck 0. Зі змодельованим відкриттям (`CLOSED_SECTIONS = []`, `CLOSED_API = []`, потім `git checkout src/lib/launch.ts`) — web 997 зелені.

### 4. Самостійні рішення

1. **Таблиця `api_sale_keys`** (id тржби → hash тіла, номер, externalRef). Ключ ідемпотентності з'являється раніше, ніж тржба: номер отримує навіть тржба в карантині, а паралельні запити з тим самим id отримують той самий номер. Номер видається в транзакції під `FOR UPDATE` рядка інтеграції — так немає пропусків. Без цієї таблиці автоматичний `sequence` або давав би пропуски, або в паралелі виглядав би як конфлікт вмісту.
2. **Таблиця `api_rate_windows`** для лічильника ліміту в Postgres (атомарний upsert). Порахувати за `api_requests` було б неатомарно.
3. **Атомарність пакета.** Помилки рівня запиту (404, 409, 400) перевіряються **до** будь-якого збереження, тож пакет або приймається, або нічого не зберігається. Помилки окремих тржб (дата, сума, неготова одиниця) — у `results[]` і в карантин.
4. **Сертифікат.** «Немає сертифіката» — не відмова: тржба зберігається, блокується в черзі як у PWA (`CERT_MISSING`) і віддається як `queued` з `error.code = certificate_missing, retryable: true`. Так тржба не зникає (інваріант 1). `unit_not_ready` (немає `fsUnitId`) іде в карантин, як у PWA.
5. **`environment_not_ready` 403** — коли live-токен, а акаунт уже не в production. Нові тржби тоді не приймаються; PMS їх тримає і бачить причину.
6. **Нові коди в каталозі понад розд. 3.7:**
   - `original_not_found` і `refund_exceeds_original` — зі специфікації 3.5;
   - `original_is_refund` (422);
   - `sequence_conflict` (власний `sequence` клієнта вже зайнятий);
   - `sale_blocked` (тржба чекає власника через дані акаунта);
   - `certificate_expired`;
   - `internal_error` (500, «повторіть той самий запит»).

   Снапшот каталогу буде в гейті `s8-openapi` (коміт 2).
7. **Тимчасова помилка ingest** (тржбу не вдалося зберегти) → весь запит 500 `internal_error`. Клієнт повторює той самий запит, а вже збережені тржби повертаються ідемпотентно.
8. **`GET /v1/units` і `GET /v1/closings`** повертають об'єкт `{ units: […] }` / `{ closings: […] }`, а не голий масив, щоб додавати поля без нової версії. `GET /v1/sales` — `{ sales, nextCursor }`.
9. **Закриття дня** (3.6) — агрегат на льоту з `sales`. Таблиця `closings` — це касова uzávěrka з готівкою і зміною; PMS має свою.
10. **Live-токен** вимагає не лише чинного, а й **перевіреного** production-сертифіката (`verifiedAt`, як `CERT_NOT_VERIFIED` у черзі): без перевірки ostré тржби однаково стоять.
11. **`authenticateDevice`** (`lib/server/auth.ts`, не маршрут каси) відкидає `kind ≠ pos`. Для наявних пристроїв поведінка не змінилась.

### 5. Що не вдалося / зауваження

- **Playground ще не доведено** (`api-smoke.ts` проти FS) — це приймання розд. 5, коміт 2.
- **nginx.** `/api/v1` не входить у закриті регекспи nginx (`CLOSED_API` у `lib/launch.ts` його не містить), тож після деплою API буде доступне без basic auth, як `/api/pokladna`. Ліміт тіла 1 МБ у nginx уже є. Потрібно від контролера: підтвердити, що `/api/v1/*` у nginx не закривається basic auth (`infra/nginx` я не чіпав).
