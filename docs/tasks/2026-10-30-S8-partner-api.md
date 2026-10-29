# S8 — EET API pro partnery, v1 (перший клієнт — PMS ALiSiO)

Контролер, 30. 10. 2026. Рішення власника: робимо продаваний продукт «EET API pro vývojáře / EET Gateway» у першій версії. Після пілоту — аналіз конкурентів (fiskaly SIGN CZ, efsta) і v2.
Основа — дослідження `claude/RESEARCH-EET-Gateway-2026-10-26.md` (project doc). Модель A: **технічний посередник**. Тржба йде з EIČ, евіденційною одиницею й сертифікатом самого підприємця. Ми не pověřený poplatník (§ 10) і `eic_poverujiciho` не заповнюємо.

Мета v1 — зовнішня система (PMS, резерваційний, фактураційний софт) за **один день інтеграції** передає тржби свого клієнта в EET 2.0. Вона отримує POK синхронно або вебхуком, повертає й закриває день, бачить помилки. Усе це на тій самій евіденції й черзі, що й наша каса.

---

## 0. Що вже є і що не міняємо

Абзац «що вже є» напиши сам із коду (правило 1 `docs/tasks/README.md`). Контролер бачить таке:

- `packages/fiscal-core`: підпис (`signer.ts`), SOAP 4.1 + WS-Security (`eet2/`, `transport.ts`), перевірка підпису відповіді й POK, черга з новим UUID при повторі (`queue.ts`), сума до евіденції (`sale.ts`, `money.ts`).
  - У `sale.ts`: `transfer` не евідується, `prepayment` = **набиття кредиту** (urceno_cerp_zuct).
- `apps/web/src/lib/server/sales.ts`: `DeviceSaleSchema`, `ingestSales` (ідемпотентно за `id`, стабільний JSON, ліміти часу −45 днів / +10 хв), карантин (`quarantine.ts`), вратки (Т11, `FOR UPDATE`).
- `apps/web/src/lib/server/fiscal.ts`: `processSale`, `salesStatus`, `accountMode`, кеш облікових даних.
- `apps/web/src/lib/server/auth.ts`: `authenticateDevice` — Bearer-токен, `devices.tokenHash` = sha256, `revokedAt`, правила скасованого акаунта (R5.8).
- `/api/pokladna/sales` (POST до 100, GET `?ids=`), `/api/pokladna/vratka`, `/api/pokladna/uzaverky`.
- Таблиці `devices` (registerId = id_pokl, sequencePrefix), `sales` (status, confirmationCode, deadlineAt, eetData, attempts…), `certificates` (envelope encryption), `evidence_units` (fsUnitId), `closings`.
- Публічний доклад `/u/[id]`.

**Інваріант S8:** API не має власної евіденції, черги, підпису чи розрахунку сум. Тржба з API стає звичайним рядком `sales` і проходить ті самі `ingestSales` → `processSale` → cron. Внутрішні маршрути PWA `/api/pokladna/*` не змінюються, їх тести лишаються зеленими без правок.

---

## 1. Модель даних (міграція 0040)

Ключове рішення: **інтеграція = рядок `devices` з `kind = 'integration'`** плюс рядок `integrations` з правами. Так `sales.deviceId`, `registerId` (id_pokl) і `sequencePrefix` працюють без змін.

1. `devices` — нові колонки:
   - `kind` enum (`pos` | `integration`), default `pos`;
   - `unitId` для інтеграції лишається `null`, бо доступні одиниці зберігаються в `integrations`.
2. `integrations`:
   - `id` uuid;
   - `accountId` FK cascade;
   - `deviceId` FK, unique;
   - `name` text — те, що бачить власник: «ALiSiO»;
   - `partnerAppId` nullable, FK на `partner_apps` (розд. 6);
   - `environment` enum (`test` | `live`);
   - `scopes` text[] з набору: `sales:write`, `sales:read`, `refunds:write`, `units:read`, `closings:read`, `webhooks:manage`;
   - `unitIds` uuid[] — порожньо означає «жодної», не «всі»;
   - `nextSequence` bigint default 1;
   - `tokenPrefix` varchar(16) — перші 12 символів токена для впізнавання в UI;
   - `createdBy` (user id), `createdAt`, `lastUsedAt`, `revokedAt`.
3. `sales` — нові колонки:
   - `integrationId` nullable;
   - `externalRef` varchar(64) nullable;
   - `unique (integration_id, external_ref) where external_ref is not null`.
4. `api_requests` — журнал без тіл (R3.6):
   - поля: `id`, `integrationId`, `at`, `method`, `route` (шаблон `/v1/sales/{id}`, не фактичний URL), `status`, `durationMs`, `errorCode`, `requestId`;
   - зберігаємо 30 днів, retention у наявному cron.
5. `api_usage_daily`:
   - поля: `integrationId`, `date`, `requests`, `salesAccepted`, `activeUnits` (кількість різних unitId з тржбами за день);
   - PK `(integrationId, date)`;
   - лише облік, не білінг.
6. `webhook_endpoints`:
   - поля: `id`, `integrationId`, `url` (тільки https), `secretEnc` (через наявний envelope.ts), `events` text[], `active`, `failingSince`, `createdAt`.
7. `webhook_deliveries`:
   - поля: `id` (= event id, uuid), `endpointId`, `event`, `payload` jsonb, `status` (`pending` | `delivered` | `failed`), `attempts`, `nextAttemptAt`, `lastHttpStatus`, `lastError` (≤ 200 знаків, без тіла відповіді), `createdAt`, `deliveredAt`;
   - зберігаємо 30 днів.
8. `partner_apps` (розд. 6):
   - поля: `id`, `name`, `clientId` (публічний), `clientSecretHash`, `redirectUris` text[], `logoUrl`, `active`, `createdAt`;
   - створює лише адмін (`/admin`).
9. `oauth_codes`:
   - поля: `codeHash`, `partnerAppId`, `accountId`, `userId`, `scopes`, `unitIds`, `environment`, `redirectUri`, `expiresAt` (10 хв), `usedAt`.

Дані, що вже є, міграція не чіпає: усі наявні `devices` отримують `kind = 'pos'`.

---

## 2. Токен і доступ

- **Формат:**
  - `ezk_live_` + 40 символів base62 (≥ 238 біт) для live;
  - `ezk_test_` + 40 символів для test.
  - Зберігаємо тільки sha256 у `devices.tokenHash` і `tokenPrefix`.
  - Токен показуємо один раз.
- **`authenticateIntegration(req, scope)`** — нова функція поруч з `authenticateDevice`, яка:
  - перевіряє Bearer, `kind = 'integration'`, `revokedAt`, наявність `integrations` і потрібної області;
  - перевіряє стан акаунта за тими ж правилами, що в R5.8: скасований акаунт може лише дочитувати й дорозсилати, не створювати нові тржби;
  - оновлює `lastUsedAt` не частіше разу на хвилину.
  - Токен PWA на `/api/v1/*` → 401. Токен інтеграції на `/api/pokladna/*` → 401.
- **Середовище задає токен, а не тіло запиту:**
  - `test` → тржба з `mode = 'playground'`;
  - `live` → `mode = 'production'`.
  - Live-токен можна створити лише тоді, коли акаунт має режим production і чинний production-сертифікат; інакше в UI зрозумілий текст (розд. 7).
  - Test-токен працює з тестовим сертифікатом Playground.
  - `mock` через API недоступний.
- **Ізоляція:**
  - чужа одиниця або одиниця поза `unitIds` → 404 `unit_not_found`, а не 403;
  - чужа тржба → 404 `sale_not_found`.
- **Ліміти:**
  - 120 запитів/хв на токен, 100 тржб у пакеті, тіло ≤ 1 МБ (nginx уже має 1 МБ);
  - понад ліміт → 429 з `Retry-After` (секунди) і заголовками `RateLimit-Limit/Remaining/Reset`;
  - лічильник — Postgres, вікно в 1 хв (Redis немає, нового сервісу не додаємо).
- **Кожна відповідь** має заголовок `X-Request-Id` (uuid), той самий id у `api_requests`.
- **Відкликання** діє миттєво: наступний запит отримує 401. Тржби, вже прийняті від цієї інтеграції, cron дорозсилає (інваріант «тржби не губляться»).

---

## 3. REST API `/api/v1`

Загальне:
- JSON, суми в **haléřích** (integer, як у PWA), час — ISO 8601 зі зсувом.
- Помилки мають один формат:
  `{ "error": { "code": "unit_not_found", "message": "…", "field": "sales[3].unitId", "requestId": "…" } }`
- `message` — англійською (для розробника). Чеські тексти лише в UI.
- Маршрути — у `apps/web/src/app/api/v1/…`. Схеми — zod, і з тих самих схем генерується OpenAPI (розд. 5).

### 3.1 `GET /v1/account` (будь-яка область)

`{ "environment": "test", "eetMode": "playground", "eicMasked": "CZ••••1234", "certificate": { "status": "valid", "validTo": "2027-10-31T…", "daysLeft": 366 }, "integration": { "id", "name", "scopes", "unitIds" } }`.
EIČ віддаємо замаскованим, бо у фізосіб це rodné číslo.

### 3.2 `GET /v1/units` (`units:read`)

Лише одиниці з `unitIds`:
`[{ "id", "label", "type", "fsUnitId", "active", "ready": true, "notReadyReason": null }]`.

`ready = false`, коли немає `fsUnitId` або сертифіката для середовища. Причини: `unit_missing_fs_id`, `certificate_missing`, `certificate_expired`, `account_closed`.

### 3.3 `POST /v1/sales` (`sales:write`)

Тіло `{ "sales": SaleV1[] }`, від 1 до 100 тржб.

```jsonc
// SaleV1
{
  "id": "uuid",                 // ідемпотентний ключ від PMS; повтор з тим самим тілом → той самий результат
  "externalRef": "ALI-2026-000123", // ≤ 64, необов'язковий, унікальний у межах інтеграції
  "unitId": "uuid",
  "soldAt": "2027-01-02T08:10:00+01:00", // момент прийняття платежу
  "sequence": "R-000123",       // необов'язковий; якщо нема — сервер дасть префікс інтеграції + nextSequence
  "lines": [{ "name": "Ubytování 2 noci", "qty": 1, "unitPrice": 320000, "vatRate": 12, "kind": "goods" }],
  "payments": [{ "method": "card", "amount": 320000 }],
  "tip": 0,
  "discount": 0
}
```

Валідація:
- `lines`, `payments`, `tip`, `discount` мають ту саму схему, що й `DeviceSaleSchema`. Вистав спільну частину в `sales.ts`, а не копіюй.
- `kind`: у API тільки `goods` | `credit_topup`. `credit_topup` мапиться на внутрішній `prepayment` (набиття кредиту → urceno_cerp_zuct).
- Слово `prepayment` в API **не використовуємо**: розробники PMS плутають його із zálohou на проживання, а záloha — це звичайна тржба (Ф11, `FACTS.evidenced.prepayments`).
- Повний `sequence` (префікс + номер) ≤ 25 знаків.
- `refundOf` і `approval` через `POST /v1/sales` не приймаються — повернення має окремий маршрут.
- `id` уже існує з **іншим** тілом → 409 `idempotency_conflict`. Тіла порівнюй стабільним JSON (як у `ingestSales`).
- `externalRef` уже існує з іншим `id` → 409 `external_ref_conflict`.

Обробка:
- Валідні тржби йдуть через `ingestSales`. Невалідні з uuid-`id` — у карантин, як у PWA; власник бачить їх у «Tržby k vyřízení».
- Синхронна відправка у FS з **бюджетом 2,5 с на весь запит**: спершу відправляються нові (`inserted`) тржби по порядку, решта йде в чергу cron. Обґрунтування: mezní doba odezvy ≥ 2 с встановлює платник, а результат має бути на пристрої, де прийняли оплату (дослідження, розд. 5).

Відповідь 200 (навіть коли частина тржб відхилена) — `{ "results": SaleStatusV1[] }` у порядку запиту.

```jsonc
// SaleStatusV1
{
  "id": "uuid", "externalRef": "…",
  "status": "confirmed",        // confirmed | queued | sending | rejected | quarantined | not_evidenced
  "pok": "…",                   // jen u confirmed
  "evidencedAmount": 320000,    // částka v celk_trzba
  "notEvidencedAmount": 0,      // např. převod
  "sentAt": "…", "deadlineAt": "…", // 48 h od soldAt
  "attempts": 1,
  "warnings": [{ "code": 5, "text": "…" }],
  "error": null,                // { code, message, retryable }
  "receipt": ReceiptFiscalV1,   // § 4
  "receiptUrl": "https://evidujzdarma.cz/u/<id>"
}
```

- `not_evidenced` — тржба без жодного контактного платежу (тільки `transfer`). Сервер її зберігає для звірки, але у FS не шле.
- 4xx (400/401/403/413/429) — лише для помилок усього запиту.

### 3.4 `GET /v1/sales` і `GET /v1/sales/{id}` (`sales:read`)

- Фільтри:
  - `ids` (≤ 200);
  - `externalRef`;
  - `status`;
  - `unitId`;
  - `since`/`until` (за `soldAt`);
  - `limit` ≤ 200;
  - `cursor` — непрозорий; сортування `soldAt desc, id`.
- Відповідь: `SaleStatusV1[]` + `nextCursor`.
- Тржби інших інтеграцій і PWA того ж акаунта не видно.

### 3.5 `POST /v1/sales/{id}/refund` (`refunds:write`)

- Тіло: `{ "id": "uuid нової тржби", "externalRef", "soldAt"?, "lines"?: [...], "reason"? }`.
  - Без `lines` — повне повернення. З `lines` — часткове: позиції мусять бути в оригіналі.
- Використовує наявну логіку вратек (Т11): `FOR UPDATE`, не більше оригіналу, одиниця оригіналу, поточний час.
- PIN-схвалення власника замінює область `refunds:write`, яку власник дав свідомо (у UI окремий чекбокс з поясненням).
- Помилки: `refund_exceeds_original`, `original_not_found`, `original_not_confirmed_yet` (повернення до черги дозволено, як у PWA — перевір і задокументуй фактичну поведінку).

### 3.6 `GET /v1/closings` (`closings:read`)

- Параметри `unitId`, `from`, `to`.
- Повертає денні підсумки тржб цієї інтеграції: кількість, `evidenced`, `notEvidenced`, `byPaymentMethod`, `byVat`, `pending` (неотримані POK).
- Наявна таблиця `closings` — для PWA. Тут або агрегат на льоту, або перевикористання — вибери сам, запиши в звіт.
- `POST`-закриття дня у v1 немає, бо PMS має своє.

### 3.7 Каталог кодів помилок (контракт, не змінюється без версії)

| HTTP | code | Коли |
|---|---|---|
| 400 | `invalid_request` | JSON, розмір пакета, поле (`field`) |
| 401 | `invalid_token` / `token_revoked` | — |
| 403 | `insufficient_scope` / `account_closed` / `environment_not_ready` | — |
| 404 | `unit_not_found` / `sale_not_found` | у т. ч. чуже |
| 409 | `idempotency_conflict` / `external_ref_conflict` | — |
| 413 | `payload_too_large` | — |
| 422 | у `results[].error`: `sale_in_future`, `sale_too_old`, `amount_out_of_range`, `unit_not_ready`, `certificate_missing`, `fs_rejected` (з `fsCode`) | — |
| 429 | `rate_limited` | + `Retry-After` |
| 503 | `fs_unavailable` у `results[].error` з `retryable: true`; запит сам по собі 200 | — |

Стабільні коди перевіряє тест (снапшот каталогу).

---

## 4. Дані для докладу в чужій системі

`ReceiptFiscalV1` — усе, що PMS друкує на своєму рахунку або докладі:

```jsonc
{
  "seller": { "name": "…", "ico": "…", "dic": "…|null", "address": "…" },
  "unit": { "fsUnitId": 12, "label": "…" },
  "registerId": "API-ALISIO", "sequence": "R-000123",
  "soldAt": "…", "total": 320000, "evidencedAmount": 320000,
  "vatBreakdown": { "12": { "base": 285714, "vat": 34286 } },
  "pok": "…|null", "mode": "production|playground",
  "offline": false,       // true, když POK v okamžiku odpovědi ještě není
  "note": "Tržba bude odeslána nejpozději do 48 hodin."  // jen když offline
}
```

- Дані з тих самих функцій, що й доклад PWA (`receipt.ts`, `/u/[id]`). Окремої логіки не пишемо.
- Що мусить бути на докладі (§ 16 ZOS) і що POK необов'язковий — `FACTS.receipt`, `FACTS.confirmation`.
- `receiptUrl` веде на публічний `/u/[id]`. Перевір, що там немає даних, яких не повинно бути публічно.

---

## 5. Документація й пісочниця

1. **OpenAPI 3.1** генерується з zod-схем (`@asteasolutions/zod-to-openapi` або аналог; обґрунтуй вибір у Т-рішенні) і віддається на `GET /api/v1/openapi.json`.
2. **Сторінка `/api-docs`:**
   - чеською;
   - мова прикладів — curl, JavaScript (fetch), PHP;
   - розділи: Začínáme (5 kroků), Autentizace, Tržby, Vratky, Webhooky, Chyby, Limity, Playground, Co se eviduje (посилання на гайди), Changelog API;
   - внизу інтерактивна референція з OpenAPI (Redoc/Scalar, self-hosted, без CDN — CSP);
   - `index`, у sitemap і llms.txt (рядок про API).
3. **Playground:**
   - test-токен + тестові сертифікати FS для Playground (спільні для 3 EIČ, див. дослідження [5][15]);
   - у документації — покроково, як отримати перший POK, що закінчується на «ff»;
   - скрипт `apps/web/scripts/api-smoke.ts`: створює тржбу, повтор, повернення, читання, вебхук на локальний приймач — проти Playground.
4. **Ціник:**
   - картка «API pro vývojáře» лишається зі статусом `preparing`, доки власник не скаже інакше (ЧЕКПОІНТ ціни);
   - CTA веде на `/api-docs`;
   - текст картки онови за фактом: «REST API, webhooky, Playground, vratky».

---

## 6. Підключення в один клік (OAuth 2.0 authorization code + PKCE)

Без цього кожен готель копіював би токен вручну. Для продажу PMS-вендорам це обов'язково, тому робимо у v1, але **після** розд. 1–5: v1 можна релізити й без розд. 6.

- `GET /pripojit?client_id&redirect_uri&state&code_challenge&code_challenge_method=S256&scope&environment`:
  - вхід власника (наявна сесія);
  - якщо в користувача кілька акаунтів — вибір акаунта;
  - вибір одиниць (чекбокси);
  - підсумок прав чеською;
  - кнопки «Povolit» / «Zrušit».
  - Тексти — розд. 7.
- `redirect_uri` — точний збіг зі списком `partner_apps`.
- Відповідь: `302 redirect_uri?code&state`. Код одноразовий, діє 10 хв, зберігаємо хеш.
- `POST /api/v1/oauth/token` (client_id + client_secret + code + code_verifier) → `{ "access_token": "ezk_live_…", "token_type": "Bearer", "scope", "unit_ids", "environment", "integration_id" }`.
  - Access-токен — той самий токен інтеграції без строку дії (refresh у v1 немає). Відкликається в UI.
- Партнера реєструє адмін у `/admin` (форма + показати `client_secret` один раз). Перший партнер — ALiSiO.

---

## 7. UI власника: «Integrace»

Розміщення — поруч зі сторінкою пристроїв (`/api/ucet/zarizeni` і відповідний екран). Доступ лише для ролі owner. Тексти дослівно:

- Заголовок: **Integrace**.
- Підзаголовок: «Propojte EvidujZdarma s rezervačním systémem, hotelovým PMS nebo fakturací. Tržby z nich se evidují stejně jako z pokladny.»
- Кнопка: **Nová integrace**.
- Форма:
  - «Název» (placeholder «např. ALiSiO»);
  - «Prostředí»:
    - «Testovací (Playground)»;
    - «Ostré (produkce)» — неактивне з підказкою «Ostré prostředí zapnete, až budete mít produkční certifikát.»;
  - «Evidenční jednotky»;
  - «Oprávnění»:
    - «Odesílat tržby»;
    - «Číst stav tržeb»;
    - «Vracet tržby (bez PINu vlastníka)»;
    - «Číst jednotky»;
    - «Číst denní přehledy»;
    - «Spravovat webhooky».
- Після створення:
  - «Token se zobrazí jen jednou. Uložte ho do systému, který propojujete. Kdo token zná, může jménem vaší firmy evidovat tržby.»;
  - кнопка «Zkopírovat»;
  - кнопка «Hotovo».
- Список інтеграцій: назва, prostředí, jednotky, «Naposledy použito», кнопка «Odpojit».
- Підтвердження відключення: «Integrace přestane fungovat okamžitě. Tržby, které už přijala, se do EET odešlou.»
- Деталь інтеграції: «Poslední požadavky» (час, маршрут, статус, kód chyby — без даних тржб), «Webhooky» (URL, події, «Poslat testovací událost», стан доставок).
- Тржби з API позначені в наявних přehledech назвою інтеграції.
- Карантин тржб з API — як у PWA, з назвою інтеграції.

Мобільна верстка обов'язкова (власники заходять з телефона). Скріншоти — у звіт.

---

## 8. Вебхуки

- Події:
  - `sale.confirmed` — прийшов POK;
  - `sale.rejected` — FS відхилила остаточно або тржба пішла в карантин;
  - `sale.deadline_soon` — тржба не підтверджена, до `deadlineAt` ≤ 24 год; один раз на тржбу;
  - `certificate.expiring` — за 31, 14 і 3 дні;
  - `certificate.expired`;
  - `integration.revoked` — шлемо на всі endpoints цієї інтеграції в момент відкликання.
- Payload: `{ "id": "evt uuid", "type", "createdAt", "data": { …SaleStatusV1 | certificate } }`.
- Підпис:
  - заголовок `EZ-Signature: t=<unix>,v1=<hex hmac_sha256(secret, t + "." + rawBody)>`;
  - у документації — перевірка з допуском 5 хв і прикладом коду.
- Доставка:
  - тайм-аут 5 с; 2xx — доставлено;
  - повтори через 1 хв, 5 хв, 30 хв, 2 год, 6 год, 24 год;
  - після 3 днів поспіль невдач endpoint `active = false` + лист власникові (наявний `emailOutbox`): «Webhook pro integraci {name} nefunguje 3 dny a byl vypnut. Tržby se evidují dál, jen o nich systém {name} nedostává zprávy.»
- Порядок не гарантуємо; одержувач дедуплікує за `id`. Це в документації.
- Виклики зі `sales`/cron — через `webhook_deliveries` (outbox), а не HTTP у транзакції.
- **SSRF:**
  - тільки https;
  - заборонені IP-діапазони private/loopback/link-local/metadata — перевірка після DNS-резолву;
  - редиректи не слідуємо.
- `POST /v1/webhooks` — CRUD для `webhooks:manage`, щоб PMS реєстрував endpoint сам при підключенні.
- `POST /v1/webhooks/{id}/test` — тестова подія.

---

## 9. Безпека (гейти)

1. Токен інтеграції не бачить сертифіката, пароля, персоналу, PIN, каталогу товарів, тржб PWA та інших інтеграцій.
2. Ізоляція акаунтів: сцени «чужий unitId», «чужий sale id», «чужий externalRef» → 404.
3. У логах немає тіл запитів і відповідей, токенів, EIČ (R3.6). Тест перехоплює `console.*` під час прогону маршрутів.
4. Відкликаний токен → 401 з наступного запиту; прийняті тржби дорозсилаються.
5. Ідемпотентність:
   - паралельні запити з тим самим `id` (Promise.all ×10) → рівно один рядок `sales`, одна відправка у FS;
   - той самий `id` з іншим тілом → 409.
6. Ліміт 429 + `Retry-After`.
7. Вебхук: невірний підпис у прикладі перевірки відкидається; SSRF-адреси відмовлено.
8. OAuth:
   - `redirect_uri` не зі списку → помилка без редиректу;
   - повторне використання коду → `invalid_grant`, і токен, виданий цим кодом, відкликається;
   - PKCE обов'язковий.
9. Скасований акаунт: нові тржби → 403 `account_closed`, читання працює 30 днів (R5.8).

---

## 10. Готель: що евідується (ALiSiO) — `docs/integrations/hotel-pms.md` + розділ у `/api-docs`

Джерело правил — наш рецензований гайд `eet-ubytovani` і `FACTS.evidenced`. Нових податкових тверджень **не додавати** (Ф9, Ф14). Таблиця для розробника PMS:

| Подія в PMS | Викликати API? | Як |
|---|---|---|
| Záloha převodem / platební bránou / přes Booking, Airbnb online | **Ні** | віддалений платіж |
| Záloha zaplacená na recepci (hotovost, karta, QR) | **Так** | звичайна тржба, `kind: goods`, рядок «Záloha – rezervace …» |
| Doplatek na recepci | **Так** | окрема тржба; záloha й doplatek у zprávě не зв'язуються |
| Doplatek převodem na fakturu | **Ні** | (або `transfer` → `not_evidenced`, якщо PMS хоче мати все в одному місці) |
| Minibar, wellness, parkování placené na místě | **Так** | звичайна тржба |
| Vratná kauce — složení / vrácení | **Ні** | — |
| Část kauce složené na místě, kterou si ponecháte | **Так** | тржба на утриману частину |
| Kauce poslaná převodem, část ponechána | **Ні** | не контактна платба |
| Storno / vrácení peněz na místě | **Так** | `POST /v1/sales/{id}/refund` |
| Místní poplatek z pobytu | **Відкрите** | FS ще не пояснила (гайд, розд. «Místní poplatek»). У PMS — налаштування на рівні готелю, рішення за підприємцем і його účetní. Без значення за замовчуванням |
| Dobití kreditu / hotelové karty k pozdějšímu čerpání | **Так** | `kind: credit_topup`, čerpání — `method: credit` |

Додати приклади JSON для «záloha na recepci + doplatek kartou při odjezdu» і «kauce, ponecháno 300 Kč».
Посилання на джерела — ті самі, що в гайді (`SOURCES.*`).

---

## 11. Облік, умови, гроші (ЧЕКПОІНТИ)

- **Облік** — `api_usage_daily` і екран в `/admin`: інтеграція, акаунт, активні одиниці за місяць, запити. Білінгу й лімітів за тарифом у v1 немає.
- **ЧЕКПОІНТ «ціна»** (власник):
  - пропозиція з дослідження — 990 Kč/міс до 25 активних одиниць, далі 25–35 Kč/одиницю;
  - ALiSiO — безкоштовно.
  - Сесія ціни не публікує.
- **ЧЕКПОІНТ «умови»** (власник + юрист):
  - сесія готує **чернетки** `docs/legal/podminky-api-navrh.md` і `docs/legal/dpa-api-navrh.md`;
  - зміст: модель технічного посередника; відповідальність перед FS лишається на poplatníkovi; наші зобов'язання (черга, повтори, сповіщення про 48 год); обмеження відповідальності; DPA čl. 28 GDPR (EIČ може містити rodné číslo); субпроцесори (хостинг), зберігання 10 років не беремо, retention як зараз;
  - це чернетка: публічно не викладати, позначити «Návrh – neschváleno».
- **ЧЕКПОІНТ «ostré prostředí»:** live-токени для зовнішніх партнерів (не ALiSiO) вмикаються прапорцем `API_LIVE_PUBLIC=0/1` у `.env` лише після схвалення умов. Для акаунтів з `partner_apps.name = 'ALiSiO'` і для власника — дозволено одразу.

---

## 12. Поза v1 (у `docs/LATER.md`)

- refresh-токени;
- SDK (npm, composer);
- білінг;
- pověření (§ 10);
- KMS/HSM замість envelope + master key (є в ризиках дослідження — обов'язково до масового продажу);
- SLA і статус-сторінка;
- англомовна документація;
- `POST /v1/closings`;
- мульти-акаунт одного вендора (агрегований токен);
- експорт для звірки з DIS+.

---

## 13. Гейти (червоні першими) і приймання

Тести vitest (сцени на реальній тестовій БД, як наявні):

1. `s8-api-auth`:
   - токени PWA ↔ API не взаємозамінні;
   - області;
   - відкликання;
   - скасований акаунт.
2. `s8-api-isolation` — п. 9.2.
3. `s8-api-sales`:
   - пакет 100;
   - часткова валідність;
   - ідемпотентність (повтор, паралельно, конфлікт);
   - `externalRef`;
   - автоматичний `sequence` з префіксом без пропусків під паралельністю;
   - `credit_topup` → urceno_cerp_zuct;
   - `transfer` → `not_evidenced`;
   - бюджет 2,5 с (mock-транспорт із затримкою: друга тржба → `queued`).
4. `s8-api-refund` — повне, часткове, перевищення, одиниця оригіналу.
5. `s8-webhooks`:
   - підпис;
   - повтори за розкладом (фейковий час);
   - вимкнення після 3 днів + лист;
   - SSRF;
   - `deadline_soon` рівно один раз.
6. `s8-oauth` — щасливий шлях, PKCE, redirect_uri, повторний код.
7. `s8-openapi`:
   - `openapi.json` валідний;
   - кожен маршрут `/api/v1` є в специфікації;
   - каталог кодів помилок збігається зі снапшотом.
8. `s8-no-body-logs` — п. 9.3.
9. Регрес: усі наявні тести PWA зелені без змін.

**Приймання (докази у звіті):**

- `api-smoke.ts` проти **FS Playground**:
  - POK на «ff» для тржби;
  - повтор → той самий результат;
  - повернення → POK;
  - вебхук `sale.confirmed` прийнято локальним приймачем з валідним підписом.
  - Лог виконання — у звіт без токенів.
- Скріншоти UI «Integrace» (desktop + mobile) і сторінки підключення (OAuth).
- `/api-docs` відкривається, приклади curl виконуються проти Playground як написано.
- Міграція 0040 прогнана на копії продової схеми (локально); наявні `devices` → `kind = pos`.

**Не доводимо у v1 (написати в звіті явно):** production-POK через API (лише після ЧЕКПОІНТ «ostré» і реального сертифіката ALiSiO-готелю), навантаження понад 10 тржб/с.

---

## 14. Що робить сторона ALiSiO (модуль `fiscal_cz`) — для довідки, не в цьому репозиторії

1. Налаштування готелю: кнопка «Připojit EvidujZdarma» (OAuth, розд. 6). До готовності розд. 6 — поле для токена.
2. На кожну контактну оплату в PMS — `POST /v1/sales` з `id` = uuid оплати в PMS і `externalRef` = номер оплати. POK або статус показати на рецепції й надрукувати з `receipt` на рахунку.
3. Вебхук `sale.confirmed` / `sale.rejected` / `sale.deadline_soon` → стан оплати в PMS і сповіщення рецепції.
4. Повернення — `/refund`.
5. Правила з розд. 10, поле «Poplatek z pobytu evidovat: ano / ne» на рівні готелю.

---

## Порядок робіт і звіт

1. Розд. 1–3 + 9 → перший коміт і звіт.
2. Розд. 4, 5, 7 → другий коміт і звіт.
3. Розд. 8.
4. Розд. 10–11.
5. Розд. 6.

Звіт — `docs/tasks/2026-10-30-S8-partner-api.report.md` у форматі `docs/tasks/README.md`: що зроблено, докази (тести, Playground), чого не доведено, ЧЕКПОІНТИ з дослівними питаннями до власника.

Деплой робить контролер після рецензії. Каса запускається 2. 11. — **жодних змін у `/api/pokladna/*` і PWA до рецензії S8**.
