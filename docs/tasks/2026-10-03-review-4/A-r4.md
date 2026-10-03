# Рецензія №4 — фіскальна зона (A): R6 після виправлень

Рецензент працював лише на читання (без push і комітів). Гілка `claude/pensive-mayer-wcam12`, HEAD **`1aec031`** (збігається з `origin`, новіших комітів немає). Діапазон `a4a64c7..1aec031` — 32 коміти. R6.1 (`c9f7ded`) лежить до діапазону, тож перевірено його стан на HEAD. Коміти `252daae`, `1aec031` (eet-open-site) і B-дрібне (`e93f507`, `e7d81c1`, `b24aad4`) — поза моєю зоною, переглянуто лише на перетин із фіскальним кодом.

Підозри перевірено тестом-чернеткою [A-r4.scratch.test.ts.txt](A-r4.scratch.test.ts.txt) (сценарії N1–N5, 5/5 відтворюються на `1aec031`). Його запускали в копії рецензента як `apps/web/test/integration/zz-rev4-scratch*.test.ts`, потім видалили; робоче дерево чисте.

## 1. Коміт і прогін

| Команда | Результат |
| --- | --- |
| `corepack enable && pnpm install --frozen-lockfile` | OK (7,5 с) |
| `pnpm -r test` | **483/483 зелені**, exit 0:<br>• `packages/cz`: 2 файли, 29 тестів;<br>• `packages/fiscal-core`: 9 файлів, 97 тестів;<br>• `apps/web`: 74 файли, 357 тестів (у звіті 352; +5 — `test/open-site.test.ts` із комітів eet-open-site).<br>Інтеграційні тести — на PGlite. |
| `pnpm -r typecheck` | **зелений**, exit 0 |
| `npx drizzle-kit generate` (`packages/db`) | `No schema changes` — дрейфу схеми й міграцій немає |
| Тест-чернетка (N1–N5) | 5/5 зелені, тобто всі п'ять дефектів відтворюються |
| URL `SOURCES.seminarVyvojari` | `200 application/pdf`, 2,25 МБ — відкривається |

## 2. Пункти

| Пункт | Статус | Доказ (файл:рядок) | Коментар |
| --- | --- | --- | --- |
| R6.1 send_current_mode лише вгору | ✅ | `quarantine.ts:126-143` (`canSendInMode`, `sendDownRefused`), `:172-178`; `api/ucet/karantena/route.ts:27-28`; `setup-app.tsx:1228-1241`; тест `r6-1-mode-upward` | Вниз → 400 з текстом рецензії дослівно, `ingestSales` не викликається, карантин лишається. «Retry» шле з `payload.mode` без змін → знову MODE_MISMATCH, обходу немає. Діалог називає цільовий режим. |
| R6.2 ACCOUNT_CLOSED | ✅ | `sales.ts:148-151`; `quarantine.ts:30`; тест `r6-2-closed-ingest` | Перевірка йде до MODE_MISMATCH, результат — карантин (не відкидання). Продане до закриття приймається. Побічне: лист «Tržba čeká…» для закритого рахунку → N8; повтор уже прийнятої тржби з `soldAt` трохи після закриття → N10. |
| R6.3 retention бачить production-карантин | ✅ | `lifecycle.ts:253-260` | Та сама умова `unsentProduction` і для DELETE, і для `held`. Лишок: карантин MODE_MISMATCH із `payload.mode='mock'` на production-рахунку не тримається → N7. |
| R6.4 межа утримання (сервер) | ⚠️ | межа 60 d: `lifecycle.ts:240-259`; `legal.ts:23-28`; пристрої 30 d: `auth.ts:164-167`, `lifecycle.ts:261-273`; листи 0/30/55: `lifecycle.ts:99-100,139-173`, `reminders.ts:175-185`; reminders без закритих: `reminders.ts:39,67,129,142,148,190-192`; «Evidováno jinak»: `lifecycle.ts:180-222`, `api/ucet/zrusit/evidovano-jinak/route.ts:9-12`; міграція `0024` (nullable `ADD COLUMN`, без default/rewrite); `schema.ts:392-393`; тест `r6-4-closed-hold` | Межа, відкликання, три листи (дедуп за `closed-summary:{id}:{day}`, 30/55 — лише коли є що вирішувати), пропуск закритих у всіх 5 гілках reminders, аудит у `sale_attempts` (`result: settled`, e-mail власника) — працюють. **Але** `settleElsewhere` позначає всі поточні невідправлені тржби, а не ті, які бачив і підтвердив власник → **N1** (Важливо). Тексти zásad/podmínek і `TERMS_VERSION`/`PRIVACY_VERSION` оновлено (`ochrana-osobnich-udaju/page.tsx:45`, `podminky/page.tsx:251,298`) — це чернетка для юриста. |
| R6.5 MCP `eet_check_ico` + гейт | ✅ | `lib/mcp/server.ts:22-30` (`publicHref`), `:127`; `eet_classify_payment` `:251-252`; гейт `test/r4-mcp-guides.test.ts:41-62` | Сервер реєструє **8** інструментів (не 9): `eet_check_ico`, `eet_calculate_eet_off`, `eet_classify_payment`, `eet_get_facts`, `eet_list_misconceptions`, `eet_search_guides`, `eet_get_guide`, `eet_get_fs_status`. Гейт кличе всі 8, `eet_check_ico` — для кожної фікстури ARES, у JSON і markdown. Посилання не на `/navody/` лишаються (це не гайди). |
| R6.6 факт prepayments, джерело, MCP kinds | ✅ | `content/facts.ts:22-25,254-256`; `lib/mcp/payments.ts:9-21,52-95`; тест `r6-6-prepayments` | Текст факту **побайтово** збігається з рецензією (звірено скриптом). `sources = [kdoMusi, seminarVyvojari]`, URL відкривається. `gift_voucher` → `no` (і поза osobním kontaktem), `meal_voucher`/`credit`/`deposit` → `yes` з джерелом семінару, legacy `voucher` → `uncertain` «Záleží na druhu…». |
| R6.7 záloha/doplatek | ✅ | `fiscal-core/src/sale.ts:8-50,168-189`; `payment-sheet.tsx:257`; `api/ucet/export/route.ts`; тест `fiscal-core/test/r6-7-deposit` | Логіку не змінено, і вона правильна: каса ніколи не створює `kind:"prepayment"` (grep у `components/pos`, `lib/pos` — 0). Záloha 500 + doplatek 1 500 → дві тржби без `urceno_cerp_zuct`/`cerp_zuct`; nabití 1 000 → `urceno_cerp_zuct` 1000.00. Змінено мітки й коментарі. |
| R6.8 probe лише на придатній тржбі | ✅ | `fiscal.ts:347-367` (до claim — лише читання `breakerPaused`, слот після claim, відкат claim), `:398-421` (повернення слоту за `probeAt = until`), `:584-608`, `:863-895` (кандидати `blocked_reason IS NULL OR 'INVALID_RESPONSE'`, до 20, стоп, коли слот спожито); тест `r6-8-probe` | `blocked` справді завжди до FS: `PREPARE` повертається до `ctx.onPrepared` і `fetch` (`fiscal-core/src/eet2/client.ts:94-103`). `due` виключає всі середовища з `fs_breaker`, тож заблоковані тржби слот не чіпають. Відкат claim відновлює `attempts` і `sentAt`. Залишок (дрібний, не новий): `INTERNAL` до FS (помилка БД) тримає слот годину. |
| R6.9 розділена оплата, vratka пропорційно, сервер | ⚠️ | `lib/pos/split-payment.ts:17-51`; `payment-sheet.tsx:84-107,114-142`; `pos-app.tsx:139-160,306,312`; `sale-factory.ts:84-104`; `sales.ts:108-113`; `schema.ts:401`; тести `r6-9-split-payments`, `r6-9-refund-evidenced` | Ядро пункту правильне (деталі нижче таблиці). Нові знахідки навколо: vratka в іншому режимі, ніж оригінал → **N2**; додатні/від'ємні платежі звичайної тржби → N4; решта (Vrátit/Vráceno) після розділеної оплати рахується від усієї суми → N6. |
| R6.10 rebuild без невизначених спроб | ✅ | `fiscal.ts:689-728` (`indeterminateAttempt`, `rebuildRefusal`, `correctableSales`), `:748-752`; `api/ucet/trzby-k-vyrizeni/route.ts:8,34`; тест `r6-10-rebuild-indeterminate` | Невизначені: `in_flight`, `stale`, `invalid`, `NETWORK`, `HTTP_*`, `INVALID_RESPONSE`, `EET_8`, `INTERNAL` з `request_sha256`. «Поточний знімок» = спроби після останнього `rebuilt`. GET і rebuild беруть одну функцію. `first_sent_at` не скидається → `prvni_zaslani=false`. |
| R6.11 production до 1. 11.; env fail-closed | ⚠️ | `fiscal.ts:189-192`; `account.ts:195-199`; `sales.ts:168`; тест `r6-11-production-date` | `NaN` → константа, `setEetMode` до дати → 400. Але `Date.parse` поблажливий: `"1"` → 2001, `"0"` → 2000, `"2026"` → 1. 1. 2026, і перевірка фактично вимкнена → **N3** (підтверджено). |
| R6.12 EIČ лише з повного CN | ✅ | `fiscal-core/src/p12.ts:96-98`; `lib/server/certificates.ts:34`; тести `r6-12-eic-cn`, `r6-12-eic-import` | `^CZ\d{8,10}$` лише з CN, `serialNumber` ігнорується; інакше `dic=null` → 400, нічого не зберігається. |
| Д-3 стара каса і vratka | ✅ | `api/pokladna/pin/route.ts:21-22` | Стара каса показує `data.error` із сервера — перевірено на коді до R5.5 (`git show 7bc10d1^`: `owner-approval.tsx:26`, `sync.ts` `verifyStaffPin` → `data.error`). Чек-лист пілоту — у звіті, для контролера. |
| Д-4 паралельні POST | ✅ | `sales.ts:236-248`, `:285-298` (`sameSale`) | Перечитування за `id`; той самий пристрій і вміст → `ok`. На справжньому Postgres — «перевірити» (PGlite серіалізує). |
| Д-5 refreshConfig на кожному тику | ✅ | `sync-result.ts:183-189`; `sync.ts:131` | `refreshConfig` ковтає не-401 помилки (`sync.ts:95-111`), тож синхронізація тржб іде далі. |
| Д-6 onPrepared без claim | ✅ | `fiscal.ts:383-389`; `client.ts:101-103` | Виняток з `ctx.onPrepared` іде до `fetch` → POST не відбувається; у `processSale` це `INTERNAL`, не застосовується. |
| Д-7 `aad_version=1` | ✅ | `test/integration/r6-minor-a.test.ts:99-112` | Регресійний тест є. |
| Д-8 межа годинника < 30 с | ✅ | `sales.ts:120,155-159` | Допуск лише для перемикання вгору; вниз тржба лишається у вищому режимі. |
| Д-10 dismissed не відкривається | ✅ | `quarantine.ts:38-62` | `prior.resolution='dismissed'` → повернення без листа; `setWhere` виключає `dismissed` і для паралельного запиту. |

**R6.9 — що саме перевірено:**

- **Заокруглення до haléřů.**
  - Повна vratka (каса робить лише повну) дзеркалить кожен рядок точно. Сума частин після віднімання спропитного дорівнює `subtotal`, а `refundTotal = −subtotal`, тож `Math.round(−p) = −p`.
  - Розбіжність можлива лише при дробовій кількості з `.5` haléře. `Math.round(−x.5) ≠ −Math.round(x.5)` (`money.ts:66`), і vratka виходить на 1 haléř **менша** за модулем, ніколи не більша.
  - Залишок пропорції міг би перевищити частину оригіналу лише при ≥ 4 рядках платежу і такому заокругленні. Практично недосяжно, а сервер тоді дав би карантин — без втрати.
- **Кілька часткових vratek, що разом більші за оригінал,** неможливі: частковий unique `sales_refund_of_uq` (`schema.ts:401`) → друга vratka дає `REFUND_DUPLICATE` → карантин.
- **Legacy `voucher`.** До R5.10 він і евідувався, і входив у `redeemed` (`git show 4fdcd7d^:packages/fiscal-core/src/sale.ts:23,160`). Дзеркальна vratka `voucher` проходить обидві межі.
- **Vratky старої каси.** Старий спосіб — `payments[0].method` на всю суму. Для односпособових оригіналів, а лише такі стара каса й створювала, це точне дзеркало.
  - Якщо касир у старому вікні вибрав інший спосіб: poukaz → hotově дає `REFUND_EXCEEDS` у карантин, це правильно; karta → hotově приймається, евідована сума та сама.
  - Сума схвалення `−refundInput().total` збігається з `−sale.total` на сервері.
- **Оригінал із частиною `gift_voucher`:** `[gift −300, cash −700]` → −700, приймається; `[cash −1000]` → `REFUND_EXCEEDS`; `[credit …]` → межа čerpání. Спропитне не повертається (`split-payment.ts:31-39`).
- **Стара каса без розділеної оплати ↔ новий сервер:** схема `DeviceSaleSchema` не змінилась, сумісно.

## 3. Нові знахідки

### Критично

Критичних знахідок не виявлено.

### Важливо

**N1. «Evidováno jinak» позначає й тржби, яких власник не бачив і не підтверджував (інваріант 1; підтверджено N1)**

- **Де:**
  - `lifecycle.ts:180-222`: `settleElsewhere` у момент кліку бере **всі** поточні `unsentProductionOf`;
  - `api/ucet/zrusit/evidovano-jinak/route.ts:10-11`: тіло лише `{ confirm }`;
  - `setup-app.tsx`, `ClosedAccountBanner`: «всіх N» — лічильник із завантаження сторінки.
- **Сценарій:**
  1. Рахунок закрито з 1 невідправленою ostrou tržbou. Власник у налаштуваннях бачить «1».
  2. Офлайн-каса (до 30-го дня) довозить ще одну тржбу, продану до закриття. Вона стає `queued` і блокується `CERT_MISSING`. Власнику не йде жодного листа: reminders закриті рахунки пропускають.
  3. Власник тисне «Evidováno jinak» і підтверджує «všech 1». Результат: `{ sales: 2 }`. Друга тржба отримує `settled_elsewhere_at` і рядок аудиту «vlastník …: evidováno jinak».
  4. Листи 30/55 уже не йдуть (n = 0). На +31 d рахунок видаляється разом із тржбою, яку ніхто ніде не евідував, а аудит каже, що власник її підтвердив.
- **Додатково:** `unsentProductionOf` обмежено 500 рядками (`lifecycle.ts:121,126`), тож «všech N» і фактичне позначення можуть розходитися й у протилежний бік.
- **Виправлення:**
  - UI передає те, що показав: `ids` (або `seenAt` + `count`);
  - сервер позначає лише ці id. Якщо невідправлених тепер більше — 409 зі свіжим списком;
  - бажано: лист власнику закритого рахунку, коли надійшла нова невідправлена ostrá tržba (або хоча б показати її в банері до кліку).
- **Гейт (червоний до коду):** сценарій N1 → `settleElsewhere({ ids: [A] })` → у B немає `settled_elsewhere_at`, `runRetention(+31 d)` → `accountsHeld: 1`. Виклик без `ids`, коли набір змінився, → 409.

**N2. Vratka приймається в іншому режимі, ніж оригінал (інваріант 2; підтверджено N5; правову частину — перевірити)**

- **Де:**
  - `sales.ts:105-113`: `checkStaffAndRefund` порівнює суми з `original`, але не `original.mode`;
  - каса пропонує «Vrátit» для будь-якої тржби історії (`receipt-view.tsx:171`), а vratka береться в поточному режимі рахунку (`sale-factory.ts:51,72`);
  - межа R6.9 це не ловить: `original.evidencedTotal` рахується незалежно від режиму.
- **Сценарій:**
  1. Тржбу продано в Playground (чи mock) 28. 12.
  2. 1. 1. рахунок переходить у production.
  3. 3. 1. zákazník vrací zboží → vratka `mode='production'`, evidencedTotal −350 Kč.
  4. У FS іде záporná tržba до тржби, якої ostré prostředí ніколи не отримало.

  Найімовірніше це трапиться в перші дні після 1. 11. 2026 / 1. 1. 2027.
- **Перевірити з poradcem / FS:** чи евідується vratka до neevidované tržby. За практикою EET 1.0 — ні; для 2.0 не підтверджено.
- **Виправлення (консервативне):**
  - сервер: `original.mode !== input.mode` → карантин `REFUND_MODE_MISMATCH`, рішення за власником;
  - каса: для тржби іншого режиму кнопку vratky ховати або попереджати.
- **Гейт:** N5 → `quarantined: true`, `code: REFUND_MODE_MISMATCH`, рядка в `sales` немає. Контроль: той самий режим → `ok`.

### Дрібне

1. **N3 · R6.11 fail-closed неповний** (`fiscal.ts:189-192`; підтверджено N3).
   - `Date.parse("1")` = 2001, `"0"` = 2000, `"2026"` = 1. 1. 2026 → перевірка `PRODUCTION_NOT_OPEN` і 400 у `setEetMode` фактично вимкнені. Типова помилка оператора — `EET_PRODUCTION_ACCEPTS_FROM=1` як «прапорець».
   - **Виправлення:** приймати лише повний ISO-8601 з часом і зсувом (`/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(Z|[+-]\d{2}:\d{2})$/`). У `NODE_ENV=production` — `max(env, константа)`: env може дату лише відсунути.
   - **Гейт:** env `"1"` → `productionAcceptsFrom()` = константа; production-тржба 20. 10. → `PRODUCTION_NOT_OPEN`.
2. **N4 · звичайна тржба з від'ємним платежем приймається** (`sales.ts:110` перевіряє знак лише у vratky; підтверджено N4).
   - `lines +1 000`, `payments [cash −500, gift_voucher +1 500]` → `ok`, `evidencedTotal −500`. FS отримає від'ємну `celk_trzba` для продажу.
   - Каса так не вміє (`splitPayments` вимагає частини > 0), лише клієнт із токеном пристрою.
   - **Виправлення:** для тржби без `refundOf` — `payments.every(p => p.amount >= 0)`, інакше `INVALID_SALE` (карантин).
   - **Гейт:** N4 → `quarantined`, `INVALID_SALE`.
3. **N6 · решта після розділеної оплати рахується від усієї суми** (не фіскальне, але гроші касира і текст dokladu).
   - **Де:**
     - `receipt-view.tsx:87`: `sale.cashReceived - sale.total`;
     - `fiscal-core/src/receipt.ts:116-118`: те саме.
     - Вікно оплати рахує правильно: `receivedH − due` (`payment-sheet.tsx:56`), а `cashReceived` — гроші лише на останню (готівкову) частину (`payment-sheet.tsx:103`).
   - **Сценарій:** 1 000 Kč = poukaz 500 + hotově 500, zákazník dá 2 000.
     - У вікні оплати — «Vrátit 1 500».
     - Після оплати на екрані й на dokladu — «Vrátit/Vráceno 1 000».
     - Дасть 1 000 — решта (500) не показується взагалі.
   - **Виправлення:** решта = `cashReceived −` сума останнього готівкового рядка (або зберігати `cashDue`). Те саме в `receiptText`.
   - **Гейт:** `payments [gift 50000, cash 50000]`, `cashReceived 200000` → «Vráceno 1 500,00 Kč» і на екрані, і в тексті dokladu.
4. **N7 · MODE_MISMATCH-карантин з `payload.mode='mock'` на production-рахунку не тримає рахунок** (`lifecycle.ts:122-126,254-257`; підтверджено N2 у чернетці).
   - Саме ці тржби R5.1 вважає потенційно справжніми (каса зі старою конфігурацією).
   - Після `closeAccount(confirm)` лист дня 0 каже «Neodeslané ostré tržby nemá», а на +31 d рахунок видаляється з відкритим карантином.
   - **Виправлення:** відкритий `reason_code='MODE_MISMATCH'` на рахунку з `eet_mode='production'` вважати production. Або при карантині зберігати режим рахунку.
   - **Гейт:** чернетка N2 → `accountsHeld: 1` на +31 d, у листі «1× tržba v karanténě».
5. **N8 · закритий рахунок отримує й листи карантину з хибною обіцянкою** (`quarantine.ts:63-75`).
   - `ACCOUNT_CLOSED` (та інші причини) шле «Tržba čeká na vaše rozhodnutí… dokud ji nevyřídíte, Finanční správě se neodešle» — раз на годину на кожну нову тржбу.
   - Б7 обіцяє лише три підсумкові листи, а текст натякає, що тржбу ще можна відправити.
   - **Виправлення:** для закритого рахунку лист не слати (кількість карантину вже є в листах 30/55) або дати окремий текст.
   - **Гейт:** закритий рахунок + тржба після закриття → 0 листів `quarantine:*`.
6. **N9 · каса після 30-го дня показує неправду** (`pos-app.tsx:179-186`).
   - 401 → «Vlastník účtu zařízení odpojil v nastavení. Přihlaste se a zaregistrujte ho znovu.» Для закритого рахунку реєстрація неможлива.
   - Текст сервера «Účet je zrušený a pokladna je odpojená» (`auth.ts:166`) у `DeviceRevokedError` губиться.
   - Тржби лишаються в IndexedDB, втрати немає.
   - **Виправлення:** показувати `e.message` або окремий текст для закритого рахунку.
7. **N10 · R6.2 і повтор уже прийнятої тржби** (`sales.ts:149` стоїть до перевірки `known`).
   - Каса з годинником наперед (до 10 хв, `MAX_FUTURE_MS`) продала тржбу, сервер її прийняв, потім рахунок закрили. Повторний POST (каса не отримала відповідь) дає карантин `ACCOUNT_CLOSED` — дубль рядка, що вже є в `sales`.
   - Тримає рахунок (≤ 60 d) і плутає власника. Втрати немає.
   - **Виправлення:** перевірку `closedAt` пропускати, якщо `id` уже є в `sales` цього пристрою (як у MODE_MISMATCH).

### Перевірити (з коду не встановити)

- **N2:** чи евідується у EET 2.0 vratka до тржби, яка в ostrém prostředí не евідувалась (продаж до 1. 11. / 1. 1. або в Playgroundu). Від відповіді залежить, чи `REFUND_MODE_MISMATCH` має бути карантином, чи `not_required`.
- **Д-4** на справжньому Postgres (лишається з рецензії №3).
- **N1:** як часто офлайн-каси довозять старі тржби після закриття. Від цього залежить пріоритет N1, але не його правильність.
