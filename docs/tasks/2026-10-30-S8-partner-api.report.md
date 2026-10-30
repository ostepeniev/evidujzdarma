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

---

## Коміт 2 — розд. 4, 5, 7

### 1. Коміти

- `6616277` — дані для докладу, OpenAPI 3.1, сторінка `/api-docs`, скрипт `api-smoke.ts`, екран власника «Integrace» і його маршрути, скріншоти.

### 2. Було → стало

**Розд. 4 — дані докладу**
- `ReceiptFiscalV1` — поле `receipt` у кожному `SaleStatusV1`. Будується в `lib/server/api/v1.ts` (`receiptOf`) з тієї самої функції `receiptDataFrom` (`lib/server/receipts.ts`), що й `/u/[id]` та e-mail.
  - `loadReceipt` тепер викликає `receiptDataFrom`; поведінка для PWA та сама.
  - Поля: `seller`, `unit {fsUnitId, label}`, `registerId`, `sequence`, `soldAt`, `total`, `evidencedAmount`, `vatBreakdown` (`null` у неплатника DPH), `pok`, `mode`, `offline`.
  - `note` дослівно «Tržba bude odeslána nejpozději do 48 hodin.» — лише коли `offline`. Тржба тільки з переказу (`not_evidenced`) не `offline`.
- **Перевірка `/u/[id]`.** Публічна сторінка показує лише реквізити докладу за § 16 ZOS: назва, адреса одиниці, IČO, DIČ, позиції, платежі, DPH, дата, номер, pokladna/jednotka, POK.
  - Проблема для API: `id` тржби обирає PMS. Якщо PMS бере UUID v1/v7 (час, послідовність), адреси докладів можна підібрати.
  - Рішення: для тржб інтеграції `receiptUrl` = `/u/{id}?k=<HMAC>` (`receiptKey`), а `loadReceipt` без правильного `k` повертає 404.
  - Доклади PWA без змін: `id` генерує каса випадково.
  - Змінено `src/app/(app)/u/[id]/page.tsx` — він передає `k` із `searchParams`.
- **DIČ у `receipt.seller`** — лише для платника DPH. У фізичної особи DIČ = CZ + rodné číslo, а API маскує EIČ саме з цієї причини (див. самостійні рішення).

**Розд. 5 — документація й пісочниця**
- **OpenAPI 3.1** — `lib/server/api/openapi.ts`, віддається на `GET /api/v1/openapi.json` (без токена, CORS `*`).
  - Схеми тіл запитів — ті самі zod-схеми, якими API валідує (`SaleV1Schema`, `RefundV1Schema`). Схеми відповідей описані в zod поруч; тест перевіряє, що реальна відповідь проходить `SaleStatusV1Schema`.
  - JSON Schema — нативним `z.toJSONSchema` zod 4 (Т-рішення нижче).
- **Сторінка `/api-docs`** (`app/(site)/api-docs/page.tsx`), чеською.
  - Розділи: Začínáme (5 kroků), Autentizace, Tržby, Vratky, Webhooky, Chyby (таблиця з `ERROR_CATALOG`), Limity, Playground (покроково до POK на «ff»), Co se eviduje (тексти з `FACTS.evidenced` + посилання на гайди), Reference (OpenAPI), Changelog API.
  - Приклади: curl, JavaScript (fetch), PHP.
  - Референція рендериться на сервері з `openApiDocument()` (`components/api-docs/api-reference.tsx`), розгортається нативним `<details>`. Без скриптів і CDN.
  - Розділ «Webhooky» поки чесно каже «připravujeme» (розд. 8 — коміт 3).
  - Сторінка в `STATIC_PAGES` (sitemap, вимірювання), у `llms.txt` додано рядок про API. robots `/api-docs` не блокує (правило `/api/` зі слешем).
- **`apps/web/scripts/api-smoke.ts`** (`pnpm --filter @ez/web api-smoke`). Кроки:
  - account і units;
  - тржба з очікуванням POK на «-ff»;
  - повтор з тим самим тілом → той самий POK;
  - пошук за `externalRef`;
  - часткове повернення → POK;
  - за `EZ_WEBHOOK_URL` — реєстрація вебхука і локальний приймач із перевіркою `EZ-Signature` (крок для коміту 3).

  Токен у лог не потрапляє — лише перші 12 символів.
- **Ціник** не змінювався: оновлений текст картки згадує вебхуки, тож перенесено в коміт 3 разом із ними (інваріант 10).
- **Обмеження розміру тіла.** `lib/server/request-guard.ts` більше не відповідає 413 для `/api/v1/*` власним форматом: обмеження 1 МБ перевіряє обгортка API і відповідає `payload_too_large` у форматі API. Для session-API нічого не змінилось.

**Розд. 7 — UI власника «Integrace»**
- **Нова сторінка** `/pokladna/integrace` (`app/(app)/pokladna/integrace/page.tsx`):
  - лише власник бізнес-акаунта, без сесії → `/prihlaseni?redirect=/pokladna/integrace`;
  - компонент — `components/integrations/integrations-app.tsx`.
- **Тексти дослівно:**
  - заголовок, підзаголовок, «Nová integrace»;
  - форма: «Název» з placeholder «např. ALiSiO»; «Prostředí» — «Testovací (Playground)» / «Ostré (produkce)», ostré неактивне з підказкою; «Evidenční jednotky»; «Oprávnění» — шість пунктів;
  - після створення: текст про токен, «Zkopírovat», «Hotovo»;
  - список: назва, prostředí, jednotky, «Naposledy použito», «Odpojit» з текстом підтвердження;
  - деталь: «Poslední požadavky» — час, маршрут, статус, kód chyby, без даних тржб.

  Біля «Vracet tržby (bez PINu vlastníka)» — пояснення: «Systém bude moct vracet peníze za tržby, které sám poslal, bez vašeho PINu.»
- **Маршрути** (session власника, `ownerRoute`, перевірка origin):
  - `GET`/`POST /api/ucet/integrace` — список без токенів; створення повертає токен один раз;
  - `GET`/`DELETE /api/ucet/integrace/{id}` — деталь з останніми 50 запитами; відключення.
- **Плашка** `SITE.independenceNotice` унизу сторінки (інваріант 9).
- **Скріншоти** — `docs/tasks/s8-screens/`:
  - `integrace-desktop.png` / `integrace-mobile.png` — список і «Poslední požadavky»;
  - `integrace-nova-*.png` — форма;
  - `integrace-token-*.png` — токен (на знімку замаскований);
  - `api-docs-*.png`.

  Знято на локальному Postgres 16 з `next dev` і засіяним акаунтом. Сторінка підключення OAuth буде в коміті 5.

### 3. Гейти, що були червоними

- **`test/integration/s8-receipt.test.ts`** (3). До коду падали: поле `receipt` було `undefined`, `loadReceipt` приймав тржбу API без ключа, сторінка не передавала `k`.
  - повний `ReceiptFiscalV1` для підтвердженої тржби платника DPH (DPH 12 %: 285714 + 34286) і відповідь проходить схему OpenAPI;
  - `offline` з `note` дослівно; переказ не `offline`;
  - `receiptUrl` з ключем: без ключа і з неправильним → `null`, з правильним → дані; доклад PWA без ключа працює.
- **`test/s8-openapi.test.ts`** (5). До коду падали на `Cannot find package '@/app/api/v1/openapi.json/route'`, `'@/lib/server/api/openapi'`, `'@/app/(site)/api-docs/page'` і на відсутньому `/api-docs` у `sitePages()`.
  - структурна валідність 3.1: усі `$ref` резолвляться, унікальні `operationId`, path-параметри описані, у `SaleV1` немає «prepayment»;
  - кожен файл маршруту і метод у `src/app/api/v1` є у специфікації — і нічого зайвого;
  - снапшот каталогу помилок (код → HTTP) і enum кодів у схемі `Error`;
  - `/api-docs`: усі 10 розділів, curl/JavaScript/PHP, усі шляхи, «ff», немає `<script src>` і CDN;
  - sitemap і `llms.txt`.
- **`test/integration/s8-integrations-ui.test.ts`** (6). До коду падали на `Cannot find package '@/app/api/ucet/integrace/route'`.
  - лише сесія власника (без сесії 401, касир 403), токен один раз, у списку токена немає;
  - live відмовлено з підказкою дослівно, з production-сертифікатом — дозволено;
  - «Odpojit» → наступний запит API 401; деталь містить лише `at`/`method`/`route`/`status`/`errorCode`; чужий акаунт → 404;
  - дослівні тексти форми і неактивна опція live;
  - текст токена, «Zkopírovat», «Hotovo», рядок списку, `REVOKE_CONFIRM`;
  - сторінка лише для owner.
- **Свій тест коміту 1** `s8-api-sales` змінено в одному рядку: `receiptUrl` тепер `/u/{id}?k=…` (наслідок розд. 4).
- **Разом:** web 1011, fiscal-core 105, cz 29, typecheck 0.

### 4. Самостійні рішення

1. **Т-рішення «OpenAPI»:** нативний `z.toJSONSchema` у zod 4.6 замість `@asteasolutions/zod-to-openapi`.
   - Він видає JSON Schema draft 2020-12 — саме цей діалект використовує OpenAPI 3.1. Обгортку OpenAPI (paths, components, security) збираємо самі (~150 рядків).
   - Без нової залежності: менше поверхні постачання (R3.13), без конфлікту версій zod.
   - Довгі regex для uuid/date-time прибрано, лишено `format`.
2. **Референція — власний серверний рендер, а не Redoc/Scalar.**
   - Вони навіть self-hosted — це великий клієнтський бандл стороннього коду. Для строгої CSP і інваріанту 6 серверний HTML з `<details>` чистіший.
   - «Спробувати запит» з браузера немає. Якщо контролер хоче саме Scalar, його можна підключити пізніше як статичний бандл.
3. **Ключ у `receiptUrl` для тржб API** і зміна `/u/[id]` (передає `k`). Доклади каси не змінились.
4. **`receipt.seller.dic` лише для платника DPH** — щоб API не видавало rodné číslo фізособи (узгоджено з маскуванням EIČ у 3.1).
5. **Сторінка «Integrace» — окремий маршрут `/pokladna/integrace`**, а не секція в `SetupApp`, щоб не змінювати екрани PWA до рецензії S8. Наслідки:
   - посилання з налаштувань каси немає (посилання з `/api-docs` є);
   - тржби з API в наявних přehledech і в карантині не підписані назвою інтеграції;
   - у листі про карантин стоїть `registerId` інтеграції (`API-ALISIO`), що впізнається.

   Це дві невеликі правки в `components/setup/*` — зроблю після рецензії, якщо контролер дозволить.
6. **Ціник — у коміті 3** (див. п. 2).
7. **У формі за замовчуванням** відмічені «Odesílat tržby», «Číst stav tržeb», «Číst jednotky». Якщо одиниця одна — вона теж.

### 5. Що не вдалося і чому / що потрібно

- **Приймання проти FS Playground не доведено.** Playground з контейнера досяжний (`https://pg.trzbyeet.gov.cz/…` → HTTP 500 на порожній GET), але для POK потрібен справжній тестовий сертифікат FS для Playground. Його в репозиторії немає і бути не може (приватні ключі не кладемо).
  - Прогін `api-smoke.ts` проти локального інстансу без сертифіката (лог без токена):
    ```
    [2026-10-30T00:28:29.154Z] base: http://localhost:3999/api
    [2026-10-30T00:28:29.155Z] token: ezk_test_Ola…
    ✓ GET /v1/account → test, certifikát missing
    ✗ jednotka připravená k evidenci
    ```
  - **Від власника або контролера:** на сервері з тестовим сертифікатом Playground завантажити його в акаунт, створити інтеграцію «Testovací (Playground)» і запустити
    `EZ_API_BASE=https://evidujzdarma.cz/api EZ_TOKEN=ezk_test_… EZ_UNIT_ID=<uuid> pnpm --filter @ez/web api-smoke` (після коміту 3 — ще й з `EZ_WEBHOOK_URL`). Або передати мені тестовий .p12 і пароль поза репозиторієм.
- **Приклади curl на `/api-docs`** проти Playground не виконувались з тієї ж причини. Їх синтаксис перевірено проти локального інстансу (`GET /v1/account` → 200).
- **Міграція 0040** прогнана на локальному PostgreSQL 16 (повний ланцюжок 0000–0040, `migrations applied`) і на PGlite зі станом 0039 + дані (гейт). Копії продової бази в мене немає.

---

## Коміт 3 — розд. 8 (вебхуки)

### 1. Коміти

- `586ec08` — вебхуки: outbox, підпис, повтори, вимкнення, SSRF, планові події, CRUD `/v1/webhooks`, тестова подія, документація, картка в ціннику, вебхуки в деталі інтеграції.

### 2. Було → стало

**Outbox** (`lib/server/webhooks.ts`). Події стають рядками `webhook_deliveries` (`emit`). HTTP шле тільки cron (`deliverWebhooks`), ніколи всередині транзакції тржби.
- `processSale` (`lib/server/fiscal.ts`) після запису результату для тржби інтеграції ставить `sale.confirmed` / `sale.rejected` в outbox через динамічний імпорт. Помилка outbox тржбу не зачіпає; у лог іде лише ім'я помилки.
- Карантин тржби з API (у `submitSales` / `refundSale`) → `sale.rejected` зі `status: quarantined`.

**Події:**
- `sale.confirmed`, `sale.rejected`;
- `sale.deadline_soon` — немає POK, до `deadlineAt` ≤ 24 год; один раз на тржбу (унікальний `dedupe_key` на endpoint);
- `certificate.expiring` — пороги 31 / 14 / 3 дні, по разу кожен;
- `certificate.expired`;
- `integration.revoked` — з `revokeIntegration` на всі endpoints, доставляється і після відкликання;
- `webhook.test`.

Payload: `{ id, type, createdAt, data }`. Для тржб `data` = той самий `SaleStatusV1` (`statusForWebhook`).

**Підпис:** `EZ-Signature: t=<unix>,v1=<hex hmac_sha256(secret, t + "." + rawBody)>`, додатково `EZ-Event-Id`.
- Секрет `whsec_…` (40 base62) шифрується `encryptSecret` (envelope, AAD `webhook:<id>`) і віддається один раз.
- Приклад перевірки з допуском 5 хв: `lib/webhook-signature.ts` (його ж перевіряє тест), на `/api-docs` — Node.js і PHP.

**Доставка:**
- тайм-аут 5 с, 2xx — доставлено;
- повтори через 1 / 5 / 30 / 120 / 360 / 1440 хв, далі `failed`;
- 3 доби безперервних невдач (`failingSince`) → `active = false` і лист власникові дослівно: «Webhook pro integraci {name} nefunguje 3 dny a byl vypnut. Tržby se evidují dál, jen o nich systém {name} nedostává zprávy.»;
- успіх скидає `failingSince`;
- вимкнений endpoint нових подій не отримує.

**SSRF:**
- лише https, без логіна/пароля в URL, `localhost` заборонено;
- при реєстрації DNS-резолв: усі адреси мають бути публічними (`isPublicAddress`, `BlockList`: private, loopback, link-local, у т. ч. metadata 169.254.169.254, CGNAT, multicast, документаційні, IPv6 ULA/link-local, IPv4-mapped);
- при **кожній** доставці новий резолв, і з'єднання йде саме на перевірену адресу (`lookup`, захист від DNS rebinding);
- редиректи не відстежуються (`node:https` не йде за ними; 3xx — невдача);
- тіло відповіді не читається.
- Для локального smoke-тесту поза production — `WEBHOOK_ALLOW_PRIVATE=1` (http://localhost).

**Маршрути** (`webhooks:manage`):
- `POST /v1/webhooks` (201, з `secret`), `GET /v1/webhooks`;
- `DELETE /v1/webhooks/{id}`, `POST /v1/webhooks/{id}/test` (202);
- новий код `webhook_not_found` (404) — у каталозі й снапшоті.

**Cron** (`api/internal/cron`): щохвилини `scanWebhookEvents` + `deliverWebhooks` в окремому `try`, тож збій вебхуків не зупиняє тржби й листи. Retention: `webhook_deliveries` старші 30 днів.

**OpenAPI:** шляхи вебхуків і схеми `WebhookCreate`, `Webhook`, `WebhookCreated`, `WebhookEvent`.

**`/api-docs`, розділ «Webhooky»** (замість «připravujeme»): події, формат, «deduplikujte podle id», повтори, вимкнення, перевірка підпису. Changelog згадує вебхуки.

**Ціник** (`content/pricing.ts`): картка «API pro vývojáře» — «REST API, webhooky, Playground, vratky», CTA → `/api-docs` «Dokumentace API». Статус лишається `preparing`; ціну не чіпав (ЧЕКПОІНТ). Дату `/cenik` у `STATIC_PAGES` змінено на 2026-10-30.

**UI власника:** у «Poslední požadavky» додано блок «Webhooky»: URL, події, «vypnuto», кнопка «Poslat testovací událost», стан останніх доставок (без тіл). Маршрут кнопки — `POST /api/ucet/integrace/{id}/webhooky/{wid}`.

### 3. Гейти, що були червоними

- **`test/integration/s8-webhooks.test.ts`** (15). До коду падали на `Cannot find package '@/app/api/v1/webhooks/route'`.
  - CRUD і секрет один раз, без області → 403;
  - SSRF для 10 адрес: http, 127/8, 10/8, metadata, `[::1]`, `fd00:ec2::254`, 192.168, DNS → 10.x, localhost, credentials;
  - DNS rebinding при доставці → не викликано, `blocked address`;
  - 302 → невдача;
  - outbox без HTTP у запиті тржби, точний HMAC, приклад перевірки (підмінене тіло, чужий секрет, підпис старший 5 хв → false);
  - розклад [1, 5, 30, 120, 360, 1440] і `failed` після 7 спроб, до терміну не викликається;
  - 3 доби → вимкнено + лист дослівно, нові тржби `confirmed` без нових доставок;
  - успіх скидає серію;
  - `sale.rejected` для відмови FS і для карантину;
  - `deadline_soon` рівно один раз;
  - сертифікат [31, 14, 3] + `expired` один раз, без ключів у payload;
  - `integration.revoked` на два endpoints і доставляється;
  - тестова подія;
  - retention;
  - фільтр адрес (`isPublicAddress`).
- **`s8-integrations-ui`** +1: деталь містить вебхуки й доставки без payload і секретів; кнопка тестової події; компонент `WebhookList`.
- **`s8-openapi`:** розділ «Webhooky» з підписом, 5 хвилинами, розкладом, усіма подіями, «deduplikujte podle id», `createHmac`; більше немає «připravujeme». Падав на старому тексті.
- **Разом:** web 1027, fiscal-core 105, cz 29, typecheck 0.

### 4. Самостійні рішення

1. **Подія `webhook.test`** — у переліку розд. 8 немає типу тестової події, тому окремий тип. Вона й `integration.revoked` приходять незалежно від підписки endpoint (`events`).
2. **Порожній `events` = всі події.**
3. **Після 7-ї невдалої спроби доставка `failed`.** Вимкнення endpoint перевіряється на кожній невдачі, тобто потрібні невдачі протягом 3 діб (кілька подій). Одна подія сама по собі endpoint не вимкне: її повтори закінчуються приблизно через 33 год.
4. **Сертифікат:** подія для сертифіката середовища інтеграції (test → Playground, live → production). Пропущені пороги (якщо cron стояв) не доганяються — шлеться найнижчий досягнутий.
5. **Скан подій щохвилини** (не лише в годинному блоці `reminders`), щоб `deadline_soon` не запізнювався. Повторів не буде: працює dedupe.
6. **`WEBHOOK_ALLOW_PRIVATE=1`** діє лише при `NODE_ENV ≠ production` — для локального smoke-тесту. У production ігнорується.
7. **Документаційні діапазони** (192.0.2/24, 198.51.100/24, 2001:db8::/32) теж заблоковані.

### 5. Що не вдалося і чому

- **Доставка з прод-мережі** (реальний https-приймач) не перевірялась — у тестах мережа підмінена. Приймання «вебхук `sale.confirmed` з валідним підписом» — у `api-smoke.ts` (`EZ_WEBHOOK_URL`) разом із Playground (див. коміт 2, п. 5).
