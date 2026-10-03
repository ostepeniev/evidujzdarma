# Рецензія №3 — фіскальна зона (A): R5 і R4-A після виправлень

Рецензент працював лише на читання (без push і комітів). Гілка `claude/pensive-mayer-wcam12`, HEAD **`68d0960`** (збігається з `origin`, новіших комітів немає). Діапазон `116790e..68d0960` — 45 комітів (код + звіти). R5.2 (`5374f0b`) лежить до діапазону, тож перевірено його стан на HEAD.

Нижче лише те, що перевірено в коді. Чотири підозри підтверджено тестом-чернеткою [A-fiscal-r3.scratch.test.ts.txt](A-fiscal-r3.scratch.test.ts.txt): S1 → В-2, S2 → В-1, S3 → частина В-3, S4 → Д-1. Його запускали в копії рецензента як `apps/web/test/integration/zz-rev3-scratch.test.ts`, потім видалили. У репозиторій він не входить.

## 1. Коміт і прогін

| Команда | Результат |
| --- | --- |
| `corepack enable && pnpm install --frozen-lockfile` | OK (8,8 с) |
| `pnpm -r test` | **386/386 зелені**, exit 0:<br>• `packages/cz`: 2 файли, 29 тестів;<br>• `packages/fiscal-core`: 7 файлів, 90 тестів;<br>• `apps/web`: 57 файлів, 267 тестів.<br>Інтеграційні тести працюють на PGlite. |
| `pnpm -r typecheck` | **зелений**, exit 0. `apps/web` = `next typegen && tsc --noEmit` (R5.11), ручних кроків не треба |
| `npx drizzle-kit generate` (`packages/db`) | `No schema changes` — дрейфу схеми й міграцій немає |
| Тест-чернетка (4 сценарії) | 4/4 зелені, тобто всі чотири дефекти відтворюються на `68d0960` |

## 2. Пункти

| Пункт | Статус | Доказ (файл:рядок) | Коментар |
| --- | --- | --- | --- |
| R5.1 MODE_MISMATCH | ⚠️ | міграція `0016`; `schema.ts:143`; `account.ts:194-196`; `sales.ts:147-155`; `quarantine.ts:125-147`; `api/pokladna/sales/route.ts:49,65`; `pos/sync.ts:67-75,94-110,130`; `sale-factory.ts:29`; `pos-app.tsx:109-120,256` | Основний сценарій (mock після переходу в production) закрито: карантин, 0 викликів транспорту, `accountMode` у POST і GET, `refreshConfig` раз на 5 хв, продаж заблоковано. Бекфіл 0016 (`DEFAULT now()`) безпечний. Зворотний напрям (production → mock/playground) порушує інваріант 2 → **В-1**. Дрібне — Д-5, Д-8. |
| R5.2 якорі | ✅ | `response.ts:93-99,222-224`; `trust-anchors.ts` (лише `icaIntermediate`, `icaRoot`); `official/README.md` | Обидва середовища: I.CA Root 05/2022 → Public 06/2022. Production відкидає `test`/`-ff`. Пін GFŘ позначено як непідтверджений для production (`response.ts:112-118`). |
| R5.3 класи Chyba | ✅ | `eet2/errors.ts:12-20`; `client.ts:149-154`; `fiscal.ts:445-488` | `<0` temporary → повтор (≤15 хв); `8` → 3 спроби по 20 хв, потім `rejected`; `2,3,4,6,7` → `rejected` з підказкою; `0` поза ověřením, `1,5,9…`, NaN → `rejected` + лист оператору (дедуп код+година). Таблицю з 13 кодів проганяє справжній `Eet2Transport` (`fiscal-core/test/eet2.test.ts:277-309`). Серія коду 8 пропускає `in_flight`. |
| R5.4 запобіжник | ⚠️ | `fiscal.ts:183-185,440,522-524` (backoff ≤ 6 год), `530-548`, `556-600` (gate, trip), `606-621` (`requeueInvalid`), `770-786`; `api/internal/fs-requeue/route.ts:12-20` (CRON_SECRET, `safeEqual`); міграція `0017`; nginx `evidujzdarma.conf:61` | Стоп на 365 днів прибрано. Пауза середовища, один алерт, requeue під CRON_SECRET, cap 6 год працюють. Але слот пробної тржби витрачається на заблоковані тржби, і самовідновлення затягується на години → **В-2**. |
| R5.5 схвалення vratky | ✅ | `staff-pin.ts:32,51-73,83-85,105`; `api/pokladna/pin/route.ts:10-11,21`; `sales.ts:98-110,214,228`; `schema.ts:365,400`; міграція `0018`; `pos-app.tsx:311` | `{ref, amt, jti}` підписано й звірено. Повторна синхронізація тієї самої vratky ідемпотентна (`ne(id)`). **Гонка двох паралельних ingest з тим самим jti:** токен прив'язаний до `ref`, тож обидві vratky мають однаковий `refundOf`. Другу зупиняє або `sales_refund_of_uq` (→ `REFUND_DUPLICATE`), або `sales_approval_jti_uq` (→ `REFUND_NOT_AUTHORIZED`). Обидві помилки ведуть у карантин, подвійної vratky немає. Сумісність зі старою касою — Д-3. |
| R5.6 EIČ = CN; rebuild | ⚠️ | `account.ts:124-136`; `certificates.ts:48-51`; `fiscal.ts:179,201,402-425` (`EIC_CERT_MISMATCH` до знімка), `641-706` (rebuild, хеші `693-702`); `ucet/trzby-k-vyrizeni/route.ts:33,48-52` | Безпосередньо після таймауту, INVALID, коду 8 чи невідомого коду rebuild неможливий: статус не `rejected` або код поза `/^EET_[23467]$/`. Проте перевіряється лише **остання** спроба. Якщо раніше була невизначена спроба (NETWORK/INVALID), яку FS могла записати, rebuild створить нову ідентичність → **Д-1**. EIČ береться з CN або serialNumber регекспом без якорів → Д-9. |
| R5.7 rejected на касі | ✅ | `sync-result.ts:42-57,75-100`; `sync.ts:131-134,147,177,188`; `api/pokladna/sales/route.ts:62-65`; `quarantine.ts:73-96`; `sales.ts:255-259` | Каса опитує `rejected` раз на 5 хв. GET повертає стан карантину (`open`/`dismissed`). Невідома відхилена тржба не перевідправляється. Карантин `ingested` не відкривається вдруге й лист не йде. Залишок: `dismissed` відкривається знову при повторному POST → Д-10. |
| R5.9 Policy OID; 1. 11. | ✅ | `p12.ts:71-83,115`; `eet2/cert-policy.ts:7-16,22`; `certificates.ts:37-43`; `sales.ts:116-118,156-158`; `quarantine.ts:29` | Розбір сирого DER стійкий: примітив замість SEQUENCE, сміття чи обрізаний DER дають `[]` у try/catch, а `[]` → 400. Префікс із крапкою відсікає `…10.1.1020`. Невідомий OID → 400. Production-тржба з `soldAt` < 2026-11-01T00:00+01:00 → карантин `PRODUCTION_NOT_OPEN`. Дрібне — Д-2. |
| R5.10 способи оплати | ⚠️ | `sale.ts:14,34,36,178-184`; `receipt.ts:114`; `server/closings.ts:29`; `closing.ts:135-136`; `sales.ts:186-190,215-218`; `payment-sheet.tsx:10-17`; `pos-app.tsx:142,156` | Ядро й сервер правильні: 200 stravenka + 800 karta → 1000 без `cerp_zuct`; `credit` → `cerp_zuct`; `gift_voucher` поза `celk_trzba`; legacy `voucher` = credit; `byMethod` старої каси → 0. **Каса ж дозволяє лише один спосіб на тржбу**, тому частковий dárkový poukaz + doplatek провести правильно неможливо → **В-3**. |
| R4 `ba40eec` | ✅ | `response.ts:58-68,183-187,204-237`; `client.ts:119-126`; `envelope.ts:33-38`; `p12.ts:89-94`; `money.ts:15-26`; `sale.ts:116` | `Odpoved` читається лише з `Envelope/Body`. Підписаний Body має перевагу над непідписаною `Chyba`. Пришпилено RSA-SHA256, exc-c14n (SignedInfo і transform), SHA-256 digest, рівно 1 reference на `#Body`. `res.text()` у try → NETWORK з uuid. GCM-тег 16 байт; .p12 з чужим сертифікатом → помилка; `toHalere` half-up; без чайових на vratku. Підміна підписаного Body з іншим uuid → INVALID (перевірка uuid). |
| R4 `8de115f` | ✅ | `fiscal.ts:26-35,213-240,272-302,357-367,370,408-415,794-798`; `transport.ts:26`; `client.ts:101-103`; міграція `0019`; `schema.ts:380,412` | Аудит `in_flight` іде до POST; помилка аудиту → POST не відбувається. Пізній POK застосовується, якщо статус ≠ confirmed. Timeout обмежено 1–30 с (< `STALE_CLAIM_MS` 120 с). Невідомий режим → `MODE_UNKNOWN`. `SALE_INVALID` видно, оператор отримує лист. `integer` — безпечне розширення типу, `DROP DEFAULT mode` безпечний: єдиний INSERT у `sales` — `sales.ts:195`. Дрібне — Д-6. |
| R4 `d14936c` | ✅ | `fiscal.ts:58-91` (`FOR UPDATE`, `aadVersion: 2`, requeue в tx), `100-102,127`, `313-327`, `377-379`; `certificates.ts:116-120`; міграція `0020`; `schema.ts:299,310` | **Старі ключі розшифровуються:** `aad_version DEFAULT 1` → AAD `cert:${accountId}`, рівно як було (`git show 116790e:apps/web/src/lib/server/fiscal.ts:42,102`); нові → `cert:${accountId}:${env}`. Міграція спершу revoke-ає старші дублі, потім ставить частковий unique-індекс. Production потребує перевіреного сертифіката (`CERT_NOT_VERIFIED`). Регресійного тесту для `aad_version=1` немає → Д-7. |
| R4 `d7a28f9` | ✅ | `sale.ts:55,126`; `sales.ts:186-190`; `sync-result.ts:107-164`; `sync.ts:88,150-166` | Межа XSD 99 999 999,99 Kč на `total` і дільчі суми. Пакети ≤ 50 шт. і ≤ 256 kB; 413 ділить пакет навпіл; помилка одного пакета не зупиняє інших. Зсув годинника — лише з `res.ok` і ≤ 45 днів. |
| R4 `9026817` | ✅ | `reminders.ts:59-82,106-171`; `certificates.ts:83,121-122`; `receipt.ts:132`; `fiscal.ts:741-757` | «stuck» лише до дедлайну, раз на 6 год. Щоденний огляд з 7:00 за Прагою включає карантин, тржби після 48 год і Varovani. Ověření — 6 за 10 хв, mock → `simulated`. POK mock-тржби не друкується. |

## 3. Нові знахідки

### Критично

Критичних знахідок не виявлено. Тихої втрати тржби (інваріант 1) у нових шляхах немає: MODE_MISMATCH, PRODUCTION_NOT_OPEN, `was_test`, `SALE_INVALID`, `MODE_UNKNOWN` і пауза запобіжника лишають тржбу видимою, а власник і оператор отримують повідомлення.

### Важливо

**В-1. «Odeslat v aktuálním režimu» відправляє тржбу, продану в production, через mock: фейковий POK, у FS нічого (інваріант 2; підтверджено S2)**

- **Де:**
  - `quarantine.ts:143-147`: `payload.mode = accountMode(account)` без обмеження напряму;
  - `sales.ts:147-155`: карантин для будь-якої розбіжності;
  - `account.ts:164-196`: `setEetMode` дозволяє production → mock/playground;
  - `setup-app.tsx:1176`: діалог «Tržba byla skutečná a odešle se v režimu, který účet má teď», без назви цільового режиму.
- **Сценарій:**
  1. Акаунт у production. Власник перемикає його в mock або playground. Наприклад, після помилкового ввімкнення production до 1. 11. або для тестування після 1. 1.
  2. Планшет зі старою конфігурацією продає справжню production-тржбу → `MODE_MISMATCH`.
  3. Власник бачить «Tržba byla skutečná…» і тисне «Odeslat v aktuálním režimu».
  4. Результат: `sales.mode = 'mock'`, `confirmed` з фейковим POK, транспорт `['mock']`.

  Іншого шляху відправити тржбу в режимі продажу (production) немає, лишається тільки «Byla to zkouška». Тож справжня тржба або «підтверджена» mock-ом, або відкинута.
- **Виправлення:**
  - `send_current_mode` дозволити лише у «старшому» напрямі (mock → playground/production; playground → production);
  - для `payload.mode ∈ {playground, production}` і нижчого поточного режиму — 400 «vyřiďte ručně», або явна дія «odeslat v režimu prodeje», яка пропускає MODE_MISMATCH лише за прапорцем власника;
  - у діалозі називати цільовий режим.
- **Гейт (червоний до коду):** сценарій S2 → очікуємо 400 (або `ok:false`), 0 викликів mock-транспорту, у `sales` немає рядка з `mode='mock'`.

**В-2. Слот пробної тржби запобіжника витрачається на заблоковану тржбу: після відновлення FS відправка в середовищі стоїть ще ≥ 1 год на кожну таку тржбу (підтверджено S1)**

- **Де:**
  - `fiscal.ts:556-567`: `breakerGate` атомарно займає слот (`probeAt = now+1h`) ще до claim і до перевірки блоку;
  - `fiscal.ts:777-786`: запит пробної тржби не фільтрує `blockedReason`;
  - `fiscal.ts:388`: паузу знімає лише `confirmed`;
  - результат `blocked` слот не повертає;
  - слот губиться також, коли claim не вдався (`nextAttemptAt` у майбутньому або паралельний claim).
- **Сценарій (S1):**
  1. 3 акаунти дають INVALID → пауза.
  2. В іншого акаунта є стара заблокована production-тржба: `CERT_MISSING`/`CERT_EXPIRED`/`CERT_NOT_VERIFIED` після заміни сертифіката, `EIC_CERT_MISMATCH`, `SALE_INVALID`, `MODE_UNKNOWN`. Усі вони `queued` з минулим `nextAttemptAt`.
  3. FS уже в порядку. Настає час проби → `processPending` → **0 викликів транспорту**, запобіжник лишається, `probeAt` +60 хв.

  З N такими тржбами пауза триває приблизно N годин. Найімовірніше це трапиться в ніч запуску 1. 1. 2027, коли таких блоків багато, а 48-годинні lhůty в усіх ідуть. Пом'якшення: оператор щогодини отримує «tržby bez POK» (`fs-monitor.ts:115-146`) і може викликати `requeueInvalid`.
- **Виправлення:**
  - проба — лише `blockedReason IS NULL OR blockedReason = 'INVALID_RESPONSE'`;
  - слот займати після успішного claim;
  - якщо спроба закінчилась `blocked` без виклику транспорту, повертати слот (`probeAt = now`).
- **Гейт:** сценарій S1 → очікуємо рівно 1 виклик транспорту зі здоровою тржбою і порожній `fs_breaker`.

**В-3. R5.10 на касі: один спосіб оплати на тржбу. Частковий dárkový poukaz (чи kredit) + doplatek провести правильно неможливо, і готівка або недоевідується, або переевідується**

- **Де:**
  - `payment-sheet.tsx:10-17`: `PaymentResult { method }`, один спосіб;
  - `pos-app.tsx:142,156`: `payments: [{ method: r.method, amount }]`;
  - ядро й сервер змішані оплати підтримують (`sale.ts:178-184`, `DeviceSaleSchema` до 5 платежів), а каса — ні.
- **Сценарій** (типовий для kadeřnictví):
  1. Послуга 800 Kč: poukaz на 500 Kč + 300 Kč готівкою.
  2. Касир обирає «Dárkový poukaz» на 800 → `evidencedTotal 0` → `not_required`: **300 Kč готівки не евідовано**. До R5.10 `voucher` входив у `celk_trzba`, тож цей шлях недоевіденції новий.
  3. Касир обирає «Hotovost» на 800 → у FS 800 замість 300, а очікувана готівка в uzávěrce на 500 більша за реальну.

  Те саме з kreditem + doplatkem: `cerp_zuct` неправильний. Сценарій семінару «200 stravenkou + 800 kartou» на касі ввести не можна, хоча на суму це не впливає (обидва способи евідуються).

  Пов'язане (S3, ядро): `refundInput` (`sale-factory.ts:101-103`) бере `payments[0].method` на всю суму, а сервер (`sales.ts:104-109`) звіряє лише `-total ≤ original.total`, без евідованої частки й способів. Для змішаної тржби 300 poukaz + 700 hotovost vratka дасть 0 або −1000 замість −700. Сьогодні таку тржбу створює лише клієнт API з токеном пристрою, але з розділеною оплатою це стане звичайним випадком.
- **Виправлення:**
  - розділена оплата в `PaymentSheet` (кілька рядків `method/amount`, сума = `due`);
  - `refundInput` дзеркалить оплати оригіналу;
  - сервер для vratky вимагає способи ⊆ способів оригіналу і `|evidencedAmounts(refund).total| ≤ original.evidencedTotal` (так само для `redeemed`).
- **Гейт:**
  - юніт `PaymentSheet`/`pay()`: 500 `gift_voucher` + 300 `cash` → `payments` з двома рядками, `evidencedTotal 300`;
  - S3: `refundInput` → `[gift −300, cash −700]`, евідовано −700;
  - інтеграція: vratka `[cash −1000]` до оригіналу з `evidencedTotal 700` → карантин `REFUND_EXCEEDS`.

### Дрібне

1. **Д-1 · rebuild перевіряє лише останню спробу** (`fiscal.ts:665-669`; підтверджено S4).
   - **Сценарій:** спроба 1 — NETWORK/timeout (FS могла записати ідентичність з `id_jednotky 303`). Спроба 2 — `Chyba 4`. Власник міняє jednotku на 304 → rebuild проходить → нова ідентичність → можлива друга тржба у FS.
   - Коди 2/3/6/7 на тих самих даних детерміновані, тож практично ризик стосується коду 4 (підпис може змінитися між спробами). «Перевірити» з FS.
   - Окремо «перевірити»: після rebuild `first_sent_at` лишається, тож нова ідентичність іде з `prvni_zaslani=false`.
   - **Виправлення:** rebuild лише тоді, коли жодна спроба поточного знімка не скінчилась NETWORK, `HTTP_*`, `INVALID`, `in_flight`, `stale` чи `EET_8`. Після rebuild скидати `first_sent_at`, якщо Popis це дозволяє.
   - **Гейт:** S4 → `skipped`.
2. **Д-2 · production до 1. 11. і перевизначення дати.**
   - `setEetMode` дозволяє production до `EET_PRODUCTION_ACCEPTS_FROM` (`account.ts:164-196`). Кожна тржба тоді йде в карантин `PRODUCTION_NOT_OPEN`, де доступне лише «vyřídit ručně».
   - `Date.parse(process.env.EET_PRODUCTION_ACCEPTS_FROM)` для сміття дає NaN, і перевірка вимикається: fail-open (`sales.ts:116-118,156`).
   - **Виправлення:** 400 у `setEetMode` до цієї дати; NaN → константа.
   - **Гейт:** `setEetMode('production')` 20. 10. 2026 → 400; env `"x"` → карантин лишається.
3. **Д-3 · стара кешована каса (до R5.5) не може робити vratky.**
   - `/api/pokladna/pin` без `refundOf/amount` → 400 (`pin/route.ts:21`, `staff-pin.ts:83-85`).
   - Офлайн-vratky зі старим токеном → `REFUND_NOT_AUTHORIZED`. «Zkusit znovu» цього не виправить, лишається лише ручне вирішення.
   - До запуску даних немає. Записати в чек-лист деплою (оновлення SW до пілоту).
4. **Д-4 · той самий продаж двома паралельними POST** (дві вкладки каси на одному пристрої; `running` діє в межах вкладки, `sync.ts:217-225`).
   - `ON CONFLICT (id) DO NOTHING` не гасить порушення інших unique-індексів (`sales_device_seq_uq`, `sales_refund_of_uq`, `sales_approval_jti_uq`).
   - Наслідок: хибний карантин `SEQUENCE_CONFLICT`/`REFUND_*` і лист для тржби, яка вже збережена (`sales.ts:222-229`). Втрати немає.
   - «Перевірити» на справжньому Postgres (PGlite серіалізує, тож тут не відтворюється).
   - **Виправлення:** у catch перечитати рядок за id; якщо вміст той самий → `ok`.
5. **Д-5 · каса стоїть до 5 хв, якщо `refreshConfig` після розбіжності не вдався** (`sync.ts:67-75,130`).
   - `configStale` лишається `true`, а `doSync` оновлює конфігурацію лише за таймером 5 хв.
   - Без невідправлених тржб немає й POST/GET з `accountMode`.
   - **Виправлення:** при `isConfigStale()` пробувати `refreshConfig` на кожному тику.
   - **Гейт:** юніт з фейковим `api` → другий тик робить запит.
6. **Д-6 · `onPrepared` пише `in_flight` і робить POST, навіть коли claim уже втрачено** (`fiscal.ts:357-367`): умовне лише `first_sent_at`. Звіт пише «лише якщо claim ще наш». Практично недосяжно (timeout ≤ 30 с ≪ 120 с). Можна кидати виняток, якщо UPDATE зачепив 0 рядків.
7. **Д-7 · немає регресійного тесту, що сертифікат з `aad_version=1` розшифровується** (`fiscal.ts:127`). Код правильний.
   - **Гейт:** рядок, зашифрований з AAD `cert:${id}` і `aad_version 1` → `loadCredential` OK; той самий рядок з `aad_version 2` → відмова.
8. **Д-8 · R5.1, межа годинника.** `soldAt` каси коригується лише при зсуві ≥ 30 с (`sync-result.ts:167-170`). Каса, що відстає на < 30 с, протягом цих секунд після перемикання проходить у старому режимі (`sales.ts:147`). Незначне.
9. **Д-9 · EIČ із сертифіката** (`p12.ts:96-101`): `/CZ\d{8,10}/` без якорів, з CN **або** serialNumber. CN `CZ12345678901` → `CZ1234567890`. За FS CN = EIČ.
   - **Виправлення:** брати CN, якщо він відповідає `^CZ\d{8,10}$`, інакше 400.
10. **Д-10 · вирішений (`dismissed`) карантин відкривається знову** (`quarantine.ts:40-50`). Касир тисне «Odeslat znovu» до 5-хвилинного опитування → повторний POST → `resolution=null` і новий лист власнику. Лікується тим самим захистом, що й `ingested` (R5.7), але для `dismissed`.

### Перевірити (з коду не встановити)

- Чи може FS на тих самих даних після невизначеної спроби повернути `Chyba 4` (Д-1), і чи коректне `prvni_zaslani=false` для перебудованого знімка.
- Поведінку `ON CONFLICT DO NOTHING` при паралельних INSERT того самого id на прод-Postgres (Д-4).
- Пін GFŘ і `nonRepudiation` на першій ostré відповіді (записано в `response.ts:112-118`; запобіжник R5.4 це покриває, з поправкою на В-2).
