# Рев'ю fiscal-зони EvidujZdarma (гілка claude/pensive-mayer-wcam12, HEAD c88e2fc)

Рецензент: read-only, 2.10.2026. Репозиторій не змінювався; усі прогони — у копії робоча копія рецензента.
Зона: `packages/fiscal-core/**`, `packages/db/src/schema.ts` + migrations (units/devices/certificates/sales),
`apps/web/src/lib/server/{fiscal,sales,receipts}.ts`, `apps/web/src/app/api/pokladna/*`, `api/ucet/{certifikat,overeni}`, `apps/worker`.

---

## Прогін

| Команда | Результат (дослівно) |
| --- | --- |
| `pnpm install --frozen-lockfile` | OK (141 пакет) |
| `pnpm -r --no-bail test` | `packages/cz`: **Tests 15 passed (15)**. `packages/fiscal-core`: **Test Files 1 failed \| 1 passed (2); Tests 14 passed (14)** — `FAIL test/eet2.test.ts [ test/eet2.test.ts ]  Error: ENOENT: no such file or directory, open '.../official/response-trust/playground/ica-public-rsa-06-2022.pem'` (❯ loadCert src/eet2/response.ts:83 ← defaultTrustPolicy :88 ← test/eet2.test.ts:154). Через це **жоден тест з eet2.test.ts (0 test) не виконався**, включно з усіма конформаційними. `apps/web`: **Tests 6 passed (6)**. Підсумок: `Summary: 1 fails, 2 passes`, exit 1. |
| те саме після ручного додавання 2 PEM I.CA (завантажені з URL з README, SHA-256 збігаються) | `packages/fiscal-core`: **Test Files 2 passed (2), Tests 32 passed (32)** (14 core + 18 eet2). |
| `pnpm -r --no-bail typecheck` | `cz` OK, `db` OK, `fiscal-core` OK. `apps/worker`: `error TS18003: No inputs were found in config file .../apps/worker/tsconfig.json` (у воркера **немає жодного файлу `src/`**). `apps/web`: 8× `error TS2304: Cannot find name 'PageProps' / 'LayoutProps' / 'RouteContext'` (kontrola-ico/page.tsx:13,38; (site)/layout.tsx:4; navody/[slug]/page.tsx:19,34; registrace/potvrzeni/page.tsx:46; api/ico/[ico]/route.ts:6; app/layout.tsx:32). Після `npx next typegen` → `tsc --noEmit` exit 0. Підсумок: `2 fails, 3 passes`. |
| `npx drizzle-kit generate` (копія) | `No schema changes, nothing to migrate` — schema.ts і міграції без дрейфу. |
| `next build` (Turbopack, Next 16.3.8) + `node .next/standalone/apps/web/server.js` + debug-роут | див. Критичне К1 — збірка ламає завантаження кореневих сертифікатів. |

Власні перевірки (артефакти в `work-fiscal/packages/fiscal-core/rv/`, `(робоча копія рецензента)`, БД `ez_review` у локальному Postgres 16):
- XSD: 7 згенерованих повідомлень + офіційний зразок провалідовано lxml/libxml2 проти `official/eet-v4_1/EETXMLSchema.xsd` → усі OK.
- Підпис: незалежна exc-c14n (libxml2) + `openssl dgst -sha256 -verify` для всіх 7 конвертів і офіційного зразка → digest збігається, `Verified OK`.
- Відповідь Playground: незалежна c14n + openssl → `Verified OK`; ланцюжок `openssl verify -attime 2026-07-21` → OK.
- XSW-атаки на `verifyResponse` (8 сценаріїв), DB-сценарії черги (T1–T7) з реальним Postgres і підміненим `fetch`.

---

## Критичне

### К1. У зібраному застосунку (next build / next dev) перевірка відповіді FS завжди падає → жодного POK, нескінченне повторне надсилання кожної тржби
- **Де:** `packages/fiscal-core/src/eet2/response.ts:82-90` (`loadCert(relPath)` → `readFileSync(new URL(\`../../official/response-trust/${relPath}\`, import.meta.url))`) + `src/eet2/client.ts:121-124` (`INVALID_RESPONSE` → `retryable: true`).
- **Що не так:** Turbopack компілює динамічний `new URL(template, import.meta.url)` в **одне фіксоване посилання на asset**, параметр `relPath` ігнорується. Скомпільований код: `function c(r){return new t.X509Certificate((0,i.readFileSync)(new URL(e.R(28597))))}` — `r` не використовується.
- **Відтворення:** у копії додано роут `src/app/api/rv-debug/route.ts`, що повертає `defaultTrustPolicy(env).chain` і `verifyResponse(playground-accepted.xml)`.
  - `next build` + standalone server (з PEM-файлами): `{"playground":["CN=I.CA Public CA/RSA 06/2022","CN=I.CA Public CA/RSA 06/2022"],"production":["CN=I.CA Public CA/RSA 06/2022","CN=I.CA Public CA/RSA 06/2022"],"verifyPlaygroundFixture":"invalid: neplatný řetězec CA"}`
  - `next dev`, стан репозиторію (PEM відсутні): обидва середовища = `["CN=NCA Root CA/RSA 10/2023","CN=NCA Root CA/RSA 10/2023"]`, `"invalid: podpisový certifikát nevydala očekávaná CA"`.
  - Vitest цього не бачить, бо запускає вихідний TS без бандлера.
- **Наслідок:** кожна справжня підписана `Potvrzeni` від FS → `invalid` → `INVALID_RESPONSE` (retryable) → статус `queued` → повтор кожні ≤15 хв **назавжди**, щоразу з новим `uuid_zpravy` і `prvni_zaslani=false`. FS отримує ту саму тржбу десятки разів на добу; користувач не бачить POK. До того ж `/api/ucet/overeni` «проходить», бо відповідь в ověřovacím režimu — непідписана `Chyba kod=0` і ланцюжок не перевіряється → власник бачить «ověřeno», а ostrý provoz не працює.
- **Як виправити:** (1) прибрати runtime-читання файлів: вбудувати 4 сертифікати як PEM-рядки в `.ts`-модуль (`official/response-trust/anchors.ts`, згенерований скриптом із перевіркою SHA-256) або 4 окремі **статичні** `new URL("…/nca-root-rsa-10-2023.der", import.meta.url)`; (2) у `defaultTrustPolicy` перевіряти `intermediate.checkIssued(root) && intermediate.verify(root.publicKey)` і кидати помилку при старті (fail fast); (3) smoke-тест на зібраному бандлі (`next build && next start` + виклик внутрішнього self-check роуту з fixture) у CI; (4) див. В5 — обмежити кількість повторів при `INVALID_RESPONSE`.

### К2. Режим (mock/playground/production) береться з акаунта в момент відправки, а не з тржби → тестові тржби йдуть у продукцію, а реальні отримують фейковий POK
- **Де:** `apps/web/src/lib/server/fiscal.ts:87-95` (`transportFor(account)`), `:169-171` (використовується `acc`, а `claimed.mode` ігнорується), `apps/web/src/lib/server/account.ts:126-146` (`setEetMode` не перевіряє чергу); `fiscal.ts:118-133` (`applyResult` не порівнює `result.test` з режимом тржби).
- **Відтворення (реальний Postgres, `rv-web-tests/queue.test.ts`):**
  - T1: акаунт `playground`, тржба `P1-AAAA-000001` не відправилась (мережа) → `setEetMode(production)` → `processPending()` → POST на `https://trzbyeet.gov.cz/eet/services/EETServiceSOAP/v4`, тіло містить `porad_cis="P1-AAAA-000001"`, `prvni_zaslani="false"`. Тестова тржба потрапляє в ostrý systém FS під EIČ клієнта. (Те саме для тржб, створених у mock, — у них `fs_unit_id = 1`, `sales.ts:78,101`.)
  - T2: акаунт `production`, тржба в черзі → `setEetMode(mock)` → `processPending()` → `status: confirmed`, `POK: b75bb2ce-…-ff`, `sale.mode: production`. Реальна тржба **ніколи не дійде до FS**, а в системі (і на účtenka, `receipts.ts:44`) значиться як потверджена → ризик pokuty до 500 000 Kč.
- **Як виправити:** транспорт вибирати за `sale.mode` (зберігати `playground|production|mock` у рядку — це вже робиться в `sales.ts:115`), а не за акаунтом; у `processSale` відмовляти, якщо `sale.mode !== accountMode(acc)` (статус `blocked` + сповіщення); у `setEetMode` забороняти перемикання, поки є `queued/sending` тржби (або явне «відкинути тестові» тільки для mock/playground); у `applyResult` для `mode=production` вимагати `result.test === false` і POK без `-ff`; MockTransport ніколи не повинен обслуговувати рядок з `mode='production'`.

### К3. Статус `rejected` — кінцевий і надто широкий: тимчасові збої назавжди «ховають» тржбу
- **Де:** `packages/fiscal-core/src/eet2/client.ts:90-94` — будь-який виняток у `credential()`/підготовці → `retryable: false, code: "PREPARE"`; `client.ts:116-118` — HTTP 3xx/4xx (крім 408/429) без `Odpoved` → неповторювана; `client.ts:126-130` — усі додатні коди `Chyba` → неповторювані; `apps/web/src/lib/server/fiscal.ts:138` → `status: "rejected"`. Жоден код не повертає `rejected` у чергу; `reminders.ts:55-59` нагадує лише про `queued`; UI не існує.
- **Відтворення:** T4 — сертифікат прострочений → `processSale` → `status: rejected, lastError: "PREPARE: Chybí platný pokladní certifikát"`; після завантаження нового сертифіката `processPending()` → `{"processed":0}`, статус лишається `rejected`.
- **Тригери в реальності:** прострочений/відсутній сертифікат, `MASTER_KEY` не задано після деплою, тимчасова помилка БД у `loadCredential` (`fiscal.ts:66-85`), невалідний EIČ у налаштуваннях, 302/403/404 від проксі/WAF/maintenance-сторінки, `Chyba` з кодом, який у EET 2.0 насправді тимчасовий (класифікація «від'ємний = тимчасовий» взята з EET 1.0 — `client.ts:72-76` сам це визнає).
- **Як виправити:** розділити `PREPARE` на «помилка даних тржби» (rejected) і «помилка інфраструктури/сертифіката» (`queued` + `blocked_reason`, повтор після усунення); 3xx/401/403/404/5xx без валідного `Odpoved` — повторювані; для `rejected` — нагадування власнику (email одразу + щодня), API «повторити» після виправлення налаштувань (дані тржби й `porad_cis` не змінюються), автоматичний requeue `rejected(PREPARE)` після `storeCertificate`/зміни EIČ.

### К4. Воркера немає → черга повторів і нагадування ніколи не запускаються
- **Де:** `apps/worker/package.json` (`"start": "tsx src/index.ts"`, `"ares:sync": "tsx src/ares-sync.ts"`), але `apps/worker/src/` не існує в жодному коміті (`git log --all -- apps/worker` → лише package.json і tsconfig.json). `apps/web/src/app/api/internal/cron/route.ts:9-10` пише «volá worker každou minutu» — нікому. `CRON_SECRET` відсутній у `.env.example`.
- **Наслідок:** тржба, перша спроба якої не вдалась (FS недоступна, timeout), повториться лише тоді, коли пристрій повторно надішле той самий `id` у `POST /api/pokladna/sales` (`route.ts:22-27` обробляє тільки щойно надіслані id). Чи робить це клієнт — перевірити неможливо: POS-клієнта в репозиторії немає. Нагадування про 48 год і про сертифікат (`runReminders`, лише з `?reminders=1`) теж не викликаються. Ризик: тржба не відправлена в 48 год → pokuta.
- **Як виправити:** реалізувати `apps/worker/src/index.ts` (цикл кожні 60 с: `POST /api/internal/cron`, раз на годину з `reminders=1`; або напряму `processPending` з `@ez/db`), healthcheck/alert «черга старша за N хв», додати `CRON_SECRET` у `.env.example`, і деплой-інструкцію.

---

## Важливе

### В1. Playground-кореневі сертифікати не в git через `.gitignore` → тести червоні, конформаційні тести не виконуються, Playground не працює в непобандленому рантаймі
- **Де:** `.gitignore:12` `*.pem` ігнорує `packages/fiscal-core/official/response-trust/playground/ica-*.pem` (`git check-ignore -v` → `.gitignore:12:*.pem`). README (`official/README.md:12-13`) їх перелічує, `response.ts:88` їх читає.
- **Наслідок:** `pnpm -r test` червоний; 18 тестів eet2 (включно з «conformance with the official signed FS sample» і всією перевіркою відповідей) **не запускаються**; у tsx/worker-рантаймі `new Eet2Transport({environment:"playground"})` кидає ENOENT → `processSale` ловить як `INTERNAL` → вічний `queued`.
- **Виправлення:** `!packages/fiscal-core/official/**/*.pem` у `.gitignore` (або зберігати як `.crt`/вбудувати в `.ts`, див. К1); у CI перевіряти SHA-256 з README.

### В2. Інжест відкидає тржби, нічого не зберігаючи → тржба існує лише в пристрої
- **Де:** `apps/web/src/lib/server/sales.ts:68-72` (`> 10 min` у майбутньому, `> 45 dní` у минулому, невідома jednotka, jednotka без `fsUnitId` у не-mock режимі), `:121-129` (конфлікт `porad_cis`), `:132-137` → `ok:false`, у БД нічого.
- **Чому:** закон вимагає відправити кожну evidovanou тržbu; неправильний годинник пристрою (+11 хв), пристрій офлайн > 45 днів, видалена/змінена jednotka або дубль лічильника в двох вкладках → сервер повертає помилку, і якщо клієнт її «показав і забув» — тржба втрачена. Клієнта в репо немає — поведінку перевірити не можна.
- **Виправлення:** такі тржби зберігати в `sales` зі статусом `needs_review` (або окремій таблиці карантину) з оригінальним payload, сповіщати власника, не відкидати мовчки; ліміти часу — лише як прапорець.

### В3. Знижка на позицію з `qty ≠ 1` губить `kind: "prepayment"` → не відправляється `urceno_cerp_zuct`
- **Де:** `packages/fiscal-core/src/sale.ts:137` (новий об'єкт без `kind`).
- **Відтворення:** 2× «Poukaz» по 500 Kč, `kind:"prepayment"`, знижка 100 Kč → `lines: [{"name":"Poukaz (2×, po slevě)","qty":1,"unitPrice":90000,"vatRate":0}]`, `evidencedAmounts → {"total":90000,"prepayment":0}`; без знижки → `prepayment:100000`.
- **Виправлення:** зберігати `kind` (`{ ...l, name, qty:1, unitPrice:newTotal }`), тест на це.

### В4. Підписувач відповіді не запінений: прийметься будь-який сертифікат від I.CA Public CA / NCA SubCA2; немає перевірки EKU/відкликання
- **Де:** `packages/fiscal-core/src/eet2/response.ts:92-101` (лише `checkIssued`+`verify`+дати), `:181` (subject лише повертається).
- **Чому:** справжній підписувач Playground — `CN=NEOSTRE - playground prostredi EET, O=Generální finanční ředitelství, organizationIdentifier=NTRCZ-72080043`, виданий **I.CA Public CA/RSA 06/2022** (EKU: E-mail Protection, TLS Client Auth) — це публічна кваліфікована CA, сертифікат від неї може купити будь-хто. Для продукції припущено NCA SubCA2 (теж видає сертифікати багатьом органам). Разом з MITM на TLS (корпоративний проксі, скомпрометований CA) — можна підробити POK. CRL/OCSP не перевіряються.
- **Виправлення:** пінити `organizationIdentifier = NTRCZ-72080043` (+ O / CN-префікс) підписувача, опційно SPKI-пін зі списком ротації; перевіряти keyUsage digitalSignature; відкликання — хоча б періодичний CRL I.CA/NCA у воркері.

### В5. `INVALID_RESPONSE` повторюється без кінця; неперевірені припущення про продукцію
- **Де:** `client.ts:121-124`; `response.ts:86-90` (продукція = NCA SubCA2 — **не підтверджено жодною продукційною відповіддю**), `response.ts:177-179` (у продукції POK не може закінчуватись на `-ff`; якщо 2 hex-символи — контрольні/випадкові, ~1/256 справжніх потверджень буде відкинуто).
- **Чому:** будь-яка розбіжність перевірки (інша CA, ротація сертифіката FS, помилка К1) → FS уже прийняла тржбу, а ми шлемо її знову й знову з новим uuid. Наслідок — дублі у FS і жодного POK.
- **Виправлення:** після 2–3 `INVALID_RESPONSE` поспіль переводити тржбу в `needs_review` + алерт оператору (не користувачу); зберігати сиру відповідь; для продукції покладатися на `test="false"`, а «-ff» перевіряти лише після підтвердження семантики в EET_popis_rozhrani_v1.2; продукційну котву звірити в пілоті (січень 2027).

### В6. Гонка: запізнілий результат «простроченого» claim перезаписує `confirmed` → повторне надсилання вже потвердженої тржби
- **Де:** `apps/web/src/lib/server/fiscal.ts:118-147` (`applyResult` оновлює `where id = …` без умови на `status='sending'`/номер спроби), `:182-186` (reset `sending → queued` через 2 хв).
- **Відтворення (T3):** процес A заклеймив тржбу і «завис» > 2 хв → `processPending` скинув claim, процес B отримав POK `91616ac4-…-ff` → `confirmed`; A завершується мережевою помилкою → `status: queued, POK: 91616ac4-…-ff, attempts: 2` → наступний cron надішле її втретє.
- **Тригери:** зависання процесу (GC, freeze serverless/VM), `EET_TIMEOUT_MS` > 120 000 (`fiscal.ts:93`, не обмежено), повільний `loadCredential`. Імовірність низька, наслідок — дубль.
- **Виправлення:** `applyResult … WHERE id=? AND status='sending' AND attempts=<claimed.attempts>` (claim-token); не понижувати `confirmed` ніколи; таймаут транспорту жорстко ≤ 30 с і < stale-порогу.

### В7. Імпорт сертифіката: перевірка EIČ «fail-open», немає перевірки середовища/видавця, неатомарна заміна
- **Де:** `apps/web/src/app/api/ucet/certifikat/route.ts:31-35` — якщо `cert.info.dic === null` (EIČ не знайдено регекспом `CZ\d{8,10}` у CN/serialNumber, `p12.ts:64-69`), перевірка просто пропускається; `route.ts:16` — середовище з форми, за замовчуванням `production`, видавець не перевіряється (тестовий сертифікат Playground має issuer `playground EETv2 NCA SubCA RSA 05/2026` — легко відрізнити); `fiscal.ts:38-58` — старі сертифікати відкликаються **до** insert нового без транзакції; `fiscal.ts:70-78` — `loadCredential` не перевіряє `validFrom` (маршрут пропускає `validFrom` до +24 год).
- **Наслідок:** чужий/тестовий/самопідписаний сертифікат в режимі production → FS відкидає → з К3 → усі тржби `rejected`. Падіння insert → акаунт без сертифіката → те саме.
- **Виправлення:** якщо EIČ не витягнуто — відмова (або явне підтвердження); перевірка issuer ↔ середовище; транзакція revoke+insert; `validFrom <= now` у `loadCredential`; обов'язкове успішне `overeni` перед `setEetMode('production')` і після заміни сертифіката.

### В8. Пропускна здатність черги: послідовна обробка, 100 × 10 с при `maxDuration = 120`
- **Де:** `apps/web/src/app/api/internal/cron/route.ts:7,20`; `fiscal.ts:180-199` (послідовний цикл).
- **Чому:** під час деградації FS (timeouts) один запуск cron встигає ~12 тржб, після чого платформа вбиває функцію, залишаючи `sending` (скидається через 2 хв). Для всієї платформи це ~12 тржб/хв → великий беклог після збою FS може не вкластися в 48 год.
- **Виправлення:** паралелізм з лімітом (напр. 10–20 одночасно), `FOR UPDATE SKIP LOCKED`-claim пачкою, бюджет часу як у `POST /sales`, справедливість між акаунтами, метрика віку найстаршої `queued`.

### В9. Дані повторної спроби не «заморожені»
- **Де:** `fiscal.ts:99-115` (повідомлення щоразу перебудовується з рядка через поточний код `buildSale/evidencedAmounts`), `fiscal.ts:169` (`eic = acc.eic ?? acc.dic` — поточне значення акаунта).
- **Чому:** зміна EIČ у налаштуваннях або деплой зі зміненою логікою `EVIDENCED_METHODS`/ваучерів між спробами → той самий `porad_cis` піде з іншим `eic_popl`/`celk_trzba`. `sales.evidencedTotal/prepaymentAmount/redeemedAmount` зберігаються, але не використовуються для відправки.
- **Виправлення:** при ingest або першій підготовці зберігати знімок `EetData` (JSON) і всі повтори будувати лише з нього.

### В10. Немає захисту рівня деплою від продукції
- **Де:** `.env.example:16-19` (`EET_ENVIRONMENT=mock`, `EET_ENDPOINT_*`) — **ніде в коді не читаються** (grep).
- **Чому:** оператор вважає, що `EET_ENVIRONMENT=mock` на staging блокує FS, але staging з копією продукційної БД і `MASTER_KEY` через cron відправить реальні тржби в продукцію (або повторно).
- **Виправлення:** `EET_ALLOWED_ENVIRONMENTS` (напр. `mock,playground` для staging), перевірка в `transportFor`; прибрати мертві змінні.

### В11. DoS через PKCS#12 з величезною кількістю ітерацій (блокує event loop і, отже, відправку всіх тржб у процесі)
- **Де:** `packages/fiscal-core/src/p12.ts:37` (`pkcs12FromAsn1` — синхронний JS PBKDF у node-forge), `certifikat/route.ts:18` (обмежено лише розмір 64 KB).
- **Виміряно:** 200 000 ітерацій → парсинг з неправильним паролем 365 мс; лінійно → 2^31 ітерацій ≈ 1 год блокування (екстраполяція, не запускав). Потрібен лише безкоштовний акаунт.
- **Виправлення:** перед парсингом прочитати ASN.1 `macData.iterations` / PBE-параметри і відхиляти > 1 000 000; або парсити у worker_thread з таймаутом.

### В12. Нагадування: не бачать `rejected`/`sending`, після дедлайну спамлять щогодини, не викликаються
- **Де:** `apps/web/src/lib/server/reminders.ts:55-59` (тільки `queued`, умова `deadlineAt <= now+12h` включає всі прострочені назавжди), `:65` (dedupe по годині), `:31` (сертифікат — лише production). Плюс К4 (ніхто не викликає).
- **Виправлення:** окремі шаблони: «наближається 48 год», «48 год минуло» (одноразово + щоденно), «rejected — потрібна дія»; нагадування про Playground-сертифікат не потрібне, але про production — і за 30/7/1 день.

### В13. Немає аудиту спроб
- **Де:** `fiscal.ts:118-147` зберігає лише `lastMessageUuid`; хук `onPrepared` (`client.ts:68-69, 95`) не використовується; `dat_prij` і підписана відповідь не зберігаються.
- **Чому:** при спорі з FS (чи відправлено в 48 год, чи не було дубля) немає доказів: усіх `uuid_zpravy`, SHA-256 запитів, підписаної відповіді з POK.
- **Виправлення:** таблиця `sale_attempts` (uuid, sha256 запиту, час, HTTP-статус, код, сира відповідь/її хеш, `dat_prij`).

---

## Дрібне

1. `response.ts:148` — бере перший `soapenv:Body` у документі, а не дочірній `Envelope/Body`; `:163` перевіряє тільки SignatureMethod, не DigestMethod/c14n-алгоритм. (XSW-тести показали, що підробити POK не можна, бо дані читаються з підписаного вмісту, — це лише надійність.)
2. `response.ts:130-133` — непідписана `Chyba` оцінюється **до** підпису: MITM, додавши `<Odpoved><Chyba kod="5">` у Header поруч зі справжньою підписаною `Potvrzeni`, отримує `error` (тест D) → з К3 тржба стає `rejected`, хоча FS її прийняла. Якщо є валідний підписаний Body — пріоритет йому.
3. `envelope.ts:34-36` — `createDecipheriv` без `{ authTagLength: 16 }` і без перевірки довжини sealed (Node приймає скорочені теги); AAD не містить id сертифіката/середовища (можна переставити шифротексти між рядками одного акаунта).
4. `p12.ts:61` — якщо жоден сертифікат не відповідає ключу, береться `certs[0]` → збережеться пара ключ/сертифікат, що не збігаються. Має бути помилка.
5. `money.ts:14` — `toHalere("1.005") = 100` (float); використовувати десятковий парсинг рядка.
6. `sales.ts:21` дозволяє рядок до 10^12 Kč, XSD — `< 100 000 000` (`message.ts:64`) → тржба пройде ingest і стане `rejected` при підготовці. Валідувати межу на ingest.
7. `fiscal.ts:143,165` — `firstSentAt` ставиться навіть коли нічого не відправлено (PREPARE/INTERNAL) → перша реальна відправка піде з `prvni_zaslani=false`.
8. `fiscal.ts:155-159` — claim не перевіряє `nextAttemptAt` → повторний sync пристрою обходить backoff; дві паралельні cron-ітерації можуть повторити тржбу одразу після невдачі.
9. `schema.ts` `attempts smallint` — переповнення після ~32 767 спроб (~341 день по 15 хв) зламає claim і зупинить увесь `processPending` (виняток не ловиться в циклі).
10. `sales.ts:121-130` — той самий `id` з іншим вмістом → `ok:true`, дані тихо старі (T5: друга відповідь ok, `stored total 10000`). Порівнювати хеш і повертати конфлікт.
11. `sales.ts` не перевіряє, що `sequence` починається з поточного `device.sequencePrefix` — захист від повтору `porad_cis` після перевстановлення повністю на клієнті.
12. `receipts.ts:45` — URL `/u/{id}` не має роуту в `apps/web/src/app` (404); `securityCode` завжди `null` → на чеку тржби в черзі нічого не друкується про стан.
13. `overeni/route.ts:37-38` — у mock режимі повертає `ok:true` (UI може показати «ověřeno»); немає rate-limit на виклики FS.
14. `apps/web/package.json` `typecheck` має бути `next typegen && tsc --noEmit`.
15. `Varovani` зберігаються, але ніде не показуються/не надсилаються власнику.
16. `fiscal.ts:93` — `EET_TIMEOUT_MS` без валідації (NaN → кожна спроба падає як NETWORK; велике значення → В6).
17. `sale.ts:93-99` — чайові дозволені на vratku (додатні чайові до від'ємної тржби).
18. `fiscal.ts:63-85` — розшифровані ключі в кеші процесу 5 хв (очікувано); `plain.fill(0)` косметичний, бо PEM живе як JS-рядок.

---

## Прийнято як є (перевірено)

- **Повідомлення vs XSD v4.1** (`message.ts`): усі обов'язкові атрибути (`uuid_zpravy`, `dat_odesl`, `prvni_zaslani`; `eic_popl`, `id_jednotky`, `id_pokl`, `porad_cis`, `dat_trzby`, `celk_trzba`), опційні лише якщо ненульові. Регекспи `message.ts:58-67` дослівно з XSD. `id_pokl` ≤ 20 (+ валідація при реєстрації пристрою `account.ts:157`), `porad_cis` ≤ 25 (zod + `SEQUENCE_RE`). Дати — UTC `Z` без мілісекунд (`formatEetDateTime`), Playground прийняв `Z` (fixture). Суми — 2 десяткові, мінус для vratky (`-123.45`, `-0.05` валідні). У FS не йде нічого поза XSD (DPH, položky, způsob platby). **Незалежна XSD-валідація (libxml2) 7 сценаріїв — OK.** У тестах репозиторію XSD-валідації немає — лише регекспи (рекомендую додати libxml-валідацію в CI).
- **Підпис WS-Security:** exc-c14n з `InclusiveNamespaces` (`soapenv v4` для SignedInfo, `v4` для Body), `rsa-sha256`, digest `sha256` над `soapenv:Body` за `wsu:Id`, BST + SecurityTokenReference — структура як в офіційному зразку. Незалежна c14n (libxml2) + openssl для всіх згенерованих конвертів → digest = DigestValue, підпис `Verified OK`.
- **Конформаційні тести не тавтологічні:** `eet2.test.ts:40-51` реконструюють повідомлення вручну і (а) порівнюють SHA-256 нашої канонічної форми з `DigestValue` з fixture, (б) перевіряють **офіційний** `SignatureValue` сертифікатом із fixture над нашою канонічною `SignedInfo`; плюс xml-crypto незалежно перевіряє наш конверт і tamper-тест. «Byte-exact» досягнуто на рівні канонічних форм (повний конверт синтаксично відрізняється — неважливо).
- **Провенанс:** SHA-256 XSD, WSDL, NCA `.der` збігаються з README; I.CA PEM, завантажені з URL README, — теж. Зразок запиту взято з `fakturaonline/ruby-eet2` (вторинне джерело), але fixture відповіді Playground **справді підписаний FS** (GFŘ, NTRCZ-72080043, ланцюжок до I.CA Root перевірено openssl) і містить той самий `uuid_zpravy 03965780-…` → Playground прийняв саме цей запит 21.7.2026. Сильний непрямий доказ.
- **Перевірка відповіді (у вихідному TS):** дані читаються лише з `getSignedReferences()` (xml-crypto 6.3.2); рівно один Signature і BST; захист від дубля Id; uuid; `test`/`-ff`; DTD заборонено; ліміт 256 KB. XSW-тести: перенесення підписаного Body у Header + підроблений Body → повертається **справжній** POK; дубль Id → invalid; підроблений Odpoved у Header → справжній POK; непідписаний Potvrzeni → invalid; коментар у Body → OK. Підроблений POK не пройшов жодного разу.
- **Envelope encryption:** AES-256-GCM, випадковий 96-біт IV на кожне шифрування, окремий випадковий DEK на секрет, AAD = `cert:<accountId>`, DEK-AAD = версія ключа; версіоновані `MASTER_KEY`, `MASTER_KEY_vN`, `MASTER_KEY_CURRENT` (ротація розшифрування є; утиліти перешифрування немає). Пароль `.p12` не зберігається. Приватний ключ не повертається API і не логуються в перевірених шляхах (`errorResponse` логує тільки неочікувані винятки без ключового матеріалу). Ключ розшифровується лише в `loadCredential` при відправці.
- **«Ключ лише на пристрої»:** у схемі є `certificates.storage` (`server | device`), але **жодного коду** для device-режиму — лише ідея.
- **Claim атомарний:** T6 — 3 паралельні `processSale` → 1 HTTP-запит, `attempts: 1`.
- **Повтори:** `prvni_zaslani=false` на повторах (перехоплено в T1); новий `uuid_zpravy` на кожну спробу — свідоме рішення (див. питання 1).
- **porad_cis:** унікальний `(device_id, sequence)`; `register_id` унікальний на акаунт; при кожній (пере)реєстрації пристрою новий випадковий префікс (`account.ts:165-167`) → після перевстановлення номери не повторюються (за умови, що клієнт бере новий префікс).
- **Межа 48 год:** `deadlineAt` зберігається; після 48 год тржба продовжує повторюватися (правильно — краще пізно, ніж ніколи).
- **Схема/міграції:** без дрейфу; індекси черги `(status, next_attempt_at)`.

---

## Питання до власника/контролера

1. **uuid_zpravy при повторі.** Код навмисно генерує **новий** uuid на кожну спробу (`queue.ts:6-7`, `client.ts:4,43`), а ваша специфікація каже «той самий uuid». Треба звірити з `EET_popis_rozhrani_v1.2.pdf` (його немає в репо): за чим FS розпізнає дубль — за uuid чи за (EIČ, id_pokl, porad_cis)? Від цього залежить, чи кожен повтор після втраченої відповіді не створює дубль у FS.
2. **Ваучери/стравенки.** Будь-яка оплата `voucher` вважається `cerp_zuct` (`sale.ts:158`). Stravenky/дарункові картки третіх осіб — evidovaná tržba, але не «čerpání zálohy». Потрібен окремий спосіб оплати чи рішення податкового консультанта; також — чи `celk_trzba` має включати суму `cerp_zuct` (зараз включає).
3. **Чайові** входять у `celk_trzba`, якщо сплачені evidovaným способом. Підтвердити.
4. **Коди помилок і продукційна відповідь:** класифікація кодів (від'ємні = тимчасові) з EET 1.0; продукційний підписувач (NCA SubCA2?) і сенс суфікса POK — підтвердити за v1.2 або на першій пілотній відповіді в січні.
5. **Політика `rejected` і після 48 год:** чи дозволяємо власнику «повторити» після виправлення налаштувань (дані та porad_cis незмінні)? Хто й як сповіщається?
6. **Перемикання режиму з непорожньою чергою:** заборонити чи автоматично «прибирати» тестові тржби?
7. **Device-only ключ:** робимо в MVP чи знімаємо колонку `storage`?

## Не перевірено
- POS-клієнт (IndexedDB, лічильник porad_cis, дві вкладки, офлайн/онлайн) — у репозиторії відсутній.
- Реальні виклики Playground/продукції (gov.cz не використовувалися); `EET_popis_rozhrani_v1.2.pdf` недоступний.
- DoS із 2^31 ітерацій PKCS#12 не запускав (лише екстраполяція з 200 000).
- UI (сторінок `/pokladna` немає).

---

## Повторна перевірка на 575b631

Свіжа копія робоча копія рецензента (з клону контролера, HEAD 575b631; клон не змінювався). Сценарії T1–T7 повторено без змін у тестах на новому коді (нова БД `ez_review2`), додано T8–T10 (`work-fiscal2/apps/web/test/rv/offline-mode.test.ts`). Debug-роут для бандла — лише в копії (`work-fiscal2/apps/web/src/app/api/rv-debug/route.ts`).

### Прогін на 575b631
| Команда | Результат |
| --- | --- |
| `pnpm -r --no-bail test` | `packages/cz`: **Test Files 2 passed (2), Tests 29 passed (29)**. `packages/fiscal-core`: **Test Files 1 failed \| 2 passed (3); Tests 2 failed \| 35 passed (37)** — `FAIL test/trust-anchors.test.ts > embedded trust anchors > playgroundIntermediate matches official/response-trust/playground/ica-public-rsa-06-2022.pem` і `> playgroundRoot matches …ica-root-rsa-05-2022.pem`: `Error: ENOENT: no such file or directory` (trust-anchors.test.ts:16). `eet2.test.ts` тепер виконується повністю. `apps/web`: **Tests 6 passed (6)**. `Summary: 1 fails, 2 passes`. |
| `pnpm -r --no-bail typecheck` | `cz`, `db`, `fiscal-core`, **`apps/worker` — Done**. `apps/web`: **32× `error TS2304`** (`PageProps`/`LayoutProps`/`RouteContext`, напр. `src/app/(app)/u/[id]/page.tsx(12,55)`), інших помилок 0; після `npx next typegen` → `tsc --noEmit` exit 0. `Summary: 1 fails, 4 passes`. |
| `next build` + standalone `server.js` + debug-роут | `{"playground":["CN=I.CA Public CA/RSA 06/2022","CN=I.CA Root CA/RSA 05/2022"],"production":["CN=NCA SubCA2/RSA 12/2023","CN=NCA Root CA/RSA 10/2023"],"verifyPlaygroundFixture":"confirmed"}` |
| Вбудовані якорі vs офіційні файли | усі 4 `fingerprint256` збігаються (PEM I.CA з URL README, DER NCA з репо). |
| Воркер проти stub-сервера (`APP_INTERNAL_URL`, 64 с) | `+1.4s POST /api/internal/cron?reminders=1 auth=Bearer …`, `+61.4s POST /api/internal/cron`. |
| DB-сценарії T1–T10 | див. таблицю й нові пункти нижче. |

### Статуси попередніх пунктів
| # | Статус | Деталі (575b631) |
| --- | --- | --- |
| К1 | **виправлено** | `packages/fiscal-core/src/eet2/trust-anchors.ts` (PEM-константи) + `response.ts:82-86`; у зібраному standalone-бандлі ланцюжки правильні, справжня відповідь Playground → `confirmed`. Не зроблено: self-check ланцюжка при старті, smoke-тест бандла в CI; цикл `INVALID_RESPONSE` → див. В5. |
| К2 | **частково** | Черга сервера виправлена: `fiscal.ts:88-89,172` (`transportFor(acc, claimed.mode)`). T1: після перемикання playground→production тестова тржба йде на `https://pg.trzbyeet.gov.cz/…` (раніше — у продукцію). T2: після production→mock тржба лишається `queued, POK: null` (раніше — фейковий POK). **Відкрито:** офлайн-тржби отримують режим акаунта в момент інжесту — див. Н-К2 (T8/T9). `applyResult` (`fiscal.ts:119-148`) і далі не звіряє `result.test` з режимом. |
| К3 | **частково** | Виправлено: HTTP-відповідь без `Odpoved` (3xx/4xx/5xx, WAF, SOAP Fault) → retryable (`client.ts:113-124`, новий тест HTTP_403). **Відкрито:** `PREPARE` і далі `retryable:false` (`client.ts:93`), додатні коди `Chyba` — кінцеві (`client.ts:136`), `rejected` ніхто не повертає в чергу й не нагадує. T4 на 575b631: `rejected, "PREPARE: Chybí platný pokladní certifikát"`; після нового сертифіката `processPending → {"processed":0}`, статус `rejected`. До того ж клієнт тепер теж вважає `rejected` кінцевим (`sync.ts:110`, `db.ts:89`) і перестає опитувати. |
| К4 | **виправлено** | `apps/worker/src/index.ts:30-41,54-78`: цикл `POST {APP_INTERNAL_URL}/api/internal/cron` кожні ~60 с (наступний tick через `max(5 s, 60 s − тривалість)`), `?reminders=1` при зміні години (`getHours()` контейнера), timeout запиту 110 с, без `CRON_SECRET` → `exit(1)`; сервіс `worker` у `infra/docker-compose.yml` з `restart: unless-stopped`. Перевірено stub-сервером. Що робить cron — без змін: `processPending(100)` послідовно + `processOutbox(50)` + щогодини `runReminders()`. Алертингу при повторних збоях cron немає (лише лог). |
| В1 | **змінилось** | Рантайм більше не читає файли (якорі вбудовані) → Playground працює. Але `.gitignore:12 *.pem` без змін, PEM у git немає → новий `trust-anchors.test.ts` падає (2 failed, ENOENT) → `pnpm -r test` червоний. Виправлення те саме: `!packages/fiscal-core/official/**/*.pem` + закомітити 2 файли. |
| В2 | **відкрито, погіршилось** | `sales.ts:68-72,121-129` без змін; тепер клієнт робить таку тржбу остаточно `rejected` і більше не надсилає — див. Н-К1 (T10). |
| В3 | відкрито | `sale.ts:137` без змін; клієнтська vratka (`sale-factory.ts:73-94`) успадковує ту саму втрату `kind`. |
| В4 | відкрито | `response.ts:88-97` (`verifyChain`) без змін — немає піна субʼєкта GFŘ / EKU / відкликання. |
| В5 | відкрито, посилилось | `client.ts:129` (`INVALID_RESPONSE` → retryable) без змін; тепер кожна відкрита каса ще й ініціює повтор кожні 20 с (Н-В4). |
| В6 | відкрито | T3 на 575b631 той самий: `after B: confirmed POK 91616ac4…` → `after A's late result: status queued … attempts 2`. `fiscal.ts:119-148`, `:187`. |
| В7 | відкрито | `api/ucet/certifikat/route.ts` без змін (fail-open EIČ, середовище з форми, без перевірки issuer, неатомарна заміна). UI (`setup-app.tsx:329,366-368`) за замовчуванням пропонує «Ostrý certifikát». |
| В8 | змінилось | Cron тепер реально викликається щохвилини, але `processPending` і далі послідовний (100 × до 10 с). У docker `maxDuration=120` не діє; воркер обриває запит через 110 с і запускає наступний, поки попередній ще йде → паралельні цикли (дублю відправки не дають завдяки claim, але й не прискорюють). |
| В9 | відкрито | `fiscal.ts:100-116,170` без змін. |
| В10 | відкрито | `.env.example:16-19` (`EET_ENVIRONMENT`, `EET_ENDPOINT_*`) і далі не читаються; у `docker-compose.yml` немає обмеження середовищ для staging. |
| В11 | відкрито | `p12.ts` без змін. |
| В12 | відкрито, тепер діє | `reminders.ts` без змін, але тепер реально запускається щогодини → для кожної простроченої `queued` тржби лист **щогодини безстроково** (dedupe по годині, `reminders.ts:65`); для `rejected` — нічого. |
| В13 | відкрито | Аудиту спроб і збереження підписаної відповіді/`dat_prij` немає. |
| Дрібне 12 (`/u/{id}` 404) | виправлено | `src/app/(app)/u/[id]/page.tsx` існує, показує POK або «čeká», тестовий режим позначено. |
| Дрібне 8 (claim без `nextAttemptAt`) | посилилось | див. Н-В4. |
| Дрібне 10 (той самий id з іншим вмістом → ok) | відкрито | T5 на 575b631: обидві відповіді `ok:true`, `stored total 10000`. |
| Дрібне 14 (typecheck без typegen) | відкрито | 32× TS2304. |

### Нове — Критичне

**Н-К1. Будь-яка помилка інжесту стає на касі остаточним «Odmítnuto» → тржба не потрапляє на сервер і ніколи не відправляється в FS**
- **Де:** `apps/web/src/lib/pos/sync.ts:102-104` (`if (!r.ok) → status: "rejected"`), `db.ts:89` (`unsettledSales` бере лише `local|queued|sending|failed`), сервер `apps/web/src/lib/server/sales.ts:65-137` — увесь інжест однієї тржби в `try/catch`, тому `ok:false` повертається і для **тимчасової помилки БД** при insert (обрив зʼєднання, вичерпаний пул), і для годинника пристрою > 10 хв уперед (`:68`), офлайну > 45 днів (`:69`), jednotky без `fsUnitId` (`:72`), конфлікту `porad_cis` (`:121-129`).
- **Відтворення:** T10 — `soldAt = now + 11 min` → `[{"ok":false,"error":"Datum tržby je v budoucnosti – zkontrolujte čas v zařízení."}]`; клієнт за `sync.ts:103` ставить `rejected`, у БД сервера рядка немає. Кнопки «odeslat znovu» немає (`receipt-view.tsx:99` лише показує текст), денний підсумок такі тржби взагалі не рахує (`history-view.tsx:83`).
- **Наслідок:** гроші від клієнта отримані, тржба існує лише в IndexedDB із позначкою «Odmítnuto» і ніколи не дійде до FS → pokuta. Навіть після виправлення годинника чи налаштувань.
- **Виправлення:** сервер має повертати для кожної тржби `retryable: true|false` (помилки БД/інфраструктури — retryable або 5xx на весь запит). Клієнт не завершує тржбу на `ok:false` з retryable, повторює з backoff, дає кнопку «Odeslat znovu» після виправлення. Для перманентних — зберігати на сервері в карантині (`needs_review`) з payload, а не відкидати. Годинник: порівнювати з `Date` відповіді сервера і попереджати касира до продажу.

**Н-К2. (залишок К2) Офлайн-тржба отримує режим акаунта на момент синхронізації, а не на момент продажу**
- **Де:** клієнт зберігає `mode` (`sale-factory.ts:61`), але не надсилає його (`sync.ts:85-95`); сервер бере `accountMode(account)` при інжесті (`sales.ts:62,87,115`); `setEetMode` (`account.ts:126-146`) при переході в `mock` нічого не перевіряє.
- **Відтворення:**
  - T8: тржба зроблена в `production`, до синхронізації акаунт переключено в `mock` → `stored mode: mock, status: confirmed, POK: 250764fa-…-ff, HTTP calls to FS: 0`. На касі статус «Potvrzeno (POK)» з POK, а підказки «Ukázkový režim» немає (вона залежить від локального `mode = production`, `receipt-view.tsx:100`). Реальна тржба втрачена при видимості успіху.
  - T9: тржба зроблена в mock (каса показує «tržba se FS neodesílá»), акаунт переключено в production → `stored mode: production`, POST на `https://trzbyeet.gov.cz/…`.
- **Виправлення:** надсилати `mode` з тржбою; сервер зберігає саме його й відмовляє/карантинить при розбіжності з режимом акаунта; перехід `production → mock` — лише з явним підтвердженням і відображенням кількості неспарованих тржб на пристроях; в `applyResult` для `mode=production` вимагати `test=false`.

### Нове — Важливе

**Н-В1. IndexedDB без `navigator.storage.persist()`**
- **Де:** grep по `apps/web/src` — немає `storage.persist`. Офлайн-черга лежить у «best-effort» сховищі: Chrome чистить при нестачі місця, Safari — дані сайтів, які не встановлені як PWA, після 7 днів без взаємодії.
- **Наслідок:** невідправлені тржби зникають разом із лічильником. Імовірність низька, наслідок — втрата.
- **Виправлення:** викликати `persist()` при реєстрації пристрою; якщо не надано — попередження в налаштуваннях і статусі.

**Н-В2. Vratku однієї тржби можна зробити скільки завгодно разів, будь-яким касиром**
- **Де:** `receipt-view.tsx:145` перевіряє лише `!sale.refundOf && total > 0 && status !== "rejected"`; ні клієнт, ні сервер (`sales.ts`) не перевіряють, що для `refundOf` уже є vratka або що сума не перевищує оригінал; ролі не перевіряються.
- **Наслідок:** у FS ідуть повторні відʼємні тржби — занижена evidovaná tržba і канал зловживання з боку персоналу.
- **Виправлення:** на сервері унікальність або ліміт суми за `refund_of`; на касі ховати кнопку після повної vratky; vratka — лише для ролі owner або з PIN власника.

**Н-В3. Каса замовчує «Odmítnuto»**
- **Де:** `history-view.tsx:83` виключає `rejected` з денного підсумку й CSV; лічильник у статус-барі (`status-bar.tsx:32-33`) рахує лише неспаровані, тож при відхилених тржбах індикатор зелений «Online».
- **Наслідок:** розбіжність з готівкою в шухляді, власник не бачить проблему.
- **Виправлення:** окремий червоний лічильник «Odmítnuto» у статус-барі й підсумку, відхилені тржби в CSV з позначкою.

**Н-В4. Кожна відкрита каса кожні 20 с заново відправляє всі неспаровані тржби, і сервер для кожної одразу пробує FS в обхід backoff**
- **Де:** `sync.ts:145` (`setInterval 20 s`) + `unsettledSales` включає `queued` → `POST /api/pokladna/sales` → `route.ts:22-27` викликає `processSale` для кожної (claim не дивиться на `nextAttemptAt`).
- **Наслідок:** серверний backoff фактично не діє (кілька вкладок/пристроїв — кілька циклів); разом із В5 кількість повторів у FS множиться; при 500 офлайн-тржбах — 10 POST-пакетів кожні 20 с з повним payload.
- **Виправлення:** для тржб, які сервер уже прийняв (`syncedAt != null`), клієнт лише опитує статус через `GET /api/pokladna/sales?ids=` (уже існує); `processSale` з POST — тільки для щойно вставлених, і з умовою `nextAttemptAt <= now()`.

### Нове — Дрібне
1. `/u/[id]` (`page.tsx:112-114`) пише «Tržba čeká na potvrzení Finanční správou» і для `not_required`, і для `rejected`.
2. Після 48 год каса показує «Lhůta: 0 min» (`receipt-view.tsx:96`, `formatRemaining`), без явного «lhůta uplynula» і інструкції, що робити.
3. Mock-тржби мають чіп «Potvrzeno (POK)» (`ui.tsx:27`) з фейковим POK; відмінність лише в дрібній примітці.
4. `infra/docker-compose.yml:1-2` посилається на неіснуючий `.env.production.example`; у `.env.example` немає `CRON_SECRET` (генерується лише в `docs/deploy.md:42`).
5. Воркер не має алерту при повторних збоях cron (`index.ts:61-63` — лише лог); години нагадувань рахуються за часом контейнера.
6. «Odebrat registraci z tohoto zařízení» (`pos-app.tsx:177-181`) видаляє токен і конфігурацію, не попереджаючи, скільки в пристрої невідправлених тржб; до перереєстрації вони не синхронізуються.

### Прийнято як є (нове)
- **Лічильник `porad_cis`** (`db.ts:50-58`, `nextSequence`): get+put в одній `readwrite`-транзакції IndexedDB — атомарно між вкладками. При (пере)реєстрації сервер дає новий префікс, лічильник скидається (`setup-app.tsx:489`) → номери не повторюються після перевстановлення.
- **Збереження тржби:** вона пишеться в IndexedDB **до** спроби відправки (`sale-factory.ts:68`), id — `crypto.randomUUID()`, `soldAt` округлено до секунд; валідація тією самою `buildSale`, що й на сервері, до видачі номера.
- **Синхронізація:** паралельні sync в одній вкладці обʼєднуються (`sync.ts` `running`). Кілька вкладок безпечні для сервера (claim атомарний, T6: 1 HTTP); локальний статус може тимчасово «відкотитися» запізнілою відповіддю, але сам виправляється на наступному sync.
- **Service worker** не кешує `/api/*`; `/pokladna` — мережа, а при офлайні кеш.
- **Що бачить касир:** статус-бар показує кількість неспарованих тржб і час до 48 год найстаршої (`status-bar.tsx:50-89`); на чеку — чіп статусу, POK, «Odesílám…/Jste offline…» з лічильником, текст помилки для відхилених.
- **Чек `/u/[id]`:** POK, позначка тестового режиму, `noindex`.
- `receipt.ts` — лише форматування (рядок назва+сума, перенесення URL), на дані повідомлення FS не впливає.
