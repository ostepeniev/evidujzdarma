# Рецензія №4 (B): готовність до відкриття сайту, передреєстрація, юридичні тексти, публічні обіцянки, Д3-1…Д3-10

Рецензент B, 3. 10. 2026. Лише читання: нічого не пушив і не комітив. Шляхи — відносно `apps/web/src/`, якщо не вказано інше. Усе нижче перевірено в коді (file:line); те, що з коду перевірити неможливо, позначено «перевірити».

---

## 1. Коміт і тести

| Що | Значення |
| --- | --- |
| Репозиторій, гілка | `ostepeniev/evidujzdarma`, `claude/pensive-mayer-wcam12` |
| HEAD | `1aec031e4f921b7e47906519dedb5272ac2bfce1`. Після `git fetch` новішого немає |
| Діапазон | `a4a64c7..1aec031`, 32 коміти (R6.2…R6.12, «Решта дрібного» A і B, `252daae` і `1aec031` — eet-open-site) |
| `corepack enable && pnpm install --frozen-lockfile` | OK, 232 пакети |
| `pnpm -r test` | `packages/cz` 29/29, `packages/fiscal-core` 97/97 (9 файлів), `apps/web` 357/357 (74 файли, PGlite, 265 с). **Разом 483/483, EXIT 0** |
| `pnpm -r typecheck` | EXIT 0 (`next typegen` → «Types generated successfully») |
| Тест-чернетка | 6 сценаріїв на PGlite. 3 червоні, тобто знахідки підтверджено (N1, N3, M1). 3 зелені — це спостереження, вивід у лозі (M3, M4, N4a). Копія: [B-r4.scratch.test.ts.txt](B-r4.scratch.test.ts.txt). З клону видалено, `git status` чистий |

Логи прогону лишилися в робочій теці контролера.

---

## 2. Маршрути: що стане доступним після зняття пароля

Джерело правди — `lib/launch.ts:7,10`. Пропонований regex з `docs/tasks/2026-10-03-open-site.md:60,64` покриває всі сторінки й API зі списку, зокрема sitemap каталогу. Чого бракує:

- **exact-локації `= /api/ucet/certifikat` (N2);**
- рішення щодо `/navody` (блокер 2).

### 2.1 Сторінки

| Маршрут | Тип | Закритий зараз (за планом)? | Має бути закритий? | Чому |
| --- | --- | --- | --- | --- |
| `/` | лендинг | ні | ні | Маркетинг. На сторінці: обіцянки «snímky», «Premium 3 měsíce» і JSON-LD з `url: /pokladna` (розд. 5, M7) |
| `/kontrola-ico`, `/musim-evidovat`, `/kalkulacka-eet-off`, `/evidencni-jednotky`, `/qr-platba`, `/stav-eet`, `/nastroje`, `/mcp` | інструменти | ні | ні | Публічні за планом |
| `/ucetni`, `/ucetni/hromadna-kontrola`, `/ucetni/sablony` | маркетинг + інструменти | ні | ні | Публічні, але **`robots.txt` їх блокує (N1)**. Обіцянки вебінарів (N4) |
| `/co-se-o-eet-pise-spatne`, `/srovnani/moje-eet`, `/cenik`, `/o-nas` | контент | ні | ні | «zdarma navždy», Premium-реферал (розд. 5) |
| `/navody`, `/navody/[slug]` | гайди, noindex | ні | **рішення контролера** | Тексти досі суперечать Ф11 (розд. 5.3). На гайди посилаються підвал (`components/site-footer.tsx:22-25`), лендинг (`app/(site)/page.tsx:75,132`) і `registrace/potvrzeni/page.tsx:42`. Блокер 2 відкритий |
| `/podminky`, `/ochrana-osobnich-udaju` | юридичні | ні | ні | Обов'язкові. Розбіжності — розд. 4 |
| `/namitka`, `/namitka/potvrzeni` | GDPR čl. 21 | ні | ні | Мають працювати (інв. 11), але посилаються на закритий `/firmy` (M7) |
| `/registrace/potvrzeni` | DOI | ні | ні | noindex (`registrace/potvrzeni/page.tsx:7`), robots `Disallow: /registrace/` |
| `/pokladna`, `/pokladna/nastaveni`, `/prihlaseni`, `/prihlaseni/overeni`, `/kabinet`, `/pozvanka/[token]`, `/u/[id]` | застосунок | так | так | Договір (podmínky після юриста) |
| `/firmy`, `/firmy/kraj/[kraj]`, `/firmy/nove/[mesic]`, `/firma/[slug]`, `/provozovna/[slug]`, `/obor/[obor]/kraj/[kraj]` | каталог | так | так | LIA (DECISIONS, «Відкрите» 6) |

### 2.2 Службові та metadata-маршрути

| Маршрут | Тип | Закритий? | Має бути? | Чому |
| --- | --- | --- | --- | --- |
| `/robots.txt` | metadata | ні | ні | Помилка `Disallow: /u` (N1) |
| `/sitemap.xml` | metadata | ні | ні | Лише `STATIC_PAGES` і рецензовані гайди (`app/sitemap.ts:11-24`). Закритих URL немає (гейт `test/open-site.test.ts:40-42`) |
| `/firmy/sitemap.xml`, `/firma/sitemap/[id].xml`, `/provozovna/sitemap/[id].xml` | sitemap каталогу | так (regex `firmy\|firma\|provozovna`) | так | robots їх не оголошує (`app/robots.ts:32`) |
| `/manifest.webmanifest` | PWA | ні | ні | Але `start_url`/`id` = `/pokladna` (`app/manifest.ts:8-9`). «Встановити застосунок» з публічної сторінки → 401 (M7) |
| `/llms.txt`, `/llms-full.txt` | машинний канал | ні | ні | Подає закриту касу як доступну, «zdarma navždy» (`lib/llms.ts:41,62`; M12) |
| `/opengraph-image`, `/icons/[size]`, `/icon.svg`, `/sw.js` | статичне | ні | ні | Окремих OG-зображень фірм немає. SW реєструє лише `(app)/layout.tsx:2` |
| `/{key}.txt` → `/api/indexnow/key/[key]` | IndexNow | ні | ні | `next.config.ts:40`. 404, якщо ключ не збігається |
| `/_next/static/**` | збірка | ні | (не закрити) | Чанки закритої каси завантажуються без пароля. Секретів у клієнтському коді немає (лише `NEXT_PUBLIC_*`). Інформативно |

### 2.3 API

| Маршрут | Тип | Закритий? | Має бути? | Чому |
| --- | --- | --- | --- | --- |
| `POST /api/preregistrace` | створює запис, шле лист | ні | ні | Публічний. Ліміти: 5/10 хв на IP (`api/preregistrace/route.ts:56`); на адресу — 1 лист при створенні + 1/добу (`:136`). Відповідь однакова (`:52,143,155`) |
| `POST /api/registrace/potvrdit` | DOI | ні | ні | Стан змінює лише POST (`registrace/potvrdit/route.ts:5-9`) |
| `GET/POST /api/odhlasit` | відписка | ні | ні | GET лише показує форму, POST відписує, є one-click RFC 8058 (`odhlasit/route.ts:36-53`) |
| `GET/POST /api/anketa` | анкета, cookie `ez_voter` | ні | ні | 10/год на IP (`anketa/route.ts:31`). Зберігається HMAC голосу (`lib/server/polls.ts:15-16`) |
| `GET /api/ico/[ico]` | проксі ARES | ні | ні | Публічний інструмент. **Віддає повну адресу sídla OSVČ** (M5) |
| `POST /api/ico/hromadne` | проксі ARES | ні | ні | Ліміт на IP + глобальний бюджет (`ico/hromadne/route.ts:16,25,60`) |
| `POST/GET/OPTIONS /api/mcp` | MCP, CORS `*` | ні | ні | 120/хв на IP (`mcp/route.ts:37`). Гайди лише рецензовані (R6.5 ✅) |
| `POST /api/namitka`, `POST /api/namitka/potvrdit` | GDPR, шле лист | ні | ні | Мають працювати. Лист на довільну адресу без ліміту на адресу (M6). Токен лишається в outbox (M1) |
| `GET /api/stav-eet`, `GET /api/health` | моніторинг | ні | ні | Даних осіб немає |
| `/api/internal/*` (cron, fs-requeue, indexnow) | внутрішні | 404 у nginx (`infra/nginx/evidujzdarma.conf:61-63`) + `CRON_SECRET` | так | — |
| `/api/pokladna/{config,pin,sales,uctenka,uzaverky}` | токен пристрою | ні (`^~`, `conf:70-73`) | ні | Без сесії пристрій не зареєструвати: реєстрація йде через `/api/ucet/zarizeni` (закрито) |
| `/api/ucet` (POST створює рахунок) і 20 підмаршрутів | session cookie | так (regex) | так | **Виняток: `= /api/ucet/certifikat` обходить regex (N2)** |
| `/api/auth/{login,logout,callback}` | вхід, лист із посиланням | так | так | — |
| `/api/kabinet`, `/api/kabinet/export`, `/api/kabinet/klienti[/id[/pozvanka]]` | кабінет | так | так | — |
| `/api/pozvanka/[token]` | запрошення | так | так | — |

**Чого немає взагалі.** API пошуку каталогу (`/api/firmy`) немає, пошук рендериться на сервері в `/firmy`. OG-зображень фірм немає. Сесію публічні маршрути не читають: `getCurrentUser`/`cookies()` у `(site)` і в публічних API немає, крім `api/anketa`.

**Висновок щодо списку.** `CLOSED_SECTIONS` + `CLOSED_API` повні для застосунку й каталогу. Додавати маршрути обов'язково не треба. Відкрите лише рішення щодо `/navody` (блокер 2). Якщо закриваєте гайди:

- додати `navody` у `launch.ts` і в regex;
- прибрати посилання з лендингу (`page.tsx:75,132`) і з `registrace/potvrzeni/page.tsx:42`. Підвал фільтрується сам (`site-footer.tsx:74`).

---

## 3. nginx: блоки, готові до вставки (nginx 1.24)

**Що важливо:**

1. **Exact-локація перемагає regex.** `location = /api/ucet/certifikat` (`conf:64-67`) зараз без `auth_basic`, бо пароль стоїть на рівні `server`. Якщо прибрати його з `server`, а закрити лише regex-локаціями, цей маршрут стане відкритим. `auth_basic` у ньому обов'язковий (N2).
2. **Не повторювати `proxy_set_header` у location.** Вони успадковуються з `server`, лише якщо в location немає жодного власного. План (`open-site.md:62,66`) радить «повторити ті самі proxy_set_header». Якщо повторити не всі, location втратить решту. Наприклад, зник `X-Real-IP`:
   - `clientIp()` поверне `"unknown"` (`lib/server/rate-limit.ts:35-36`);
   - усі клієнти ділитимуть один rate-limit;
   - передреєстрація після 5 запитів за 10 хв віддасть 429 усім.
3. **`^~` для `/api/pokladna/` і `/api/internal/` лишити.** Він зупиняє пошук regex. `auth_basic off` там нешкідливий і захищає, якщо пароль колись повернуть на рівень `server`.
4. **Порядок regex-локацій не важливий:** вони не перетинаються. `/ucetni` не ловиться (`u(/|$)`). nginx декодує `%xx` і склеює `//` (`merge_slashes on`), тож `/%70okladna` і `//pokladna` теж закриті.

Замінити весь третій блок `server` (`listen 443 … server_name evidujzdarma.cz`) у `infra/nginx/evidujzdarma.conf`:

```nginx
server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name evidujzdarma.cz;

    ssl_certificate /etc/letsencrypt/live/evidujzdarma.cz/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/evidujzdarma.cz/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    server_tokens off;
    client_max_body_size 1m;

    # eet-open-site: auth_basic на рівні server прибрано. Закриті лише секції з apps/web/src/lib/launch.ts
    # (CLOSED_SECTIONS, CLOSED_API). Змінюєте список — змінюйте обидва місця.

    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_set_header X-Forwarded-Proto https;
    proxy_set_header X-Forwarded-Host $host;
    proxy_read_timeout 60s;
    # УВАГА: у location нижче НЕ додавати proxy_set_header – location тоді втратить усі серверні (X-Real-IP!).

    location ^~ /api/internal/ {
        return 404;
    }
    # exact-збіг має перевагу над regex: без auth_basic тут цей маршрут був би відкритий
    location = /api/ucet/certifikat {
        auth_basic "EvidujZdarma";
        auth_basic_user_file /etc/nginx/evidujzdarma.htpasswd;
        client_max_body_size 128k;
        proxy_pass http://127.0.0.1:3100;
    }
    # Каса: Authorization: Bearer <токен пристрою>; застосунок пускає лише з дійсним токеном
    location ^~ /api/pokladna/ {
        auth_basic off;
        proxy_pass http://127.0.0.1:3100;
    }
    location = /api/health {
        auth_basic off;
        proxy_pass http://127.0.0.1:3100;
    }
    # Закриті API (session cookie) = CLOSED_API
    location ~ ^/api/(ucet|auth|kabinet|pozvanka)(/|$) {
        auth_basic "EvidujZdarma";
        auth_basic_user_file /etc/nginx/evidujzdarma.htpasswd;
        proxy_pass http://127.0.0.1:3100;
    }
    # Закриті сторінки = CLOSED_SECTIONS (включно з /firmy/sitemap.xml, /firma/sitemap/N.xml, /provozovna/sitemap/N.xml)
    location ~ ^/(pokladna|prihlaseni|kabinet|pozvanka|u|firmy|firma|provozovna|obor)(/|$) {
        auth_basic "EvidujZdarma";
        auth_basic_user_file /etc/nginx/evidujzdarma.htpasswd;
        proxy_pass http://127.0.0.1:3100;
    }
    location / {
        proxy_pass http://127.0.0.1:3100;
    }
}
```

**Додати до smoke-тесту (`open-site.md:69-73`):**

```
curl -s -o /dev/null -w '%{http_code}\n' -X POST https://evidujzdarma.cz/api/ucet/certifikat   # 401 + WWW-Authenticate
curl -s -o /dev/null -w '%{http_code}\n' https://evidujzdarma.cz/firma/sitemap/0.xml             # 401
curl -s -o /dev/null -w '%{http_code}\n' https://evidujzdarma.cz/ucetni                          # 200
curl -s -o /dev/null -w '%{http_code}\n' https://evidujzdarma.cz/u/00000000-0000-4000-8000-000000000000  # 401
```

Перед `reload` — `nginx -t`.

**Перевірити на сервері (з репозиторію не видно):**

- **Логи.** У vhost немає `access_log`, тож діє глобальний формат `combined` з query string. У лог потрапляють токени `/registrace/potvrzeni?token=…` і `/namitka/potvrzeni?token=…` (M2).

---

## 4. Юридичні тексти: розбіжності з кодом

Стан R6.4:

- Чернетки внесено: zásady `ochrana-osobnich-udaju/page.tsx:45`, podmínky 10.2 (`podminky/page.tsx:251`), 10.3(8), 11.3 (`:289-300`).
- Версії підняті: `lib/legal.ts:2,5` (`TERMS_VERSION` 2026-10-03, `PRIVACY_VERSION` 2026-10-04).

Нижче — розбіжності, які лишилися.

### 4.1 Zásady — передреєстрація. Обов'язково до відкриття

| # | Де в zásadách | Що в коді | Розбіжність | Що виправити |
| --- | --- | --- | --- | --- |
| Z1 | `:32` «nepotvrzenou předregistraci smažeme do 90 dnů»; `:38` «Doklad o souhlasu a jeho odvolání … 3 roky» | Відписка ставить `unsubscribedAt` і `marketingConsent=false` (`api/odhlasit/route.ts:15`). Retention для непідтверджених і для записів без згоди виключає відписаних (`lib/server/lifecycle.ts:299,332`). Видаляє їх лише через 3 роки (`:308-313`). Чернетка: непідтверджений запис + «Odhlásit» → на +120 d лежить з `ico` і `companyName` | Відписка подовжує зберігання з 90 днів (або «launch + 12 міс.») до 3 років. Так і для людей, які ніколи не давали згоди: хтось інший вписав їхню адресу. Крім того, зберігається весь запис (IČO, назва з ARES, obor, needs, UTM), а не лише доказ відписки (čl. 5(1)(c),(e)) | Код: при відписці без `marketingConsentAt` — видалити запис або лишити тільки запис про блокування (адреса + `unsubscribedAt`). Зі згодою — обнулити `ico`, `companyName`, `industry`, `establishmentsCount`, `needs`, `utm`, `referredBy`. Текст: «Odhlášenou adresu si ponecháme jen jako záznam, že jí nemáme nic posílat (3 roky)» → N3 |
| Z2 | `:29-30` purpose «…a přihláška na webinář», підстава čl. 6(1)(b) | Форма вебінару: «Odesláním **souhlasíte** se zpracováním e-mailu a IČO» (`components/accountant/webinar-form.tsx:152`) | Правова підстава в UI (згода) і в zásadách (договір) різна | У формі — «E-mail a IČO zpracujeme, abychom vás přihlásili a poslali pozvánku». Без «souhlasíte» |
| Z3 | `:29` (вебінар у тому самому purpose) | Webinar-реєстрант після DOI отримує `app-ready` «Pokladna je připravena» (`lib/server/preregistration.ts:81-87`, без умови на кампанію). Лист підтвердження: «děkujeme za předregistraci… pošleme vám návody a včasný přístup k pokladně» (`lib/emails.ts:73,96`) | Мета запису (вебінар / «dejte mi vědět o kabinetu») ≠ лист про касу. Це рекламний лист без згоди (480/2004 § 7) → N4 | `app-ready` — лише для передреєстрації до каси. Шаблон підтвердження — за кампанією |
| Z4 | `:196-197` «poskytovatel doručování e-mailů»; `:212`, `:316` «**nepředáváme mimo EU**» | SMTP — Brevo (`docs/deploy.md:212`). У DECISIONS як рішення не записано («Відкрите» 1) | Категорії одержувачів закон допускає (čl. 13(1)(e)). Але абсолютне «nepředáváme mimo EU» тримається лише тоді, коли DPA і субпроцесори Brevo в ЄС. **Перевірити**: DPA Brevo, перелік субпроцесорів, вимкнений open/click tracking у Brevo (Transactional → Settings). Click tracking переписав би посилання з токенами DOI на домен Brevo; open tracking — це піксель, тобто аналітика, якої zásady не мають (`:226`) | Назвати «Brevo (Sendinblue SAS, Paříž)», записати рішення в DECISIONS, вимкнути трекінг |
| Z5 | `:223-227` cookies | Ще один ключ `localStorage` `ez_office_name` (`components/accountant/letter-templates.tsx:6,93`) | Не згаданий | Додати речення про шаблони дописів (назва kanceláře зберігається лише в браузері) |
| Z6 | `:223-224` «Pokud přijdete přes odkaz s doporučením, uložíme…» | `localStorage.setItem("ez_ref")` одразу при вході з `?ref=` (`components/prereg-form.tsx:33-38`) | Розкрито. Але запис у пристрій без дії користувача заради реферальної винагороди — питання до юриста за § 89 odst. 3 z. 127/2005 Sb. Якщо прибрати реферал Premium (блокер 1), мета зникає | Юрист. Або зберігати `ref` лише при відправці форми, без localStorage |
| Z7 | — (немає purpose) | Анкета: cookie `ez_voter` на 1 рік і `poll_votes.voter_hash` (`api/anketa/route.ts:40-47`, `polls.ts:15`) | Немає підстави і строку для голосів | Рядок у `PURPOSES` або речення в cookies: підстава čl. 6(1)(f), строк |
| Z8 | `:172` «Na webu **zveřejňujeme** katalog» | Каталог за паролем (`lib/launch.ts:7`) | Текст описує публікацію, якої немає | «Připravujeme katalog… zveřejníme jej až po…» або залишити, але це вже рішення LIA |
| Z9 | `:56` перелік даних каталогу (název, IČO, právní forma, obory, provozovny) | Сторінка námitky: «název, IČO, **DIČ**, právní forma, **data vzniku a zániku**…» (`app/(site)/namitka/page.tsx:50`) | Переліки різні | Узгодити |
| Z10 | `:281` «Tato verze platí od 4. 10. 2026» | `PRIVACY_VERSION_LABEL = "4. 10. 2026"` (`lib/legal.ts:6`) | Опублікована 3. 10. — дата в майбутньому | Виставити дату публікації (контролер, як і заплановано) |
| Z11 | `:45` (R6.4) — утримання до 60 днів | `lifecycle.ts:240-262` | ✅ відповідає коду. Правова підстава для днів 31–60 не названа (TODO юриста `podminky/page.tsx:7-8`) | Юрист |

### 4.2 Згода на маркетинг і DOI: ✅ відповідає коду

- **Текст згоди.** Окремий чекбокс, не відмічений, «(nepovinné)», однаковий у двох формах (`prereg-form.tsx:157-163`, `webinar-form.tsx:134-140`). Не змінювався з `1c5fa05`, тож версія `MARKETING_CONSENT_VERSION = 2026-09-20` (`lib/legal.ts:11`) актуальна.
- **Доказ згоди:** `consentEvidence = "souhlas:<verze>"`, `marketingConsentAt`, `confirmedAt` (`api/preregistrace/route.ts:108-111`). Опис у zásadách (`:36`) збігається.
- **Маркетинговий лист** іде лише за DOI + згода + не відписаний у момент відправки (`lib/server/mail.ts:13-19`).
- **Позначка «obchodní sdělení»** (`lib/emails.ts:49-50,117,121`) і `List-Unsubscribe` + `List-Unsubscribe-Post` (`mail.ts:124-126`).
- **GET не змінює стан** (інв. 7):
  - `/registrace/potvrzeni` лише читає (`registrace/potvrzeni/page.tsx:11-12`);
  - DOI — POST;
  - відписка — POST.

### 4.3 Podmínky

| # | Де | Що в коді | Розбіжність |
| --- | --- | --- | --- |
| T1 | 6.2 `podminky/page.tsx:149-151`: «…funkce… (…**doklad PDF** a e-mailem…) nezpoplatní» | PDF-документа немає. `content/comparison.ts:5`: «PDF připravujeme». У ceníku PDF теж немає (`content/pricing.ts:53-60`) | Зобов'язальна обіцянка функції, якої немає (інв. 10). Прибрати «PDF» |
| T2 | Підсумок `:360-361`: «Tarif Zdarma je zdarma **navždy**» | 11.2 (`:289`): провайдер може припинити Zdarma з 60-денною výpovědí | Підсумок суперечить самим умовам. Блокер 1 |
| T3 | 11.3 `:299-300`: «informuje e-mailem v den zrušení, 30. a 55. den» — безумовно | Листи 30/55 — лише коли є невідправлені production-тржби (`lifecycle.ts:142`: `if (day > 0 && n === 0) return false`) | «…a – obsahuje-li účet neodeslané ostré tržby – také 30. a 55. den» |
| T4 | 13.3 `:325` «platná od 3. 10. 2026» | Чернетка до юриста | План: публікуємо як є (блокер 3 — «так» власника) |

### 4.4 Оператор (§ 435 OZ) і «не імітуємо державу» (інв. 9)

- ✅ Оператор: `lib/site.ts:18-29` → підвал (`site-footer.tsx:89`), кожен лист (`lib/emails.ts:26,60`), zásady (`:86`), podmínky (`:39`).
- ✅ Плашка: `IndependenceBar` у шапці (`components/site-header.tsx:6-20`) і блок у підвалі (`site-footer.tsx:59-66`) — на всіх сторінках `(site)`. HTML-листи — `layout()` (`emails.ts:26`).
- ⚠️ Без плашки й оператора (M10):
  - немає `app/not-found.tsx`, тож 404 — стандартний Next;
  - HTML-сторінки `/api/odhlasit` (`odhlasit/route.ts:29-33`).

### 4.5 Трекінг

- Аналітики немає: `gtag|plausible|umami|matomo|analytics|pixel` — 0 збігів у `src`.
- CSP не пускає сторонні домени (`next.config.ts:4-17`).
- Стороннього в браузері: лише cookie анкети й два ключі `localStorage` (Z5, Z6).
- Банер згоди не потрібен, якщо Z6 визнати необхідним, а трекінг у Brevo вимкнено (Z4).

---

## 5. Публічні обіцянки (file:line)

### 5.1 «Premium na 3 měsíce za kolegu» (блокер 1: прибрати до правил акції)

- `app/(site)/page.tsx:169` — «Za pozvaného kolegu Premium na 3 měsíce pro oba».
- `app/(site)/registrace/potvrzeni/page.tsx:35` — «Pozvěte kolegu – oba získáte Premium na 3 měsíce zdarma».
- `content/pricing.ts:191-192` — FAQ ceníku «Mohu Premium získat zdarma? Ano…».
- Пов'язане: `lib/emails.ts:79,94` — «Pořadí a **doporučovací odkaz**» у службовому листі; `components/accountant/partner-badge.tsx:56-57` — «kód, který dostanete po předregistraci».

### 5.2 «Zdarma navždy» (блокер 1: «navždy» — після юриста)

- `components/tool-cta.tsx:9` (типовий текст CTA) — показується на `/navody/[slug]`, `/navody`, `/evidencni-jednotky`, `/musim-evidovat`, `/co-se-o-eet-pise-spatne`, `/o-nas`, `/kontrola-ico`, `/mcp`, `/nastroje`.
- `app/(site)/stav-eet/page.tsx:201`.
- `app/(site)/kalkulacka-eet-off/page.tsx:81`.
- `app/(site)/cenik/page.tsx:12,14,45,74`.
- `content/pricing.ts:13` (`PRICING_NOTICE`), `:51` (`period: "navždy"`), `:175` (FAQ).
- `content/landing.ts:53` (FAQ лендингу та JSON-LD FAQPage).
- `app/(site)/ucetni/page.tsx:200`.
- `app/(site)/o-nas/page.tsx:94`.
- `app/(site)/podminky/page.tsx:360-361` (див. T2).
- `lib/llms.ts:62` (машинний канал).

### 5.3 «Snímky obrazovky» та інші ще не доступні функції

| Де | Текст | Стан |
| --- | --- | --- |
| `app/(site)/page.tsx:167` | «Návod k DIS+ a certifikátu se snímky obrazovky» | ❌ Знімків немає: типи блоків гайду їх не мають, а гайд сам пише «doplníme po 1. 11.» (`content/guides/jak-aktivovat-dis-a-certifikat.ts:33,177`). Д3-6 виправив лише лист |
| `lib/emails.ts:115-120` | dis-launch: «návod krok za krokem» | ✅ Д3-6. Але: (а) лист сам о 08:00 1. 11. стверджує факт «FS zpřístupnila v DIS+…» (`preregistration.ts:88-90`), навіть якщо FS запуск відкладе; (б) посилання веде на нерецензований гайд |
| `app/(site)/srovnani/moje-eet/page.tsx:101` | «V den spuštění MOJE eet (1. 12.) doplníme recenzi se snímky obrazovky» | Обіцянка на майбутнє з датою. Прийнятно, якщо її виконають |
| `podminky/page.tsx:150` | «doklad PDF» | ❌ T1 |
| `app/(site)/ucetni/page.tsx:91-105` (JSON-LD `Event`, `EventScheduled`), `:236-245`; `components/accountant/webinars.ts:14-30` | Вебінари 5. 11. і 3. 12., «Přesný čas a odkaz… pošleme přihlášeným e-mailem» | ⚠️ Механізму розсилки немає: шаблону немає, лише ручна вибірка за `utm_campaign`. Повторна реєстрація вже відомої адреси не записується, а UI каже «Hotovo, jste přihlášeni» (N4) |
| `lib/llms.ts:41` | «…je bezplatná pokladna… funguje i bez signálu, až 5 uživatelů…» | ⚠️ AI-асистенти подадуть закриту касу як доступну (M12) |
| `components/tool-cta.tsx:4,13` | «Začněte evidovat zdarma» / кнопка «Začít evidovat zdarma» → `/#registrace` | ⚠️ Насправді веде на передреєстрацію |
| `content/pricing.ts:55` | «tržby odešle sama do 48 hodin» | ⚠️ Залежить від зв'язку пристрою. Podmínky 5.1(d) кладуть обов'язок на користувача. Краще «hlídá lhůtu 48 hodin» |
| `lib/emails.ts:125-137`, `preregistration.ts:80-87` | `app-ready` «Pokladna je připravena» — заплановано жорстко на 1. 12. 08:00 | ⚠️ Не перевіряє, чи `/pokladna` відкрито. Якщо юрист затримає — неправдивий лист і 401 (M11) |

**Гайди проти Ф11 (блокер 2) — досі є на HEAD:**

- `content/guides/eet-kadernictvi-kosmetika.ts:15,36-37,52-53` («uplatnění dárkového poukazu — Ano (čerpání)»);
- `glosar-eet.ts:80` (старий текст факту дослівно);
- `kontaktni-platba.ts:12,17,81`;
- `eet-ubytovani.ts:16,45,67-68`;
- `eet-remeslnici.ts:70,133`;
- `eet-2-0-kompletni-pruvodce.ts:208`.

Гайди мають noindex і в MCP не потрапляють. Але на них посилаються підвал, лендинг і сторінка підтвердження.

### 5.4 Маркетинг у службових листах (480/2004)

- **`login-link`, `receipt`, `notice`:** реклами немає (`lib/emails.ts:139-172`). У `notice` її теж немає: перевірено всі `enqueueEmail` у `lib/server/*`.
- **`prereg-confirm`:**
  - `:96` — «pošleme vám **návody**». Návody йдуть лише зі згодою (dis-launch), тож для людини без згоди ця обіцянка неправдива;
  - `:79,94` — «doporučovací odkaz», тобто згадка реферальної акції.

  Блоку з рекламою немає, але ці два речення варто прибрати разом із рефералом.
- **`app-ready` для webinar-реєстрантів** — рекламний лист без згоди (Z3 / N4).

---

## 6. «Решта дрібного» B: Д3-1…Д3-10 (`e93f507`, `e7d81c1`, `b24aad4`)

| Пункт | Стан | Докази (file:line) | Коментар |
| --- | --- | --- | --- |
| Д3-1 CSV-формули | ✅ | `lib/csv.ts:5-9`; `lib/server/closings.ts:2,232`; `app/api/kabinet/export/route.ts:4,46`; `app/api/ucet/export/route.ts:89` | Власних `cell` більше немає |
| Д3-2 UUID у кабінеті | ✅ | `lib/server/route-helpers.ts:86-88`; `api/kabinet/klienti/[id]/route.ts:18,37`; `…/[id]/pozvanka/route.ts:10` | 404 ще до сесії й SQL |
| Д3-3 `RichText` `/\host` | ✅ | `components/rich-text.tsx:22` | `!/^\/[\\/]/` |
| Д3-4 `ARES_MEMORY_MAX` | ✅ | `lib/server/ares.ts:55-58,70-74` | Лише ціле ≥ 1, інакше 2 000 |
| Д3-5 секрети в outbox | ⚠️ | `lib/server/mail.ts:69-74,113,134,143`; `packages/db/migrations/0025_outbox_strip_secrets.sql` | Для `prereg-confirm` і `login-link` ✅. **Лишився токен námitky:** `notice.url = /namitka/potvrzeni?token=…` (`lib/server/objections.ts:33`). Після `sent` він у payload, підтверджено чернеткою. Токени ще й у access-лозі nginx (M2) |
| Д3-6 лист DIS+ | ✅ / ⚠️ | `lib/emails.ts:115-120`, гейт `test/r6-minor-b.test.ts` | У листі виправлено. На лендингу `page.tsx:167` досі «se snímky obrazovky» |
| Д3-7 chunked | ✅ (код) | `next.config.ts:34-37`. Опція є в Next 16.3.8 (`node_modules/next/dist/server/config-schema.js:280`, `router-utils/resolve-routes.js:124`) | На standalone не перевіряв (як і звіт) |
| Д3-8 Origin на cookie-маршрутах | ✅ | `requireSameOrigin` (`route-helpers.ts:81-83`) — у 10 маршрутах (`api/ucet/route.ts`, `api/kabinet/**`, `api/pozvanka/[token]`, `api/auth/*`); решта 20 маршрутів `api/ucet/**` — через `ownerRoute` (`route-helpers.ts:110`) | Перебрав усі `route.ts` у `ucet|kabinet|pozvanka|auth`: без перевірки мутаційних немає. Хост `req.url` у `requestHosts` (`request-guard.ts:32-36`) лишився, як і описано у звіті |
| Д3-9 передреєстрація | ✅ з наслідками | `api/preregistrace/route.ts:46,69,127-143` | ✅ Злиття UTM прибрано, відписаній адресі лист не йде, довгий honeypot мовчить. **Наслідки (чернетка):** вебінар від уже зареєстрованої адреси → `{ok:true}`, `utm: null`, хоча UI каже «jste přihlášeni» (N4). Відписана адреса не може зареєструватися знову: 200, 0 листів (M3). Повторне введення підтвердженої адреси третьою особою міняє токен, і старе посилання власника → `null` (M4) |
| Д3-10 таймаути SMTP | ✅ | `lib/server/mail.ts:61`. nodemailer 10.0.13 зливає інші ключі з `url` (`dist/cjs/nodemailer.js` — `createTransport`: `shared.assign(false, copyOwnKeys(…, key === 'url'), parsed)`) | Таймаути діють. Значення з `SMTP_URL` мають пріоритет — **перевірити** на проді |

Інше за задачею:

- **R6.5 ✅.** `publicHref` (`lib/mcp/server.ts:22-30,127`). Гейт викликає 8 зареєстрованих інструментів.
- **R6.4, юридична частина ✅** з розбіжністю T3.

---

## 7. Нові знахідки

### Критично

Немає.

### Важливо

**N1. `robots.txt` блокує `/ucetni`, `/ucetni/hromadna-kontrola`, `/ucetni/sablony`.**

- **Де:** `app/robots.ts:28` додає кожну закриту секцію і без слеша (`p`), і зі слешем (`${p}/`). Правило Disallow — це префікс шляху (RFC 9309 §2.2.2). Тому `Disallow: /u` ловить усе, що починається з `/u`. `Allow: /` коротше, отже програє (найдовший збіг).
- **Наслідок:** три сторінки з `STATIC_PAGES` і sitemap (`lib/static-pages.ts:15-17`) не індексуються. Відкриваємось заради SEO на жовтень–грудень, тож ціна цієї помилки висока. Гейт `test/open-site.test.ts:22-28` перевіряє `isClosed`, а не семантику robots, і помилку пропускає.
- **Підтверджено:** чернетка → `['/ucetni <- /u', '/ucetni/hromadna-kontrola <- /u', '/ucetni/sablony <- /u']`.
- **Фікс:** `CLOSED_SECTIONS.flatMap((p) => [\`${p}$\`, \`${p}/\`])`. Google і Bing розуміють `$`. Якщо `$` не годиться для Seznam (перевірити довідку SeznamBot), достатньо `${p}/` плюс `noindex` на самих сторінках, а без пароля там і так 401.
- **Гейт (червоний зараз):** для кожного правила robots і кожного `STATIC_PAGES.path` жоден Disallow без `$` не є префіксом шляху. Плюс контроль: `/u/x`, `/pokladna` заборонені.

**N2. nginx: exact-локація `/api/ucet/certifikat` після відкриття стане без пароля.**

- **Де:** `infra/nginx/evidujzdarma.conf:64-67` + план `open-site.md:58-66`. Exact-збіг (`=`) має перевагу над regex і пошук зупиняє. Коли `auth_basic` зникне з `server`, цей маршрут лишиться без пароля.
- **Наслідок:** застосунок і далі вимагає сесію (`ownerRoute`). Але принцип «закрито в nginx» порушено, і маршрут імпорту сертифіката (multipart до 128 КБ) стає доступним ззовні.
- **Фікс:** блок із розд. 3.
- **Гейт (червоний для конфігу за планом):** інфра-тест в `apps/web/test/infra.test.ts`:
  - прочитати `infra/nginx/evidujzdarma.conf`;
  - для кожного `location` (exact, prefix, regex), який може зловити шлях з `isClosed`, вимагати власний `auth_basic "…"` або серверний;
  - для `location`, що ловить `/api/pokladna/x`, — `auth_basic off`.

  Плюс smoke `curl … /api/ucet/certifikat` → 401.

**N3. Відписка подовжує зберігання передреєстрації з 90 днів до 3 років, і зберігається весь запис (Z1).**

- **Де:** `api/odhlasit/route.ts:14-17`; `lib/server/lifecycle.ts:299,308-313,332`. Не відповідає zásadám (`ochrana-osobnich-udaju/page.tsx:32,38`).
- **Сценарій:** хтось вписав чужу адресу. Власник адреси натискає в листі «Odhlásit odběr». Запис з IČO, назвою фірми з ARES, oborom, UTM лежить 3 роки замість 90 днів. Для підтверджених без згоди — 3 роки замість «launch + 12 міс.».
- **Підтверджено:** чернетка, `runRetention(+120 d)` → рядок лишився (`ico: 12345679`, `companyName: "Jana Testovací"`).
- **Фікс:**
  - без `marketingConsentAt` — при відписці видалити запис (або лишити тільки адресу + `unsubscribedAt` як блокування);
  - зі згодою — обнулити все, крім доказу (`email`, `consentEvidence`, `marketingConsentAt`, `confirmedAt`, `unsubscribedAt`);
  - текст zásad — як у Z1.
- **Гейт (червоний зараз):** непідтверджений запис з IČO → POST `/api/odhlasit` → `runRetention(+120 d)` → запису немає (або в ньому лише адреса й `unsubscribedAt`). Плюс варіант зі згодою: після відписки `ico`, `companyName`, `utm` = null.

**N4. Вебінар і передреєстрація змішані: хибне «jste přihlášeni» і реклама каси без згоди (Z2, Z3).**

- **Де:** `components/accountant/webinar-form.tsx:28-37,44,57-76` шле в `/api/preregistrace` з `utm_campaign`.
  - **(а) Повторна реєстрація.** Після Д3-9 від уже відомої адреси вона нічого не записує (`api/preregistrace/route.ts:127-143`). Сервер ніколи не повертає `duplicate`, тож гілка `:57-67` мертва. UI каже «Hotovo, jste přihlášeni… Přesný čas a odkaz… pošleme». Так само друга дата вебінару від тієї самої адреси губиться.
  - **(б) Що отримує webinar-реєстрант.** Лист «děkujeme za předregistraci… pošleme vám návody a včasný přístup k pokladně» (`lib/emails.ts:73,96`). Після DOI — `app-ready` «Pokladna je připravena», без умови на кампанію (`lib/server/preregistration.ts:81-87`). Людина просила вебінар або повідомлення про кабінет, тож це рекламний лист без згоди (480/2004 § 7, Ф7).
- **Підтверджено (а):** чернетка → `{ ok: true }`, `utm: null`.
- **Фікс:**
  - окрема таблиця інтересу `(preregistration_id, campaign, requested_at, confirmed_at)`. Для нової адреси підтверджувати тим самим DOI. Для відомої адреси — окремий лист із POST-підтвердженням інтересу, без зміни самого запису (так закриття Д3-9 не відкочується);
  - шаблон підтвердження — за кампанією;
  - `app-ready` — лише для передреєстрації до каси.
- **Гейти (червоні зараз):**
  - запис з `utm_source=ucetni` → `confirmPreregistration` → у outbox немає `app-ready`;
  - відома адреса реєструється на вебінар → є запис інтересу, що чекає підтвердження, а в `preregistrations` нічого не змінено.

### Дрібне

**M1. Д3-5 неповний: токен підтвердження námitky лишається в `email_outbox.payload`.**

- **Де:** `lib/server/objections.ts:24-35` (`template: "notice"`, `url` з токеном); `withoutSecrets` знає лише `prereg-confirm` і `login-link` (`mail.ts:69-74`).
- **Сценарій:** із бекапу чи доступу до БД можна підтвердити чужу námitku. Для юридичної особи це ставить сторінці `noindex` (`objections.ts:50`).
- **Підтверджено:** чернетка, після `processOutbox` → `sent`, а `payload.url` містить токен.
- **Фікс:** у `withoutSecrets` для `notice` прибирати `token` з query `url`. Або загальніше: payload-поле `secretKeys` чи прапорець `stripUrlAfterSend`. Плюс міграція для старих рядків (за зразком 0025).
- **Гейт:** чернетковий тест «objection token» (червоний зараз).

**M2. Токени в access-лозі nginx («перевірити»).**

- **Де:** у vhost немає `access_log` (`infra/nginx/evidujzdarma.conf`), тож діє глобальний `combined` з `$request`. У лог потрапляють `GET /registrace/potvrzeni?token=…` (токен дійсний 30 днів, після підтвердження — безстроково для сторінки стану: `preregistration.ts:44`) і `/namitka/potvrzeni?token=…`. Той самий ризик, що Д3-5, лише в лозі.
- **Фікс:** у vhost `log_format ez '$remote_addr - [$time_local] "$request_method $uri $server_protocol" $status $body_bytes_sent';` і `access_log /var/log/nginx/evidujzdarma.access.log ez;`.

**M3. Відписана адреса більше не може передреєструватися.**

- **Де:** `api/preregistrace/route.ts:130`.
- **Сценарій:** людина колись відписалася, тепер хоче ранній доступ. Отримує 200 і «Poslali jsme vám…» (`components/prereg-form.tsx:192-193`), але листа немає.
- **Підтверджено:** чернетка → 200, +0 листів.
- **Фікс:** у тексті успіху додати «Pokud jste se dříve odhlásili, napište nám na …». Або DOI для повторної підписки з лімітом 1 лист / 30 днів на адресу.

**M4. Третя особа може «вбити» посилання стану підтвердженого користувача.**

- **Де:** `api/preregistrace/route.ts:131-139` міняє `confirmTokenHash` і для підтвердженого запису.
- **Підтверджено:** чернетка → старе посилання повертає `null`. Новий лист власник отримує, тож це лише незручність.
- **Фікс:** для `confirmedAt` не міняти хеш, а слати окремий токен сторінки стану. Або прийняти й задокументувати.

**M5. `/api/ico/[ico]` віддає повну адресу sídla OSVČ.**

- **Де:** `app/api/ico/[ico]/route.ts:14-16` повертає `...found`, тобто `subject.address` з `street`, `postalCode`, `text` (`packages/cz/src/ares.ts:83-99`).
- **Невідповідність:** UI показує лише obec (`components/ico-result.tsx:51`), MCP для фізосіб теж лише obec (`lib/mcp/server.ts:116-117`). Після відкриття API стає публічним проксі ARES з кешем.
- **Фікс:** для `isNaturalPerson` — `address: { city, regionCode, regionName }`.
- **Гейт:** фікстура фізособи з `nazevUlice` → у JSON немає `street` (червоний).

**M6. `/api/namitka`: необмежено листів на одну адресу.**

- **Де:** `app/api/namitka/route.ts:48` — лише 5/год на IP. Кожен POST — новий рядок і новий лист (`objections.ts:24-36`, dedupe за id).
- **Наслідок:** після відкриття — розсилка на чужу адресу з кількох IP і удар по репутації домену в Brevo.
- **Фікс:** `rateLimit(\`namitka-to:${email}\`, 3, 86_400)`.
- **Гейт:** 4 POST з однаковим e-mailem з різних IP → ≤ 3 листи (червоний).

**M7. Посилання й структуровані дані ведуть у закриті секції; гейт open-site їх не бачить.**

- **Де:**
  - `app/(site)/namitka/page.tsx:29` (crumb `/firmy`) і `:58` («Zpět do katalogu firem»);
  - `lib/jsonld.tsx:55` — `SoftwareApplication.url = /pokladna` на лендингу (`page.tsx:37`);
  - `app/manifest.ts:8-9` — `start_url /pokladna`.
- **Фікс:**
  - фільтр через `isClosed`;
  - у JSON-LD — `absoluteUrl("/")`, поки каса закрита;
  - у маніфесті — `start_url` тільки після відкриття або посилання на маніфест лише в `(app)`.
- **Гейт:** розширити `test/open-site.test.ts`: рендер `/namitka` і JSON-LD лендингу без закритих href (червоний).

**M8. Podmínky:** T1 (PDF), T2 («navždy» проти 11.2), T3 (листи 30/55). Розд. 4.3.

- **Гейт:** legal-тест — 6.2 не містить «PDF», поки немає PDF-документа; 11.3 містить умову про невідправлені тржби.

**M9. Zásady, дрібниці:** Z5, Z7, Z8, Z9, Z10. Розд. 4.1.

- **Гейт:** legal-тест — кожен ключ `localStorage.setItem("…")` у `src/components/**` згаданий у розділі cookies (червоний для `ez_office_name`).

**M10. Сторінки без плашки й оператора.**

- **Де:** немає `app/not-found.tsx` (стандартний 404 Next); HTML-сторінки `/api/odhlasit` (`odhlasit/route.ts:29-33`). Інв. 9: «на кожній сторінці».
- **Фікс:** `app/not-found.tsx` з `SiteHeader`/`SiteFooter`; в `odhlasit` — `SITE.independenceNotice` і `operatorLine()`.
- **Гейт:** рендер `not-found` містить `independenceNotice` (червоний: файлу немає).

**M11. `app-ready` і `dis-launch` ідуть за календарем, а не за станом.**

- **Де:** `preregistration.ts:80-90`; `mail.ts:13-19` (`blockedReason` не знає про `launch.ts`).
- **Наслідок:** якщо 1. 12. `/pokladna` ще закрита, піде «Pokladna je připravena» з посиланням, яке дасть 401. dis-launch 1. 11. стверджує факт про FS, не перевіривши його.
- **Фікс:** у `blockedReason` для `app-ready` — `isClosed("/pokladna") ? "NOT_LAUNCHED"`, з відкладенням `sendAfter` замість скасування. dis-launch — ручний тригер контролера.
- **Гейт:** `app-ready` при закритій `/pokladna` → не `sent` (червоний).

**M12. `llms.txt` і CTA подають закриту касу як доступну.**

- **Де:** `lib/llms.ts:41` (теперішній час), `:62` («zdarma navždy»); `components/tool-cta.tsx:4,13`.
- **Фікс:** поки `isClosed("/pokladna")`, писати «předregistrace k bezplatné pokladně (spouštíme v prosinci 2026)», а CTA — «Předregistrovat zdarma».
- **Гейт:** `llmsTxt()` містить «předregistr» при закритій касі (червоний).

---

## Що потребує людини

- **Власник:** блокери 1 і 3 з `open-site.md` (Premium-реферал, «navždy», публікація чернеток без юриста).
- **Контролер:**
  - nginx — розд. 3, обов'язково з exact-локацією сертифіката (N2);
  - деплой не нижче `1aec031` з міграціями 0024 і 0025;
  - блокер 2 — гайди проти Ф11: виправити або закрити `/navody`;
  - Brevo: DPA, субпроцесори, вимкнений open/click tracking (Z4);
  - формат access-логу (M2);
  - таймаути в `SMTP_URL` (Д3-10).
- **Кодова сесія до відкриття:** N1, N3, N4, M1, M7, M10, M12. Решту дрібного можна після.
- **Юрист:** Z6 (`localStorage` для реферала), Z11 (підстава для днів 31–60), T2.
