# Рецензія №5 (B): R7.1–R7.11 і R7.16, чеські тексти, готовність до відкриття, зовнішні посилання

Рецензент B, 3. 10. 2026. Лише читання: нічого не комітив і не пушив. Шляхи — відносно `apps/web/src/`, якщо не вказано інше. Кожне твердження нижче перевірене читанням коду або прогоном. Те, що з репозиторію не перевірити, винесено в «Перевірити».

---

## 1. Коміт і прогін

| Що | Значення |
| --- | --- |
| Гілка, HEAD | `claude/pensive-mayer-wcam12`, `a717d75` |
| Діапазон | `ccca44d..a717d75`, 32 коміти (R7.1…R7.16 і звіти) |
| `corepack enable && pnpm install --frozen-lockfile` | OK, 232 пакети |
| `pnpm -r test` | `packages/cz` 29/29, `packages/fiscal-core` 97/97, `apps/web` 434/434 (92 файли, 424 с). **Разом 560/560, EXIT 0** |
| `pnpm -r typecheck` | EXIT 0 |
| `drizzle-kit generate` | «No schema changes»: схема й міграції 0026–0030 збігаються |
| Інфра-тест на конфігу дня відкриття | `test/infra.test.ts` **5/5 зелений** на `infra/nginx/evidujzdarma.conf`, у якому третій `server` замінено блоком з B-r4 розд. 3 і додано `access_log … ez_noquery`. Файл після прогону повернуто (`git checkout`) |
| Тест-чернетка | `apps/web/test/zz-rev5-b.test.ts`, 8 сценаріїв на PGlite. Копія: `B-r5.scratch.test.ts.txt`. Результати: T1 (тексти) — розбіжність лише в розмітці; T2 (nginx) — зелений; **D1, D2 — дефекти підтверджено**; D3–D6 — спостереження, вивід у лозі. Файл з клону видалено |
| `git status` наприкінці | чистий |

---

## 2. Пункти R7.1–R7.11 і R7.16

| Пункт | Стан | Докази (file:line) | Чи ловить гейт | Коментар |
| --- | --- | --- | --- | --- |
| R7.1 robots | ✅ | `app/robots.ts:47`: `${p}$` + `${p}/` | Так: `test/r7-1-robots.test.ts:12-23`, `test/open-site.test.ts:35` | Чи розуміє SeznamBot `$`, з коду не видно. Якщо ні, `/pokladna` без слеша для нього не заборонена; її однаково закривають 401 і noindex |
| R7.2 інфра-тест nginx | ✅ | `test/infra.test.ts:14,27-37,59-61`; `test/helpers/nginx.ts:182-199` | Так. Червоний на плані з open-site, зелений на поточному конфігу і на B-r4 + `access_log` (перевірено підміною файлу, розд. 4.2) | Прогалини гейту (Д-7): не перевіряє, що `/api/internal/*` віддає 404. Сценарій `planFromOpenSite` (`:40-56`) після заміни конфігу лишиться зеленим випадково: regex зніме `auth_basic` не з рівня `server`, а з `= /api/ucet/certifikat` |
| R7.3 відписка | ⚠️ | `app/api/odhlasit/route.ts:15-45`; zásady `ochrana-osobnich-udaju/page.tsx:33,40`; міграція `0026` | Так, для першої відписки (`test/integration/r7-3-unsubscribe-retention.test.ts`) | **D1:** повторний POST того самого вічного посилання зсуває `unsubscribedAt` і так подовжує 3 роки (`:17` без `isNull(unsubscribedAt)`). Підтверджено чернеткою. Крім того, відписка мовчки скасовує передреєстрацію (В-1) |
| R7.4 вебінар окремо | ⚠️ | `packages/db/src/schema.ts:77-91`; міграції `0027`, `0028`; `app/api/preregistrace/route.ts:32,132-137,157,174-192`; `lib/server/preregistration.ts:118-178`; `lib/emails.ts:73-101,140-155`; `app/(site)/registrace/zajem/page.tsx`; `app/api/registrace/zajem/route.ts`; `components/accountant/webinar-form.tsx:134-140`; `app/(site)/ucetni/page.tsx:216`; zásady `:30` | Так: `app-ready` не йде вебінару, відома адреса → інтерес без зміни `preregistrations` | **D2:** сторінка стану бере й непідтверджені інтереси (`lib/server/preregistration.ts:97-101`, `registrace/potvrzeni/page.tsx:15`). Після того як третя особа додасть «pokladna», підтверджений вебінарний реєстрант бачить «Jste N. v pořadí na včasný přístup k pokladně» і реферальну акцію. Підтверджено. Також Д-2, Д-3 |
| R7.5 námitka | ✅ | `lib/server/mail.ts:76-93`; міграція `0029`; `app/api/namitka/route.ts:60-62` | Так: `test/integration/r7-5-objection.test.ts` | Ліміт на адресу рахується до перевірки БД. Чужа людина може за день вичерпати 3 спроби власника адреси; у відповіді є «napište nám e-mail», тож прийнятно |
| R7.6 публічне не веде в закрите | ✅ | `app/(site)/namitka/page.tsx:31,58`; `lib/jsonld.tsx:56-57`; `app/manifest.ts`; `lib/llms.ts:43-45`; `components/tool-cta.tsx:4,13`; `lib/server/mail.ts:13-27,131-137`; `lib/server/preregistration.ts:176,185-196`; `app/api/internal/dis-launch/route.ts`; міграція `0030` | Так: `test/integration/r7-6-public-closed.test.ts` | Ручний запуск `dis-launch` ще не описано в `docs/deploy.md` |
| R7.7 404 і відписка | ✅ | `app/not-found.tsx:6-25`; `app/api/odhlasit/route.ts:51-57` | Так: `test/r7-7-not-found.test.ts` | — |
| R7.8 zásady і podmínky | ✅ / ⚠️ | zásady `:198-201,216-219,324,229-235,174-176`; `content/catalog-data.ts`; `namitka/page.tsx:50`; podmínky `:149-151,301-302`; `lib/legal.ts:3-9` | Так: `test/r7-8-legal.test.ts` | Тексти дослівні. Дрібне: у `CATALOG_DATA` немає дати ukončení provozovny (`provozovna/[slug]/page.tsx:96`) і самого orientačního vyhodnocení (чип на `/firma`). «Ve zkratce» (`:325`): «Proti zobrazení… námitku», хоча katalog закритий. `<time dateTime="2026-10-03-r7">` — невалідне значення (D4). **Гейт `r7-8-legal.test.ts:79` прибиває `PRIVACY_VERSION_LABEL = "3. 10. 2026"`, тож почервоніє, коли контролер виставить дату (розд. 4.4)** |
| R7.9 «navždy» | ✅ | podmínky `:140,149-151,289-293,362-363`; `content/pricing.ts:12-16`; `app/(site)/cenik/page.tsx:82` | Так: `test/r7-9-zdarma-navzdy.test.ts` | TODO для юриста в `podminky/page.tsx:4` досі каже «60 dní výpověď ze strany provozovatele». Це лише коментар |
| R7.10 правила акції | ✅ | `app/(site)/pravidla-doporuceni/page.tsx`; `lib/static-pages.ts:22`; `components/site-footer.tsx:47`; `registrace/potvrzeni/page.tsx:59`; `app/(site)/page.tsx:181`; `partner-badge.tsx:58`; `content/pricing.ts:195`; `lib/emails.ts:109,124-126`; `components/prereg-form.tsx:32-36`; zásady `:229-230` | Так: `test/r7-10-referral-rules.test.ts` | Тексти дослівні (розд. 3.1). Обіцянки без коду — Д-4 |
| R7.11 обіцянки, M3, M5 | ✅ | `app/(site)/page.tsx:167`; `content/pricing.ts:58`; `components/prereg-form.tsx:186`, `webinar-form.tsx:61`; `app/api/ico/[ico]/route.ts:10-19,29` | Так: `test/r7-11-promises.test.ts` | `isNaturalPerson` (`packages/cz/src/legal-form.ts:22`) не ловить форми 424/425 (zahraniční FO) і `null`, тож для них повна адреса. Те саме в UI і MCP, з'явилось до R7 (Д-8) |
| R7.16 посилання стану | ✅ | `lib/server/preregistration.ts:53-55,68-82`; `app/api/preregistrace/route.ts:141-150` | Так: `test/integration/r7-16-status-link.test.ts` | Підписаний токен стану безстроковий. Відкликати його можна лише заміною `APP_SECRET`; у звіті це сказано |

---

## 3. Чеські тексти

### 3.1 Дослівні тексти з review-4.md проти сайту (скрипт, T1)

Скрипт узяв з `review-4.md` 26 абзаців-цитат і 12 вставок «…», підставив `{operatorLine()}`, `{SITE.email}` і `{datum zveřejnění}`. Тексти порівнювалися з видимим текстом відрендерених сторінок (zásady, podmínky, pravidla, ucetni, лендинг, ceník, форма вебінару, CTA), з листами `prereg-confirm` (новий і повторний), з `llms.txt` і з кодом `prereg-form.tsx`.

- **37 з 38 — побайтово.**
- **1 розбіжність, лише в розмітці:** pravidla, п. 3 (`pravidla-doporuceni/page.tsx:31-39`). «…když doporučený» стоїть в одному `<p>`, «a) … b) … c)» — у наступному. Видимий текст той самий: абзац замість переносу рядка. Сам текст не змінено.

### 3.2 Нові тексти, які кодова сесія написала сама (для вичитки)

**R7.4 — інтереси, листи, сторінки**

- `lib/interests.ts:9-11` (INTEREST_LABEL): «předregistrace k pokladně EvidujZdarma» · «přihláška na webináře EET 2.0 pro účetní» · «zpráva o spuštění Účetního kabinetu»
- `lib/interests.ts:16-18` (INTEREST_NEXT): «Až pokladnu spustíme, pošleme vám odkaz.» · «Termín a odkaz na webinář vám pošleme, jakmile ho vypíšeme.» · «O spuštění Účetního kabinetu vám dáme vědět.»
- `lib/emails.ts:76`: «přihlášku na webináře EET 2.0 pro účetní» / «zájem o Účetní kabinet»
- `lib/emails.ts:78`: тема «Potvrďte prosím e-mail – EvidujZdarma»
- `lib/emails.ts:83`: «děkujeme za {what}. Potvrďte prosím e-mail: {url}»
- `lib/emails.ts:96`: «děkujeme za {what}. Jedním kliknutím potvrďte e-mail. {INTEREST_NEXT}». Лист вебінару теж несе блок «Váš EET plán» (`:86-87`)
- `lib/emails.ts:109,124`: «tento e-mail už u nás je předregistrovaný a potvrzený. Stav předregistrace najdete zde:» (друге речення — з рецензії)
- `lib/emails.ts:146`: тема «Potvrďte prosím žádost – EvidujZdarma»
- `lib/emails.ts:148,151`: «pro tento e-mail jsme dostali žádost: {LABEL}. Potvrďte ji prosím: {url}» · «Pokud jste o nic nežádali, e-mail ignorujte – nic dalšího vám kvůli němu nepošleme.» · кнопка «Potvrdit žádost»
- `app/(site)/registrace/zajem/page.tsx`:
  - `:6` «Potvrzení žádosti»
  - `:17` «Potvrďte prosím žádost»
  - `:19` «Žádost: {LABEL}. {NEXT}»
  - `:24` «Potvrdit žádost»
  - `:31` «Hotovo, žádost je potvrzená»
  - `:36` «Odkaz už neplatí»
  - `:37` «Odkaz je neplatný nebo neúplný. Vyplňte prosím formulář znovu – pošleme nový.»
  - `:39` «Zpět na úvod»
- `app/(site)/registrace/potvrzeni/page.tsx`:
  - `:24` «Jedním kliknutím potvrdíte, že e-mail patří vám. Pak vám pošleme včasný přístup k pokladně.» / {NEXT}
  - `:36` «E-mail je potvrzený»
  - `:39` «{Label з великої}: {NEXT}»
  - `:44` «Hromadná kontrola IČO»
- `components/accountant/webinar-form.tsx`:
  - `:59` «Zkontrolujte prosím e-mail»
  - `:60` «Poslali jsme vám odkaz k potvrzení. {NEXT}»
- `components/accountant/webinars.ts`:
  - `:14` «Webinář EET 2.0 pro účetní» / «Termín i odkaz pošleme, jakmile ho vypíšeme»
  - `:15` «Jen mi dejte vědět o spuštění Účetního kabinetu» / «Bez webináře» (дослівно лишилось із попередньої версії)

**R7.5**

- `app/api/namitka/route.ts:61`: «Na tuto adresu jsme dnes už poslali několik potvrzení. Zkuste to prosím zítra nebo nám napište e-mail.»

**R7.6**

- `app/api/internal/dis-launch/route.ts:20` (лише для оператора): «Pošlete {"confirm": true} – e-mail tvrdí, že DIS+ je spuštěné.»

**R7.7**

- `app/not-found.tsx`:
  - `:6,15` «Stránka nenalezena»
  - `:16` «Odkaz je neplatný nebo stránka už neexistuje.»
  - `:19` «Na úvodní stránku»
  - `:22` «Zkontrolovat IČO»

**R7.8**

- `content/catalog-data.ts:6`: «název, IČO, DIČ, zda je plátce DPH, právní forma, data vzniku a zániku, sídlo (u fyzických osob jen obec), kraj, obory činnosti (CZ-NACE) a provozovny ze živnostenského rejstříku (IČP, název, adresa – u fyzických osob jen obec – a datum zahájení)»
- `app/(site)/namitka/page.tsx:50-51`: «Jen veřejné údaje z registrů ARES, živnostenského rejstříku (RŽP) a ČSÚ: {CATALOG_DATA}. Nevytváříme stránky osob ani statutárních orgánů.»

**R7.9**

- `content/pricing.ts:12-13` (PRICING_NOTICE_TEXT для FAQ і JSON-LD): «… zůstane zdarma navždy (čl. 6.2 podmínek).»

**R7.10**

- `app/(site)/pravidla-doporuceni/page.tsx:9` (description): «Pravidla akce Doporučte kolegu: kdo se může zapojit, kdy získáte Premium na 3 měsíce zdarma a jak dlouho akce trvá.»
- `components/site-footer.tsx:47`: «Pravidla akce Doporučte kolegu»

**R7.12–R7.15 (зона A; тексти показуються користувачу)**

- `lib/server/quarantine.ts:99-100` (лист closed-unsent):
  - тема «Zrušený účet: pokladna předala neodeslanou ostrou tržbu»
  - текст «Pokladna {id} předala do zrušeného účtu ostrou tržbu, která se Finanční správě už neodešle. Najdete ji v seznamu neodeslaných tržeb v nastavení pokladny. Evidujte ji jinak (např. v aplikaci MOJE eet) a potom ji tam označte „Evidováno jinak“.»
  - кнопка «Otevřít nastavení»
- `lib/server/lifecycle.ts:211`: «Seznam neodeslaných ostrých tržeb se mezitím změnil. Zkontrolujte aktuální seznam a potvrďte znovu.»
- `components/setup/setup-app.tsx:974-975`: «• … a dalších {n}» · «{n}× tržba v karanténě (server ji nemohl přijmout)»
- `lib/server/quarantine.ts:28` (REFUND_MODE_MISMATCH): «Vratka je v jiném režimu, než v jakém byla prodána původní tržba – pokladna ji neodešle. Vyřiďte ji ručně.»
- `lib/server/sales.ts:117`: «Vratka je v režimu {MODE_LABEL}, ale původní tržba byla prodána v režimu {MODE_LABEL}. Pokladna ji neodešle – vyřiďte ji ručně.» (`MODE_LABEL`, `:135`: «ukázkový» / «Playground» / «ostrý provoz»)
- `lib/pos/sale-factory.ts:83`, `MODE_NAME`: «ukázkový režim» / «Playground» / «ostrý provoz». Підставляється в текст контролера на `:91`
- `lib/server/sales.ts:98`: «Platba u prodeje nesmí být záporná»
- `lib/pos/revoked.ts:7`: «{текст сервера} Tržby, které v zařízení zůstaly, už do účtu předat nejde.»
- `lib/pos/revoked.ts:9`: «Vlastník účtu zařízení odpojil v nastavení. Přihlaste se a zaregistrujte ho znovu.» (без змін)
- `lib/server/sales.ts:168` і `quarantine.ts:31` (ACCOUNT_CLOSED): «Účet je zrušený – tržba prodaná po zrušení se do FS neodešle.»
- `packages/fiscal-core/src/receipt.ts:129`: «Vráceno» (решта; рядок не новий, нова сума)

### 3.3 Граматика, кальки, сенс

| Де | Проблема | Пропозиція |
| --- | --- | --- |
| `sales.ts:117` (+ старе `:182`) | «v režimu ukázkový», «v režimu ostrý provoz»: прикметник у називному відмінку після «v režimu» | Назви режимів у лапках («v režimu „ostrý provoz“») або в місцевому відмінку: «v ukázkovém režimu», «v ostrém provozu», «v Playgroundu» |
| `quarantine.ts:28`, `sales.ts:117,168`, `sale-factory.ts:91` (останнє — текст контролера з R7.13) | «tržba byla prodána», «tržba prodaná»: калька («продана виручка»). Tržba — це виручка, її не продають | «Původní prodej proběhl v jiném režimu (…)» або «Tržba byla zaevidována v jiném režimu». У `ACCOUNT_CLOSED` — «prodej po zrušení účtu» і без скорочення «FS» |
| `quarantine.ts:100` | «…(např. v aplikaci MOJE eet) a potom ji **tam** označte»: «tam» читається як MOJE eet | «…a potom ji v nastavení pokladny označte „Evidováno jinak“». Чи можна таку тржбу ще евідувати в MOJE eet після 48 год — питання до poradce |
| `emails.ts:148,151` + `interests.ts:9-11` | «jsme dostali žádost: zpráva o spuštění Účetního kabinetu»: «запит: повідомлення» за змістом зламано | Мітки в знахідному відмінку після «žádost o…» («…žádost o zprávu o spuštění Účetního kabinetu»), або «jsme dostali **přihlášku na webináře** / **žádost o předregistraci**» |
| `emails.ts:109,124` | «tento e-mail už u nás je předregistrovaný»: порядок слів | «tento e-mail je u nás už předregistrovaný a potvrzený» |
| `potvrzeni/page.tsx:24` (старе) | «pošleme vám včasný přístup»: калька з англ. «send early access» | «pošleme vám odkaz, jakmile pokladnu spustíme» (як у листі) |
| `potvrzeni/page.tsx:39` | Після двокрапки речення з великої: «…pro účetní: Termín a odkaz…» | Мала літера або крапка замість двокрапки |
| `interests.ts:10` / `webinars.ts:14` | «webináře» (мн.) у мітці й «Webinář» (одн.) у формі | Узгодити число |
| `webinar-form.tsx:134-135` (текст контролера, R7.4) | «použijeme jen k přihlášení na webinář» показується й для варіанта «kabinet» і поруч із галочкою маркетингової згоди | «…jen k vyřízení vaší žádosti (webinář, zpráva o kabinetu)…», або текст за обраним варіантом |
| `webinar-form.tsx:60`, `prereg-form.tsx:184` | «Poslali jsme vám odkaz k potvrzení» / «…odkaz na vaši předregistraci». Підтвердженій адресі з уже підтвердженим інтересом іде лист стану, адресі вебінару з форми лендингу — `interest-confirm` | Нейтрально: «Poslali jsme vám e-mail s dalším krokem» |
| zásady `:30` (текст контролера) | «u webináře jeho termín»: нові записи термін не зберігають (лише `campaign = webinar`); у старих він лишився в `utm.utm_campaign` | «u webinářů o co máte zájem», або лишити, якщо термін повернеться з розсилкою |

---

## 4. Готовність до відкриття

### 4.1 Маршрути, що стануть публічними (після зняття `auth_basic` з рівня `server`)

**Сторінки.**

- Лендинг `/`.
- Інструменти: `/kontrola-ico`, `/musim-evidovat`, `/kalkulacka-eet-off`, `/evidencni-jednotky`, `/qr-platba`, `/stav-eet`, `/nastroje`, `/mcp`.
- Для účetních: `/ucetni`, `/ucetni/hromadna-kontrola`, `/ucetni/sablony`.
- Контент: `/navody`, `/navody/[slug]` (noindex до poradce), `/co-se-o-eet-pise-spatne`, `/srovnani/moje-eet`, `/cenik`, `/o-nas`.
- Юридичні: `/podminky`, `/ochrana-osobnich-udaju`, **`/pravidla-doporuceni`**.
- Námitka: `/namitka`, `/namitka/potvrzeni`.
- Підтвердження: `/registrace/potvrzeni`, **`/registrace/zajem`**.
- 404.

**Metadata і службові.** `/robots.txt`, `/sitemap.xml`, `/manifest.webmanifest` (`start_url: "/"`), `/llms.txt`, `/llms-full.txt`, `/opengraph-image`, `/icons/[size]`, `/icon.svg`, `/sw.js`, `/{key}.txt` (IndexNow).

**API.**

- Публічні за задумом: `POST /api/preregistrace`, `POST /api/registrace/potvrdit`, **`POST /api/registrace/zajem`**, `GET/POST /api/odhlasit`, `/api/anketa`, `/api/ico/[ico]`, `/api/ico/hromadne`, `/api/mcp`, `POST /api/namitka`, `/api/namitka/potvrdit`, `/api/stav-eet`, `/api/health`, `/api/indexnow/key/[key]`.
- `/api/pokladna/*` — токен пристрою.

**Закриті.**

- `CLOSED_SECTIONS` і `CLOSED_API` (`lib/launch.ts:7,10`) — `auth_basic`.
- `/api/internal/*`, зокрема новий **`/api/internal/dis-launch`** — nginx 404 (`^~`) і `CRON_SECRET`.

**Нові маршрути R7 — як мають бути:**

| Маршрут | Публічний? | robots / noindex | Ліміт / Origin | Оцінка |
| --- | --- | --- | --- | --- |
| `/registrace/zajem` | так (посилання з листа) | `Disallow: /registrace/` + `noindex,nofollow` (`zajem/page.tsx:6`) | GET лише читає | ✅ |
| `POST /api/registrace/zajem` | так | `Disallow: /api/` | Без ліміту й без Origin. Захищає токен 24 B; стан змінює лише POST | ✅ |
| `/pravidla-doporuceni` | так | індексується, є в sitemap (`static-pages.ts:22`), у підвалі | — | ✅ |
| `/api/internal/dis-launch` | ні | — | nginx 404 (перевірено T2) + `CRON_SECRET` (`dis-launch/route.ts:17`) | ✅ |
| 404 (`not-found.tsx`) | так | `noindex,follow` | — | ✅ |

Посилань у закриті секції з публічних сторінок немає. Шапка, підвал і `/ucetni` фільтрують через `isClosed`, `/namitka` — теж (R7.6).

### 4.2 nginx

**Як тест читає конфіг.**

- `test/infra.test.ts:14-15` читає `infra/nginx/evidujzdarma.conf` з репозиторію.
- Блок B-r4 тест бере прямо з `docs/tasks/2026-10-03-review-4/B-r4.md`, перший блок ```` ```nginx ```` (`:59-61`).
- Парсер (`test/helpers/nginx.ts`) розбирає й верхньорівневі директиви: `log_format` у файлі не заважає. `mainServer` вибирає server з `evidujzdarma.cz`, `443` і без `return`.

**Перевірка підміною.** Третій `server` у копії файлу замінено блоком B-r4, після `server_name` додано рядок `access_log /var/log/nginx/evidujzdarma.access.log ez_noquery;`. Справжній `infra.test.ts` — **5/5 зелений**. Цей конфіг тепер у `infra/nginx/evidujzdarma.conf` (коміт `637eccd`).

Чернетка T2 на тому самому конфігу:

- порушень немає, зокрема `/api/ucet/certifikat/1`;
- публічні `/`, `/ucetni`, `/registrace/zajem`, `/pravidla-doporuceni`, `/api/registrace/zajem`, `/api/preregistrace`, `/api/odhlasit`, `/namitka`, `/robots.txt`, `/sitemap.xml`, `/llms.txt` — без auth;
- `/api/internal/dis-launch` → `location ^~ /api/internal/ { return 404; }`.

**Що врахувати контролеру:**

1. Інфра-тест перевіряє лише файл у репозиторії. Після правки на сервері закомітьте той самий конфіг в `infra/nginx/evidujzdarma.conf`, інакше гейт перевіряє не те, що працює. `nginx -t` обов'язковий: тест синтаксис не перевіряє.
2. Smoke-тест відписки зі своєю адресою після R7.3 назавжди заблокує цю адресу для передреєстрації. Беріть одноразову адресу або видаліть рядок після тесту.
3. До smoke варто додати:
   - `curl -s -o /dev/null -w '%{http_code}' https://evidujzdarma.cz/api/internal/dis-launch -X POST` → 404;
   - `/pravidla-doporuceni` і `/registrace/zajem` → 200.

### 4.3 robots.txt, sitemap, noindex

- **robots** (`app/robots.ts:47`): `Disallow: /api/`, `/ucet/`, `/registrace/`, а для кожної закритої секції — `/x$` і `/x/`. `/ucetni*` дозволено (гейт R7.1).
- **sitemap** (`app/sitemap.ts`): лише `STATIC_PAGES` (зокрема **`/pravidla-doporuceni`**) і рецензовані гайди. Закритих URL немає (`open-site.test.ts:40-42`). Sitemap каталогу robots не оголошує, поки каталог закритий (`robots.ts:51`).
- **noindex там, де треба:** `/registrace/potvrzeni`, `/registrace/zajem`, `/namitka/potvrzeni`, `/namitka?ico=…`, 404, HTML `/api/odhlasit` (`meta robots`), `(app)/layout`, гайди без `reviewedBy`.
- `/podminky` і `/ochrana-osobnich-udaju` індексуються. Це рішення «публікуємо чернетку» (блокер 3, чекає «так» власника).

### 4.4 Дати версій юридичних текстів

Зараз (`lib/legal.ts`):

| Константа | Рядок | Значення | Де показується |
| --- | --- | --- | --- |
| `TERMS_VERSION` | `:3` | `"2026-10-03-r7"` | `users.terms_version`; `<time dateTime>` у шапці podmínek (`podminky/page.tsx:341`) |
| `TERMS_VERSION_LABEL` | `:4` | `"3. 10. 2026"` | podmínky 13.3 «…je platná od» (`:327`), «Verze ze dne» (`:341`) |
| `REFERRAL_RULES_VERSION_LABEL` | `:6` | `"3. 10. 2026"` | pravidla «Platí od» (`pravidla-doporuceni/page.tsx:61`). П. 6 правил: «Akce trvá od zveřejnění těchto pravidel», тож дата має бути датою публікації |
| `PRIVACY_VERSION` | `:8` | `"2026-10-03-r7"` | `<time dateTime>` у шапці zásad (`ochrana-osobnich-udaju/page.tsx:303`) |
| `PRIVACY_VERSION_LABEL` | `:9` | `"3. 10. 2026"` | zásady «Tato verze platí od» (`:289`), «Verze ze dne» (`:303`) |
| `MARKETING_CONSENT_VERSION` | `:14` | `"2026-09-20"` | Не міняти: текст згоди в обох формах не змінювався |

**У день публікації (дата D, напр. `2026-10-06` / «6. 10. 2026»):**

1. `lib/legal.ts:4,6,9` → «D. M. 2026».
2. `lib/legal.ts:3,8` → `"2026-MM-DD"` без суфікса `-r7`. Так `<time dateTime>` стане валідним (D4).
3. **Тести, що почервоніють:**
   - `test/r7-8-legal.test.ts:79` прибиває `PRIVACY_VERSION_LABEL` до `"3. 10. 2026"`. Замінити на нову мітку або на перевірку формату;
   - `test/r7-8-legal.test.ts:78` (`TERMS_VERSION > "2026-10-03"`) і `test/integration/r6-4-closed-hold.test.ts:121-122` (`TERMS_VERSION > "2026-10-02"`, `PRIVACY_VERSION > "2026-10-03"`) — зелені для будь-якої дати після 3. 10. **Якщо публікуєте сьогодні, 3. 10.**, рядок `"2026-10-03"` їх завалить: лишіть `"2026-10-03-r7"` або змініть ці перевірки.
4. Коментарі без впливу: `podminky/page.tsx:8` («NÁVRH 3. 10. 2026»), `:4` (стара «60 dní»).

---

## 5. Зовнішні посилання (баг власника)

Приклад власника — квіз `/musim-evidovat`: `components/tools/quiz.tsx:195` (`<a href={s.url} rel="noopener">`, без `target`). Сканер JSX знайшов 27 місць з зовнішнім `href`. Рендер публічних сторінок (D5) це підтвердив.

**Відкриваються в тій самій вкладці (немає `target="_blank"`, `rel="noopener"`) — 19:**

| Файл:рядок | Що |
| --- | --- |
| `components/tools/quiz.tsx:195` | джерела квізу («Zdroj: eet.gov.cz: Jak začít evidovat…») |
| `components/site-header.tsx:13` | плашка незалежності → eet.gov.cz (на кожній сторінці) |
| `components/site-footer.tsx:63` | блок незалежності → eet.gov.cz (на кожній сторінці) |
| `components/ico-result.tsx:179` | «Přesné podmínky» → eet.gov.cz |
| `components/comparison-table.tsx:41,47` | джерела порівняння |
| `app/(site)/page.tsx:82` | «Ověřeno k … Zdroj» на лендингу |
| `app/(site)/evidencni-jednotky/page.tsx:46` | джерело |
| `app/(site)/kalkulacka-eet-off/page.tsx:72` | джерела |
| `app/(site)/qr-platba/page.tsx:60` | джерела |
| `app/(site)/stav-eet/page.tsx:191` | джерело |
| `app/(site)/srovnani/moje-eet/page.tsx:120,162,218` | кнопка і джерела |
| `app/(site)/ucetni/page.tsx:129` | джерело дати DIS+ |
| `app/(site)/o-nas/page.tsx:76` | eet.gov.cz |
| `app/(site)/nastroje/page.tsx:122` | eet.gov.cz |
| `app/(site)/ochrana-osobnich-udaju/page.tsx:260` | uoou.gov.cz |

**Нова вкладка, але `rel="noopener"` без `noreferrer` — 9:**

- `components/rich-text.tsx:30` — усі `[text](https://…)` у фактах, гайдах і міфах;
- `app/(site)/navody/[slug]/page.tsx:116` — «Zdroje» гайдів;
- `app/(site)/co-se-o-eet-pise-spatne/page.tsx:103`;
- `components/law-history.tsx:14`;
- `app/(site)/firma/[slug]/page.tsx:153`;
- `components/catalog/source-note.tsx:21`;
- `components/catalog/ares-unavailable.tsx:18`;
- `components/catalog/list-source.tsx:9`;
- `components/accountant/partner-badge.tsx:10` — HTML-код для сайтів účetních. Тут `noreferrer` не потрібен: виняток.

**Пропозиція — один компонент:**

```tsx
// components/external-link.tsx
export function ExternalLink({ href, className, children }: { href: string; className?: string; children: React.ReactNode }) {
  return (
    <a href={href} className={className} target="_blank" rel="noopener noreferrer">
      {children}
      <span className="sr-only"> (otevře se v novém okně)</span>
    </a>
  );
}
```

- Замінити ним усі 27 місць, крім рядка в `partner-badge.tsx:10`.
- У `RichText` гілка `https://` → `<ExternalLink>`.

**Гейт `test/external-links.test.ts`, червоний зараз:**

1. **Скан** `src/**/*.tsx`: будь-який `<a`, чий `href` не починається з `"/`, `"#`, `"mailto:` чи `` `/ ``, — порушення. Дозволено лише `external-link.tsx` і рядок-шаблон у `partner-badge.tsx`.
2. **Рендер** `SiteHeader`, `SiteFooter`, `RichText` з `[x](https://a.cz)`, лендингу, `/evidencni-jednotky`, `/srovnani/moje-eet`, `/ochrana-osobnich-udaju`: кожен `<a href="http…">` має `target="_blank"` і `rel`, що містить `noopener` і `noreferrer`.

Квіз (клієнтський стан) покриває скан.

---

## 6. Міграції на живих даних

| Міграція | Що робить | Безпечна? | Примітки |
| --- | --- | --- | --- |
| `0026_prereg_unsubscribed_minimise` | Відписаним обнуляє `ico`, `company_name`, `industry`, `establishments_count`, `needs`, `utm`, `referred_by`. Ставить новий `referral_code` = `'u'` + 11 hex (12 символів = довжина стовпця) і `confirm_token_hash` = 64 hex. Без згоди ще й `confirmed_at`, `consent_evidence` = NULL | Так | `random()` рахується для кожного рядка, колізія з `prereg_referral_uq` малоймовірна. Видалення незворотне (так задумано), бекап перед деплоєм — як завжди. Лишаються `created_at`, `confirm_token_issued_at`, `locale`, `unsubscribe_token_hash`: zásady кажуть «jen e-mail a datum odhlášení» (Д-6) |
| `0027_prereg_interests` | Нова таблиця, FK `ON DELETE CASCADE`, unique `(preregistration_id, campaign)` | Так | — |
| `0028_prereg_interests_backfill` | Інтерес кожному невідписаному: `utm_source=ucetni` → `webinar`/`kabinet` за `utm_campaign` (старі значення `webinar-2026-…`, `kabinet` — перевірено в `ccca44d:webinars.ts`), решта → `pokladna`, `confirmed_at` = DOI. Скасовує `queued app-ready` для `utm_source=ucetni` | Так | Хто спершу передреєструвався до каси, а потім записався на вебінар, вебінарного інтересу не отримає: UTM не зливалися (Д3-9) |
| `0029_outbox_strip_objection_token` | `regexp_replace` прибирає `token=` з `payload.url` у `notice`, лише `sent`/`cancelled`/`failed` | Так | Лишається хвостовий `?`. Це косметика, після відправки URL не потрібен |
| `0030_dis_launch_manual` | `DELETE` `dis-launch` зі статусом `queued` | Так | Рядки `sending` (вікно 10 хв) не зачіпає |

Порядок 0026 → 0027 → 0028 коректний: 0026 мінімізує відписаних до появи таблиці, а 0028 їх пропускає.

---

## 7. Нові знахідки

### Критично

Немає.

### Важливо

**В-1. Відписка мовчки скасовує передреєстрацію й участь в акції.**

- **Де:** `app/api/odhlasit/route.ts:25-45` (R7.3); текст сторінки `:64`: «Po odhlášení vám už nebudeme posílat novinky ani upozornění k termínům EET.». `List-Unsubscribe` є і в службовому DOI-листі (`lib/emails.ts:79,104`).
- **Сценарій.** Людина без маркетингової згоди тисне в DOI-листі «Odhlásit» (Gmail показує кнопку в шапці), думаючи, що відмовляється від новин. Що відбувається:
  - `confirmedAt` стає NULL, інтереси видаляються, `app-ready` скасовується;
  - пořadí й власний реферальний код зникають, `referredBy` обнуляється.

  Повторно зареєструватися не можна (M3). Людина зі згодою, яка відписалась від `dis-launch`, теж втрачає «Pokladna je připravena», про який сама просила. Доповнення до Ц3: якщо відпишеться doporučený, doporučující мовчки втрачає винагороду, а правила такої умови не мають (`pravidla-doporuceni/page.tsx:31-39`).
- **Виправлення** (рішення контролера):
  - (а) На сторінці відписки до кнопки: «Odhlášením zrušíte i předregistraci – pořadí na včasný přístup, odkaz pro pozvání kolegů a přihlášky (webinář, kabinet). E-mail si ponecháme jen proto, abychom vám už nic neposílali.» У правилах, п. 3, умова «a do té doby se z našich e-mailů neodhlásí» (або зберігати `referred_by` у записі-блокуванні).
  - (б) Або для записів зі згодою відписка = лише відкликання згоди (`marketingConsent=false`), а передреєстрація живе за своїм строком (launch + 12 міс.). Мінімізацію робить retention, а не відписка.
- **Гейт:** рендер `GET /api/odhlasit?token=…` містить «zrušíte i předregistraci» (або для (б): після відписки зі згодою `app-ready` лишається `queued`).

**В-2. Зовнішні посилання відкриваються в тій самій вкладці (баг власника).** Розд. 5: 19 місць без `target`, 9 без `noreferrer`. **Гейт:** `test/external-links.test.ts`.

### Дрібне

**Д-1 (D1, підтверджено). Повторна відписка подовжує строк.**

- **Де:** `odhlasit/route.ts:15-19` — `UPDATE … SET unsubscribedAt = now()` без `isNull(unsubscribedAt)`.
- **Сценарій:** посилання вічне (HMAC). Кожен повторний POST (one-click поштового клієнта, сканер) зсуває 3 роки уперед і відповідає «Odhlášeno». Чернетка: 2025-01-01 → now.
- **Виправлення:** `.where(and(where, isNull(unsubscribedAt)))`. Для вже відписаного — `ok` без змін.
- **Гейт:** другий POST не міняє `unsubscribedAt`.

**Д-2 (D2, підтверджено). Сторінка стану рахує непідтверджені інтереси.**

- **Де:** `lib/server/preregistration.ts:97-101` бере всі інтереси; `registrace/potvrzeni/page.tsx:15`.
- **Сценарій:** підтверджений вебінарний реєстрант; хтось подає його адресу з лендингу. Власник відкриває своє посилання й бачить «Jste N. v pořadí na včasný přístup k pokladně» і «Pozvěte kolegu».
- **Виправлення:** для підтвердженого запису брати лише інтереси з `confirmedAt`; для непідтвердженого — без токена.
- **Гейт:** сценарій D2 зі чернетки.

**Д-3 (D3, спостереження). Чужий інтерес «pokladna» потрапляє під DOI власника.**

- **Де:** `api/preregistrace/route.ts:136,141-150`.
- **Сценарій:** непідтверджений вебінарний реєстрант; третя особа подає ту саму адресу з лендингу. Повторний DOI-лист («děkujeme za předregistraci») ротує токен — перше посилання власника мертве. Власник тисне новий лист, підтверджуються обидва інтереси, ставиться `app-ready`. Для непідтверджених кодова сесія це прийняла (M4). Але тепер так приходить ще й лист про касу людині, яка просила вебінар.
- **Виправлення:** інтерес від повторної подачі непідтвердженої адреси теж через власний токен. Або в DOI-листі перелічити всі інтереси, які він підтверджує.

**Д-4. Обіцянки правил без коду.**

- П. 2 «nebo má účet v EvidujZdarma»: реферальний код є лише в `preregistrations` (`schema.ts:49`), у `users`/`accounts` його немає.
- П. 3 c) і п. 4: зв'язок doporučený → účet → ostrá tržba і лист про спуштění Premium не реалізовані.

Поки каса закрита, це прийнятно. Кодову частину потрібно зробити до відкриття `/pokladna`, а п. 2 — прибрати або реалізувати.

**Д-5 (D6, спостереження). Cross-site форма може слати JSON на публічні POST.**

- **Де:** `api/preregistrace/route.ts:64`, `api/namitka/route.ts:53` — `req.json()` без перевірки `content-type`.
- **Сценарій:** `<form enctype="text/plain">` на чужому сайті шле передреєстрацію або námitku від IP відвідувачів, оминаючи ліміт на IP. Чернетка: `content-type: text/plain`, `origin: evil.example` → 200, лист у черзі. Шкоду обмежують ліміти на адресу (1 + 1 на добу, námitka 3 на добу).
- **Виправлення:** вимагати `application/json` (тоді спрацює CORS preflight) або `requireSameOrigin` з `route-helpers.ts`.

**Д-6. Мінімізація відписаних неповна відносно тексту zásad.** Лишаються `created_at`, `confirm_token_issued_at`, `locale`, `unsubscribe_token_hash`, а zásady кажуть «jen e-mail a datum odhlášení». Виправлення: дописати «a datum registrace» або обнулити те, що можна.

**Д-7. Гейт R7.2 не тримає `/api/internal/` → 404.**

- **Наслідок:** якщо location зникне, `dis-launch`/`cron` стануть досяжні ззовні. Їх і далі закриває `CRON_SECRET`.
- **Виправлення:** в `infra.test.ts` перевірити `matchLocation("/api/internal/x")` → `return 404`.
- **Також:** `planFromOpenSite` зробити незалежним від форми файлу (будувати з B-r4, а не `replace` над `current`).

**Д-8. `/api/ico` і `isNaturalPerson` пропускають частину фізосіб.** `legal-form.ts:22` — лише `10x`; 424/425 (zahraniční FO) і `null` отримують повну адресу. Це спільне з UI і MCP, з'явилось до R7. Виправлення: `/^10\d$|^42[45]$/`, а `null` трактувати як FO (fail-closed).

**Д-9. `<time dateTime="2026-10-03-r7">` (D4).** Невалідне значення в шапках zásad і podmínek. Виправлення — розд. 4.4, п. 2.

**Д-10. Дрібниці текстів.**

- «Ve zkratce» zásad (`:325`): «Proti zobrazení můžete… vznést námitku», а katalog закритий.
- `CATALOG_DATA` без дати ukončení provozovny й без orientačního vyhodnocení.
- Purpose zásad «…a přihláška na webinář» (`:29`) не згадує kabinet.
- Застарілий TODO в zásadách (`:7`, «localStorage pro kód doporučení») і в podmínkách (`:4`, «60 dní»).

---

## Перевірити

- **SeznamBot і `$` у robots.txt** (довідка Seznam або Seznam Webmaster після DNS TXT).
- **Конфіг на сервері = `infra/nginx/evidujzdarma.conf`** після дня відкриття. `nginx -t` перед reload.
- **`docs/deploy.md`:** команда ручного `dis-launch` (`report R7.6`) і процедура для відписаної адреси, яка хоче повернутись. Текст успіху каже «napište nám», отже потрібне ручне видалення рядка-блокування.
- **Poradce:** чи можна тржбу із закритого рахунку «evidovat jinak (MOJE eet)» після 48 год (лист closed-unsent, `quarantine.ts:100`).
- **Власник:** рішення за В-1 (а/б); «так» на публікацію zásad, podmínek і pravidel (блокер 3).
- **Контролер:** дата публікації в `lib/legal.ts` і правка `r7-8-legal.test.ts:79` (розд. 4.4). Smoke відписки — з одноразовою адресою.
