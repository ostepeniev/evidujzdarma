# Рецензія №3: безпека, приватність, зміст і право (R5.8, R5.11, R5.12, Ф9, R4 B/C)

Рецензент B, 3. 10. 2026. Лише читання: нічого не пушив і не комітив. Усі шляхи — відносно `apps/web/src/`, якщо не вказано інше.

## 1. Коміт, тести, аудит

- **Репозиторій:** `ostepeniev/evidujzdarma`, гілка `claude/pensive-mayer-wcam12`.
- **Коміт:** `68d09603d91d7dc6227b90ed12df3d2a8fd74ac3`. Це HEAD гілки на момент клонування, новіших комітів немає.
- **Діапазон:** `116790e..68d0960`, 45 комітів.
- **Як перевіряв:** читав код (file:line). Підозри, які можна відтворити, перевірив тестом-чернеткою на PGlite. Чернетку запускав у клоні й потім видалив; її копія лежить у [B-sec-content-r3.scratch.test.ts.txt](B-sec-content-r3.scratch.test.ts.txt). Усі 4 тести чернетки зелені, тобто всі чотири підозри підтверджено.

| Прогін | Результат |
| --- | --- |
| `corepack enable && pnpm install --frozen-lockfile` | OK (232 пакети) |
| `pnpm -r test` | `packages/cz` 29/29 (2 файли), `packages/fiscal-core` 90/90 (7 файлів), `apps/web` 267/267 (57 файлів, PGlite). **Разом 386/386, EXIT 0.** У `apps/worker` скрипта `test` немає. Пропущених немає: `age` в оточенні є |
| `pnpm -r typecheck` на чистому checkout (без `.next/` і `next-env.d.ts`) | EXIT 0. Web виконує `next typegen && tsc --noEmit` і пише «Types generated successfully» |
| `pnpm audit --prod` | **1 high:** `node-forge ≤1.4.0` (GHSA-86w9-cpqp-85rv), виправленої версії немає. Стан той самий, що в рецензії №2 (LATER) |

Логи: `review3/sec-test.log`, `review3/sec-typecheck.log`, `review3/sec-audit.log`.

---

## 2. Статуси пунктів

### R5.8 — закриття рахунку

| Пункт | Стан | Докази (file:line) | Коментар |
| --- | --- | --- | --- |
| 409, поки немає явного підтвердження | ✅ | `lib/server/lifecycle.ts:44-60` (`closureBlockers`), `:67-78`; `app/api/ucet/zrusit/route.ts:10-11`; `components/setup/setup-app.tsx:976-988`; гейт `test/integration/r5-8-close.test.ts:39-58` | Рахуються невідправлені тржби (`queued/sending/failed/rejected`, без mock) і відкритий карантин. Повертаються `pending`, `quarantine` і `devices` |
| Пристрої «лише на вивантаження» | ⚠️ | `lib/server/auth.ts:154-163`. `allowClosed` мають лише: `api/pokladna/sales/route.ts:14` (POST) і `:59` (GET), `api/pokladna/uzaverky/route.ts:14`, `api/pokladna/config/route.ts:13` (`closed: true` на `:46`). 403 дають `api/pokladna/pin/route.ts:17` і `api/pokladna/uctenka/route.ts:33`. Власник закритого рахунку не може імпортувати сертифікат (`lib/server/certificates.ts:47`), змінити режим (`lib/server/account.ts:168`) чи зареєструвати касу (`:203`) | Інших маршрутів із токеном пристрою немає: `/api/pokladna/*` — це 5 маршрутів, і всі розібрані. **Але сервер сам режим «лише вивантаження» не вимагає.** `ingestSales` (`lib/server/sales.ts:125-274`) не дивиться на `closedAt`, тож нові продажі після закриття приймаються. Зупиняє продаж лише клієнт (`lib/pos/sale-factory.ts:28`). Підтверджено чернеткою → **В3-1** |
| Retention тримає рахунки з непідтвердженими production-тржбами | ⚠️ | `lib/server/lifecycle.ts:110-130` | Дивиться лише в таблицю `sales`. Production-тржба у відкритому карантині (`sale_quarantine`, `onDelete: cascade`, `packages/db/src/schema.ts:455-457`) через 30 днів видаляється разом із рахунком. Підтверджено: `{"accounts":1,"accountsHeld":0}` → **В3-2** |
| Терміни čl. 11.3 відповідають коду (інваріант 10) | ⚠️ | `app/(site)/podminky/page.tsx:290-294` | «pokladny přestanou prodávat» тримається лише на клієнті (В3-1). «Účet s tržbami, které FS nepotvrdila, … nesmaže» не покриває карантин (В3-2) і Playground-тржби. Zásady (`ochrana-osobnich-udaju/page.tsx:44`), podmínky 10.2/10.3 (`podminky/page.tsx:249,270`) і UI (`setup-app.tsx:123-125, 961`) досі обіцяють «30 dnů, potom smažeme» → **В3-3** |

### R5.11, R5.12, Ф9

| Пункт | Стан | Докази (file:line) | Коментар |
| --- | --- | --- | --- |
| R5.11 typecheck спершу запускає `next typegen` | ✅ | `apps/web/package.json:9`; гейт `test/infra.test.ts:18-23` | На чистому checkout зелено, відтворено. Гейт перевіряє лише рядок скрипта, для цієї задачі цього досить |
| R5.12 кеш ARES обмежений і з БД | ✅ | `lib/server/ares.ts:54-70` (LRU+TTL, `memoryMax`), `:92`, `:100`, `:104` (обидві гілки через `memorySet`); гейт `test/integration/r5-12-ares-cache.test.ts` | Межа діє в обох гілках, прострочене прибирається під час читання. Дрібниця: від'ємний `ARES_MEMORY_MAX` дає нескінченний цикл → **Д3-4** |
| Ф9 — `eet_search_guides` | ✅ | `lib/mcp/guides.ts:63-78` (`isIndexable` у кожному запиті); `lib/mcp/server.ts:355-363` | Порожній результат не перелічує нерецензовані slug-и |
| Ф9 — `eet_get_guide` | ✅ | `lib/mcp/server.ts:389-396`; `lib/mcp/guides.ts:53-56` | Запитаний slug у помилці не повторюється |
| Ф9 — `eet_classify_payment` і `eet_get_facts` | ✅ | `lib/mcp/server.ts:239-240`, `:284-285` (`publicGuidePath`) | Посилання на гайд з'являється лише після рецензії |
| Ф9 — `eet_list_misconceptions` | ✅ | `lib/mcp/server.ts:313-322` | `action.href` міфів (`content/myths.ts:53…139`) у вивід не потрапляє |
| Ф9 — `eet_calculate_eet_off` і `eet_get_fs_status` | ✅ | `lib/mcp/server.ts:179-209`, `:419-444` | Посилань на `/navody/` немає (`FACTS.eetOff.*` і `FACTS.offline.summary` їх не містять) |
| Ф9 — `eet_check_ico` | ❌ | `lib/mcp/server.ts:115` (`url: absoluteUrl(c.href)`) ← `lib/eet-assessment.ts:132,144` (`href: "/navody/jak-aktivovat-dis-a-certifikat"`) | Інструмент віддає посилання на нерецензований гайд. Гейт `test/r4-mcp-guides.test.ts:31-42` `eet_check_ico` не викликає, а `lookupCompany` там повертає `null` (`:11`). Підтверджено: `LEAKED via eet_check_ico: ['jak-aktivovat-dis-a-certifikat']` → **В3-4** |
| Ф9 — інші канали | ✅ | `app/sitemap.ts:15`, `lib/llms.ts:10,54,82`; `infra/docker-compose.yml:26` і `infra/.env.production.example:30` (`GUIDES_INDEX_UNREVIEWED=0`) | MCP реєструє лише tools (resources і prompts немає) |

### R4 — `f0470d9`, `5749db4`, `762eeb0` (HTTP)

| Пункт | Стан | Докази (file:line) | Коментар |
| --- | --- | --- | --- |
| Ліміт тіла (Н2-2) | ✅ (див. Д3-7) | `proxy.ts:33-40,57-59`; `lib/server/request-guard.ts:86,135-138`; `lib/server/route-helpers.ts:11` | Перевіряється лише `Content-Length`. Chunked-тіло без нього проходить, і Next буферизує його до 10 MB (`proxyClientMaxBodySize`). За nginx цей шлях закритий |
| CSRF, перевірка походження з `X-Forwarded-Host` | ✅ | `lib/server/request-guard.ts:89,104-130,139-144`; `route-helpers.ts:29`; `infra/nginx/evidujzdarma.conf:54,58` | Перевірено чернеткою із саме тими заголовками, які ставить nginx (`Host` = `X-Forwarded-Host` = `evidujzdarma.cz`, `X-Forwarded-Proto: https`). Свій origin проходить. Не проходять `evil.example`, `sub.evidujzdarma.cz`, `null`, `Sec-Fetch-Site: same-site`/`cross-site`. Клієнтський `X-Forwarded-Host` nginx перезаписує (`proxy_set_header X-Forwarded-Host $host`). Основне порівняння йде з `NEXT_PUBLIC_SITE_URL`, і клієнт на нього не впливає. Без nginx (прямо на `127.0.0.1:3100`) XFH підробити можна, але такий клієнт не браузер жертви з її cookie. Захист у глибину неповний → Д3-8 |
| Формат запиту (JSON, multipart, форма callback) | ✅ | `request-guard.ts:141-144` | `text/plain` → 415 |
| `no-store` | ✅ | `proxy.ts:38` (`COOKIE_API`) | Діє на `/api/ucet*`, `/api/kabinet*`, `/api/pozvanka*`, `/api/auth*` |
| `[id]` як UUID | ⚠️ | `route-helpers.ts:7,26-27` (лише `ownerRoute`) | `api/kabinet/klienti/[id]/route.ts:18,35` і `[id]/pozvanka/route.ts` id не валідують → 500. Лог безпечний: `safeError` з R3.6 → **Д3-2** |
| CSV-формули | ⚠️ | `lib/csv.ts:5-9`; використовується в `api/ucet/export/route.ts:88`, `components/pos/history-view.tsx:119`, `components/accountant/bulk-check.tsx:92,105` | Ще дві копії старого `cell` без нейтралізації: `lib/server/closings.ts:228-231` (pokladní kniha; `note`/`staffName` вводить касир) і `api/kabinet/export/route.ts:9-12`. Дрібне 4 з рецензії №1 закрито частково → **Д3-1** |
| `RichText` `//host` | ✅ / ⚠️ | `components/rich-text.tsx:22` | `//` закрито. `/\evil.com` досі вважається внутрішнім, а браузер нормалізує його до `//evil.com`. Контент статичний → **Д3-3** |
| `accountId` в UPDATE персоналу | ✅ | `api/ucet/personal/[id]/route.ts:30` | — |
| Коментар про проксі (Н2-4) | ✅ | `lib/server/rate-limit.ts:30` | — |
| `762eeb0` | ✅ | `git diff 116790e 68d0960 -- infra/` порожній | — |

### R4 — `8cc613a` (передреєстрація)

| Пункт | Стан | Докази (file:line) | Коментар |
| --- | --- | --- | --- |
| Тихий honeypot | ✅ | `api/preregistrace/route.ts:46,69` | Дрібниця: `website` довший за 500 знаків → 400 замість мовчання |
| UTM | ✅ | `route.ts:36-44,49` | Лишилося: UTM дописується в чужий наявний запис без автентифікації (`:128-135`), тепер обмежено 5 ключами × 300 знаків → Д3-9 |
| Хеш-токени і TTL | ✅ | `lib/server/preregistration.ts:8-46`; `packages/db/migrations/0021_prereg_token_hash.sql:10-14` | Звіт пише «у БД лише SHA-256», але відкритий confirm-токен лежить у `email_outbox.payload` до 90 днів → **Д3-5** |
| Відписка `id.HMAC(APP_SECRET)` | ✅ | `preregistration.ts:22-33`; `api/odhlasit/route.ts:9-25` | Підпис порівнюється timing-safe. Старі хеш-посилання працюють |
| Доказ згоди | ✅ | `route.ts:109-111`; `lib/legal.ts:11`; `ochrana-osobnich-udaju/page.tsx:37` | Зберігаються версія тексту, `marketing_consent_at` і DOI (`confirmed_at`) |
| Без enumeration | ✅ | `route.ts:51-52,122-151,163` | Відповідь однакова. Дрібниця: повторний лист іде навіть відписаній адресі (раз на добу) → Д3-9 |
| Міграції 0021/0022 зберігають дані | ✅ | `0021_…sql:1-14`, `0022_…sql:1-3`; `packages/db/src/migrate.ts:13-15` | До 0021 `confirm_token`/`unsubscribe_token` були NOT NULL, тож бекфіл покриває всі рядки. Хеш у SQL `encode(sha256(convert_to(…,'UTF8')),'hex')` дорівнює `tokens.ts:17-19` (є гейт). `SET NOT NULL` іде після бекфілу. Drizzle-migrator проганяє всі нові міграції в одній транзакції. Незворотно: після 0022 відкат web-образу нижче `8cc613a` неможливий → нотатки деплою |

### R4 — `fafda70` (експлуатація)

| Пункт | Стан | Докази (file:line) | Коментар |
| --- | --- | --- | --- |
| Outbox reaper і міграція 0023 | ✅ | `lib/server/mail.ts:64-77,79`; `0023_outbox_claimed_at.sql` (nullable) | «Перевірити»: поріг 10 хв дорівнює стандартному `socketTimeout` nodemailer (10 хв), тож можливий дубль листа → Д3-10 |
| Листи власникам | ✅ | `lib/server/account.ts:236,241-246`; `lib/server/certificates.ts:55-61` | Транзакційні, без секретів |
| Ліміт одиниць | ✅ | `account.ts:251-261` | — |
| `lastError` на пристрій | ✅ | `lib/server/fiscal.ts:809-827` | Текст лише для `rejected` або `BLOCK_TEXT` |
| Чистка | ✅ | `lifecycle.ts:166-180`; `ochrana-osobnich-udaju/page.tsx:32` | Непідтверджені передреєстрації видаляються через 90 днів, як і написано в zásadách |
| env | ✅ | `.env.example:12-15,31` | Ротація `APP_SECRET` описана в `.env.example`, але не в `docs/deploy.md` |
| Service worker | ✅ | `public/sw.js:7-15,51` | `/api/*` не кешує (`:40`) |
| Лог фолбеку p12 | ✅ | `packages/fiscal-core/src/p12.ts:242,264` | Без секретів |
| Н-4 (ARES у кабінеті) | ✅ | `api/kabinet/klienti/route.ts:21` | — |

### R4 — `b24d14b` (контент) і юридичні інваріанти

| Пункт | Стан | Докази (file:line) | Коментар |
| --- | --- | --- | --- |
| C Дрібне 1–3, 8–18, 20, 21 | ✅ | `lib/eet-assessment.ts` (`establishmentsIs/Have`); `lib/emails.ts:117,120`; лендинг; `content/guides/eet-bez-internetu.ts`; `content/comparison.ts:14`; `components/facts-verified.tsx`; `app/layout.tsx`; `lib/eet-off.ts:49`; гейт `test/r4-content.test.ts` | Лист DIS+ обіцяє «návod se snímky obrazovky», хоча в гайдах зображень немає → Д3-6 |
| Обов'язок з 1. 1. 2027 для всіх, без фазування | ✅ | `content/facts.ts:198,236-240` | — |
| Січень = «pilotní režim», без «dobrovolný/nanečisto/bez sankcí» | ✅ | `facts.ts:181-182,238`; `content/guides/glosar-eet.ts:38` | «nanečisto» вжито лише про грудневий тест (`guides/jak-aktivovat-dis-a-certifikat.ts:62,147`). «dobrovolný» — лише про EET OFF, POK і згоду |
| Порогу 50 000 Kč немає | ✅ | `content/landing.ts:28,68`; `guides/koho-se-eet-tyka.ts:15` | Згадується лише як міф |
| Sleva — максимум 5 000 Kč | ✅ | `facts.ts:322`; `guides/eet-2-0-kompletni-pruvodce.ts:352` | «až», лише OSVČ, перший період, може бути 0 |
| POK добровільний | ✅ | `facts.ts:277`; лендинг «(není povinný)» | — |
| Дані оператора (§ 435) | ✅ | `lib/site.ts:18-28`; `lib/emails.ts:26` | — |
| Не імітуємо державу | ✅ | `components/site-footer.tsx:59`; `app/opengraph-image.tsx:28`; `prihlaseni/page.tsx:31` | — |
| MOJE eet: «Nezveřejněno» там, де не перевірено | ✅ | `content/comparison.ts:8,10-13` | — |
| `FACTS.evidenced.prepayments` | ⚠️ | `content/facts.ts:248-249` | Досі вживається: гайди `kontaktni-platba.ts:79`, `eet-2-0-kompletni-pruvodce.ts:105`, `eet-remeslnici.ts:64`, `eet-kadernictvi-kosmetika.ts:49`, `eet-ubytovani.ts:63`; **MCP** `lib/mcp/facts.ts:59` (тема `evidenced_payments`) і `lib/mcp/payments.ts:55` (`voucher` → «eviduje se» з цим текстом). Суперечить R5.10 → **В3-5** |

---

## 3. Нотатки до деплою за nginx (Т7)

1. **Походження й заголовки.** vhost перезаписує `Host $host` і `X-Forwarded-Host $host` (`evidujzdarma.conf:54,58`). Клієнтський XFH до застосунку не доходить, і перевірка походження тримає. Основний збіг — з `NEXT_PUBLIC_SITE_URL`. Значення вбудовується під час збирання (`--build-arg NEXT_PUBLIC_SITE_URL=https://evidujzdarma.cz`, `docs/deploy.md`) і має точно дорівнювати публічному origin. Якщо колись `proxy_set_header Host` приберуть, усе одно спрацює збіг із SITE_URL. Нічого не ламається.
2. **Basic auth і Bearer.** Поки `auth_basic` увімкнений (`conf:50-51`), каса шле `Authorization: Bearer …`. nginx такий заголовок не приймає й відповідає 401 на `/api/pokladna/*` (sales, config, pin, uctenka). Те саме з MCP. Синхронізацію каси в закритій фазі перевірити не вийде. Можна винести `location ^~ /api/pokladna/ { auth_basic off; proxy_pass http://127.0.0.1:3100; }`: ці маршрути й так захищені токеном пристрою. Рішення за контролером, «перевірити» на живому сервері.
3. **Ліміт тіла.** `client_max_body_size 1m` і `128k` для `/api/ucet/certifikat` (`conf:47,65`) є. `proxy_request_buffering` не вимикати: тоді nginx сам буферизує chunked-тіло й передає застосунку `Content-Length`, на який спирається 413. Додатково можна задати `experimental.proxyClientMaxBodySize: "1mb"` у `next.config.ts` (Д3-7).
4. **`/api/internal/` → 404** (`conf:61-63`). У застосунку ці маршрути ще й закриває `CRON_SECRET`. «Перевірити», що воркер ходить на web напряму по мережі compose, а не через публічний vhost.
5. **Прямий доступ до `127.0.0.1:3100`.** Ззовні неможливий (`infra/docker-compose.nginx.yml:9`). Але на спільному сервері (Т7) інші застосунки й процеси можуть підробити `X-Real-IP` (обхід rate-limit), надіслати chunked до 10 MB і поставити будь-який XFH. CSRF це не відкриває (немає cookie жертви). Прийнятно, просто знати.
6. **default_server.** vhost не має `default_server`. Якщо він випадково стане першим блоком на `:443` (порядок у `sites-enabled` алфавітний), сюди дійдуть запити з будь-яким `Host`. Обходу CSRF це не дає (cookie прив'язані до хоста), але гігієнічно варто тримати `default_server` в іншому блоці або відповідати `return 444` на чужі хости.
7. **Міграції 0021–0023.** Перед деплоєм зробити бекап (`pg_dump | age`). Після 0022 відкотити web-образ нижче `8cc613a` неможливо: старий код шукає `confirm_token`. Між завершенням `migrate` і перезапуском web старий контейнер віддаватиме 500 на передреєстрацію й підтвердження. Вікно коротке, а сайт і так за basic auth.
8. **`APP_SECRET`.** Ротація ламає посилання на відписку в уже відправлених листах і схвалення vratek у процесі. Зараз про це написано лише в `.env.example:12-13`; варто дописати в `docs/deploy.md`.
9. **`ARES_MEMORY_MAX`** — лише додатне ціле (Д3-4). **`GUIDES_INDEX_UNREVIEWED=0`** не змінювати, поки гайди не рецензовані (Ф9).
10. **Після деплою** перевірити, що в лозі немає `[p12] … v hlavním vlákně` (Н2-3).

---

## 4. Тексти для клієнта з податковими чи правовими твердженнями — на рецензію daňovým poradcem / юристом

| # | Де | Текст | Що перевірити |
| --- | --- | --- | --- |
| 1 | `components/pos/payment-sheet.tsx:143` | «Stravenka nebo poukázka vydaná jinou firmou. Eviduje se jako běžná platba.» | R5.10, семінар FS |
| 2 | `payment-sheet.tsx:146` | «Úhrada z dříve nabitého kreditu, čipu nebo předplacené karty. Eviduje se jako čerpání.» | R5.10 |
| 3 | `payment-sheet.tsx:150` | «Dárkový poukaz na konkrétní zboží nebo službu, který jste dříve prodali. Jeho uplatnění se neeviduje – evidoval se už prodej poukazu.» | Що, якщо поуказ продали на відстані (без евіденції)? |
| 4 | `packages/fiscal-core/src/receipt.ts:114` (чек) | «(uhrazeno poukazem, neeviduje se)» | — |
| 5 | `app/(app)/u/[id]/page.tsx:15` | «Tato tržba se do EET neeviduje (např. bankovní převod na základě faktury).» | Той самий текст бачить клієнт і для тржби, оплаченої лише dárkovým poukazem: приклад не підходить. Крім того, каса вважає `transfer` неевідованим (`sale.ts:34`), а MCP для převodu na místě каже «uncertain» (`lib/mcp/payments.ts:70-74`). Позиції розходяться |
| 6 | `u/[id]/page.tsx:16` | «Tržba zatím není potvrzená Finanční správou – obchodník ji řeší.» | — |
| 7 | `u/[id]/page.tsx:115`, `:124` | «Ukázkový doklad – tržba se Finanční správě neodesílá.» / «Testovací doklad – tržba nebyla evidována v ostrém provozu.» | — |
| 8 | `components/pos/receipt-view.tsx:108`; `components/pos/status-bar.tsx:92` | «Lhůta 48 hodin uplynula – připojte zařízení k internetu, tržba se odešle hned, jak to půjde.» / «lhůta uplynula» | Чи не применшує текст наслідки пропуску lhůty |
| 9 | `components/pos/history-view.tsx:86` | Стан «neeviduje se» | — |
| 10 | `lib/server/sales.ts:157`; `lib/server/quarantine.ts:29` | «Ostré prostředí Finanční správy přijímá tržby až od 1. 11. 2026 (přechodný režim) – … Vyřiďte ji ručně.» | Джерело — Produkce v1.1, 4.1. «Перевірити», чи цей документ не є тим, що позначений TLP:AMBER (рецензія №2) |
| 11 | `components/setup/setup-app.tsx:984` | «Tyto tržby se po zrušení Finanční správě neodešlou – evidujte je jinak (např. MOJE eet).» | Те саме показується й для тржб Playground, де «evidujte» хибне. Чи можна взагалі «evidovat jinak» тржбу після 48 год |
| 12 | `setup-app.tsx:123-125`, `:961`; `components/pos/pos-app.tsx:253` | «…pokladny neprodávají – jen odešlou uložené tržby. Data smažeme {datum}» / «Pokladna už neprodává – jen odešle tržby, které jsou v ní uložené.» | «Odešle» читається як «до FS», але ключі знищено. Дата видалення не діє для рахунків, які утримує retention (В3-3) |
| 13 | `app/(site)/podminky/page.tsx:290-294` (čl. 11.3), `:249` (10.2), `:270` (10.3) | Закриття, 30 днів, «automaticky nesmaže» | Юрист. `TERMS_VERSION` не підвищено (`lib/legal.ts:2`). «Перевірити», чи були реальні акцептанти версії 2026-10-02 (čl. 12.1 вимагає 30 днів) |
| 14 | `app/(site)/ochrana-osobnich-udaju/page.tsx:44` | «Po dobu trvání účtu a 30 dnů po jeho zrušení (na export), potom údaje smažeme.» | Не згадує утримання (В3-3); правова підстава утримання |
| 15 | `setup-app.tsx:484` | «Ověřovací tržbu Finanční správa zkontroluje, ale neeviduje.» | — |
| 16 | `lib/emails.ts:117,120` (маркетинговий лист 1. 11.) | «Finanční správa zpřístupnila v DIS+ přihlášení k evidenci tržeb. Připravili jsme návod se snímky obrazovky…» | Факт на дату відправки. Знімків немає (Д3-6). Посилання веде на нерецензований гайд |
| 17 | `content/facts.ts:249` (5 гайдів і MCP) | «U záloh, dárkových poukazů a dobíjení kreditu se eviduje přijetí … i samotné čerpání» | Суперечить R5.10 (В3-5). Контролер текст замінить |
| 18 | `lib/mcp/payments.ts:52-56` | `voucher` («poukaz, dárková karta, stravenka») osobně → «eviduje se» + текст із п. 17 | Розділити так само, як на касі (В3-5) |

---

## 5. Нові знахідки

### Критично

Немає.

### Важливо

**В3-1. Закритий рахунок: сервер приймає нові продажі, «лише вивантаження» тримає тільки клієнт.**

- **Де:** `lib/server/sales.ts:125-274` (жодної перевірки `account.closedAt`). Маршрут `api/pokladna/sales/route.ts:14` пускає закритий рахунок (`allowClosed`). Продаж блокує лише клієнт: `lib/pos/sale-factory.ts:28`.
- **Сценарій:** закритий рахунок у mock. Каса шле тржбу з `soldAt = closedAt + 1 хв` → 200, `inserted: true`, `status: confirmed`, фейковий POK (чернетка). Так поводиться касова PWA старої версії з кешу SW, кіоск без оновлення конфігурації або змінений клієнт. Пристрої не відкликаються, токен безстроковий.
  - У production така тржба стає в чергу назавжди: ключі сертифіката знищено (`lifecycle.ts:83-86`), а новий сертифікат не імпортується (`certificates.ts:47`).
  - Продавець думає, що евідує, а до FS нічого не йде. Порушено інваріант 1 / Т4.
  - Кожна нова тржба ще й тримає рахунок від видалення (`lifecycle.ts:111-116`).
- **Фікс:** в `ingestSales`, якщо `account.closedAt && soldAtMs > closedAt.getTime()` → `IngestRejection("ACCOUNT_CLOSED", "Účet je zrušený – tržba prodaná po zrušení se do FS neodešle.")`. Тобто карантин, не відкидання. Тржби, продані до закриття, приймаються як зараз.
- **Гейт (червоний зараз):** закритий рахунок, POST тржби з `soldAt = closedAt + 1 min` → `quarantined: true, code: "ACCOUNT_CLOSED"`, рядка в `sales` немає. Контроль: `soldAt = closedAt − 1 min` → `ok: true`.

**В3-2. Retention видаляє рахунок, у якого production-тржба лежить у відкритому карантині.**

- **Де:** `lib/server/lifecycle.ts:111-116`. Підзапит `unsentProduction` дивиться лише в `sales`. Карантин видаляється каскадом (`packages/db/src/schema.ts:455-457`).
- **Сценарій:** production-тржба потрапила в карантин (`FUTURE_DATE`, `UNKNOWN_UNIT`, `MODE_MISMATCH`, `PRODUCTION_NOT_OPEN`…). Власник закриває рахунок із підтвердженням. Через 31 день retention видаляє рахунок разом із карантином: `{"accounts":1,"accountsHeld":0}` (чернетка). Це суперечить останньому реченню čl. 11.3 (`podminky/page.tsx:293-294`, інваріант 10). Після закриття карантин ще й поповнюється (В3-1).
- **Фікс:** у `held`/`notExists` додати `exists(sale_quarantine where account_id = … and resolved_at is null and payload->>'mode' = 'production')`.
- **Гейт (червоний зараз):** production, тржба в карантині `FUTURE_DATE`, `closeAccount(confirm)`, `runRetention(+31 d)` → рахунок лишається, `accountsHeld: 1`.

**В3-3. Утриманий рахунок не має кінця: тексти обіцяють 30 днів, власник щодня отримує лист, з яким нічого не може зробити, пристрої активні.**

- **Де:**
  - Zásady (`ochrana-osobnich-udaju/page.tsx:44`), podmínky 10.2/10.3 (`podminky/page.tsx:249,270`), UI (`setup-app.tsx:123-125` «Data smažeme {datum}», `:961`) — скрізь «30 dnů, potom smažeme».
  - Код утримує рахунок безстроково (`lifecycle.ts:116-130`), а автоматичного рішення немає (звіт R5.8, п. 4).
  - Щоденний огляд (`lib/server/reminders.ts:114-170`) не фільтрує `closedAt`. Власник закритого рахунку щодня отримує «Některé tržby čekají na vaše rozhodnutí» з порадою «Odeslat znovu» / нахрати сертифікат. Обидві дії на закритому рахунку заблоковані (`certificates.ts:47`, `account.ts:168`).
  - Пристрої не відкликаються (`lifecycle.ts:82`), тож `GET /api/pokladna/config` віддає IBAN, імена й PIN-хеші касирів, поки рахунок існує.
- **Сценарій:** власник закрив рахунок, на якому лишилася хоч одна production-тржба без POK. Рахунок і персональні дані (касири, e-maily клієнтів у чеках) живуть роками всупереч заявленим строкам (GDPR čl. 5(1)(e), čl. 13(2)(a)). Власник щодня отримує листи без кінця. Загублений планшет зберігає доступ до даних.
- **Фікс:**
  - До zásad і podmínek 10.2/10.3 додати виняток і граничний строк утримання з правовою підставою (юрист);
  - в UI не показувати дату видалення для утримуваних рахунків;
  - `runReminders` для закритих рахунків надсилати один підсумковий лист (або не надсилати після закриття);
  - пристрої закритого рахунку відкликати через N днів (наприклад, 30), навіть якщо рахунок утримується;
  - дати власнику дію «evidováno jinak» для невідправлених production-тржб, щоб утримання могло закінчитися.
- **Гейти (червоні зараз):**
  - `runReminders` для рахунку з `closedAt` старшим за 1 день → 0 листів `attention:*` (або рівно один підсумковий);
  - legal-тест: текст `PURPOSES` «Účet a provoz pokladny» згадує утримання рахунку з непідтвердженими тржбами;
  - `authenticateDevice` для рахунку, закритого понад 30 днів тому → 401.

**В3-4. Ф9: `eet_check_ico` віддає посилання на нерецензований гайд.**

- **Де:** `lib/mcp/server.ts:115` (`url: c.href ? absoluteUrl(c.href) : null`) ← `lib/eet-assessment.ts:132,144` (`/navody/jak-aktivovat-dis-a-certifikat`).
- **Сценарій:** AI-асистент на запит «týká se mě EET? IČO …» отримує в чеклісті посилання на гайд, який ще чекає poradce, і цитує його як джерело. Саме це Ф9 забороняє («ні MCP, eet_search_guides і решта»). Чернетка: `LEAKED via eet_check_ico: ['jak-aktivovat-dis-a-certifikat']`.
- **Фікс:** у `server.ts:115` для `href`, що починаються з `/navody/`, брати `publicGuidePath(slug)`. Якщо результат `null` → `url: null`.
- **Гейт (червоний зараз):** у `everything()` тесту `test/r4-mcp-guides.test.ts` додати `eet_check_ico` з фікстурою ARES (`ARES_FIXTURES`, а не `lookupCompany: null`), а також `eet_calculate_eet_off` і `eet_get_fs_status`. Тоді гейт покриває всі 9 інструментів.

**В3-5. Зміст: MCP і 5 гайдів кажуть, що čerpání dárkového poukazu евідується, а каса з R5.10 — що ні.**

- **Де:** `content/facts.ts:249`.
  - MCP `eet_get_facts` → `lib/mcp/facts.ts:59`.
  - MCP `eet_classify_payment` (`voucher` osobně → `evidenced: "yes"`, note з тим самим текстом) → `lib/mcp/payments.ts:52-56`.
  - Гайди → `kontaktni-platba.ts:79`, `eet-2-0-kompletni-pruvodce.ts:105`, `eet-remeslnici.ts:64`, `eet-kadernictvi-kosmetika.ts:49`, `eet-ubytovani.ts:63`.
- **Сценарій:** AI-асистент через MCP каже, що uplatnění dárkového poukazu треба евідувати. Касир на касі бачить «neeviduje se» (`payment-sheet.tsx:150`). Дві суперечливі податкові поради з одного джерела. Гайди noindex, але MCP — публічний машинний канал.
- **Фікс:** контролер замінює факт (заплановано). Разом із цим розділити MCP `voucher` на `meal_voucher` / `credit` / `gift_voucher`, як у `packages/fiscal-core/src/sale.ts:14-35`.
- **Гейт:** `eet_classify_payment({payment:"gift_voucher", in_person:true})` → `evidenced: "no"`. Текст `evidenced_payments` не містить «dárkových poukazů … i samotné čerpání».

### Дрібне

**Д3-1. CSV-формули у двох експортах без нейтралізації.**
- **Де:** `lib/server/closings.ts:228-231` (pokladní kniha, `?format=csv`): `note` і `staffName` пристрій приймає без обмеження символів (`closings.ts:18,20,57,59`). `api/kabinet/export/route.ts:9-12`: `label`.
- **Сценарій:** касир у примітці до výběru пише `=HYPERLINK("https://…";"Detail")`, і текст як формула опиняється в Excel власника чи бухгалтера.
- **Фікс:** у обох місцях використати `csvCell` з `lib/csv.ts`.
- **Гейт:** `cashBookCsv` з `note: "=1+1"` → у клітинці `'=1+1`. Те саме для експорту кабінету з `label: "=1+1"`.

**Д3-2. Маршрути кабінету не валідують `[id]` як UUID.**
- **Де:** `api/kabinet/klienti/[id]/route.ts:18,35`, `[id]/pozvanka/route.ts`.
- **Сценарій:** `not-a-uuid` → 500. Лог безпечний (`safeError`).
- **Фікс:** та сама перевірка `UUID_RE`, що в `ownerRoute`.
- **Гейт:** PATCH `/api/kabinet/klienti/not-a-uuid` → 404, обробник не викликається.

**Д3-3. `RichText` вважає `/\host` внутрішнім посиланням.**
- **Де:** `components/rich-text.tsx:22`.
- **Сценарій:** браузер нормалізує `/\evil.com` до `//evil.com`. Контент статичний, тож ризик мінімальний.
- **Фікс:** `!/^\/[\\/]/.test(href)`.
- **Гейт:** `[x](/\\evil.example)` не рендериться як `<Link>`.

**Д3-4. Від'ємний `ARES_MEMORY_MAX` зависає event loop.**
- **Де:** `lib/server/ares.ts:55,69`.
- **Сценарій:** `Number("-1") || 2000 === -1`, умова `memory.size > -1` завжди істинна, а `delete(undefined)` нічого не видаляє. Виходить нескінченний цикл, і весь web висить. Можливо лише через помилку конфігурації.
- **Фікс:** `Math.max(1, …)` і перевірка `Number.isInteger`.
- **Гейт:** `ARES_MEMORY_MAX=-1`, `cached()` повертається, а `size()` не перевищує стандартну межу.

**Д3-5. Відкритий confirm-токен лежить в `email_outbox.payload`.**
- **Де:** `api/preregistrace/route.ts:143,157` → `emailPayload(…confirmToken)` → `lib/emails.ts:66`. Зберігається до 90 днів (`RETENTION.emailLogDays`, `lifecycle.ts:182-188`).
- **Сценарій:** із бекапу чи доступу до БД можна підтвердити чужу передреєстрацію (DOI) упродовж 30-денного TTL.
- **Фікс:** після `sent` чистити `confirmToken` у payload. Або рендерити лист одразу при постановці й зберігати лише хеш.
- **Гейт:** після `processOutbox` у `email_outbox.payload` немає рядка токена з листа.

**Д3-6. Лист DIS+ обіцяє «návod se snímky obrazovky», хоча зображень немає.**
- **Де:** `lib/emails.ts:117,120`. Типи блоків гайду (`content/guides/types.ts`: p, h3, ul, ol, table, note) зображень не мають. Інваріант 10.
- **Фікс:** прибрати «se snímky obrazovky».
- **Гейт:** текст `dis-launch` не містить «snímky».

**Д3-7. Застосунковий ліміт тіла не ловить chunked.**
- **Де:** `request-guard.ts:137-138`, `route-helpers.ts:11`.
- **Сценарій:** без `Content-Length` тіло проходить, і Next буферизує до 10 MB. За nginx шлях закритий.
- **Фікс:** `experimental.proxyClientMaxBodySize: "1mb"` у `next.config.ts`.
- **Гейт:** «перевірити» на standalone: chunked 5 MB на `/api/auth/login` → тіло обрізане до 1 MB / 413.

**Д3-8. Захист у глибину від CSRF неоднаковий.**
- **Де:** повторна перевірка походження є лише в `ownerRoute`. `api/ucet/route.ts:15` (POST), `/api/kabinet/*`, `/api/pozvanka/[token]` і `/api/auth/*` покладаються тільки на `proxy.ts`. Крім того, `requestHosts` додає хост `req.url` (`request-guard.ts:107-111`), тож Origin `http://127.0.0.1:3100` теж проходить. Практичного вектора немає.
- **Фікс:** спільний хелпер `sameOrigin` для всіх cookie-маршрутів.
- **Гейт:** POST `/api/ucet` з `Origin: https://evil.example` у виклику, що оминає proxy → 403.

**Д3-9. Передреєстрація.**
- UTM дописується в чужий наявний запис без автентифікації (`route.ts:128-135`).
- Повторний лист «prereg-confirm» іде й відписаній адресі за запитом третьої особи, раз на добу (`route.ts:138-150`; `blockedReason` у `mail.ts:13-14` цей шаблон не покриває).
- `website` довший за 500 знаків → 400, тобто не мовчазний honeypot.
- **Фікс:** не змінювати чужий запис. Для `unsubscribedAt` листа не слати (або слати лише тоді, коли запис непідтверджений).
- **Гейт:** повторна реєстрація відписаної адреси → 0 нових листів.

**Д3-10. Поріг outbox збігається з таймаутом nodemailer («перевірити»).**
- **Де:** `mail.ts:65` (`OUTBOX_STALE_MS` = 10 хв = стандартний `socketTimeout` nodemailer).
- **Сценарій:** повільний SMTP — інший воркер повертає лист у чергу, виходить дубль.
- **Фікс:** явні `connectionTimeout`/`socketTimeout` (наприклад, 60 с) у `createTransport`.

---

**Підсумок.**
- R5.11, R5.12 і більшість R4 (CSRF за nginx, no-store, хеш-токени, міграції 0021–0023 без втрати даних, ops) закрито правильно.
- R5.8 закрито частково: сервер приймає нові тржби закритого рахунку (В3-1), retention не тримає карантин (В3-2), утримання не має кінця і не відповідає zásadám (В3-3).
- Ф9 має пролом через `eet_check_ico` (В3-4).
- `FACTS.evidenced.prepayments` досі в MCP і 5 гайдах і суперечить касі (В3-5).
