# Рецензія змісту та юридичних тверджень: EvidujZdarma.cz

Стан репозиторію: коміт `c88e2fc`, лише читання (нічого не змінено). Дата рецензії 2. 10. 2026.
Усі шляхи нижче відносні до `apps/web/src/`, якщо не вказано інше. Номери рядків звірено з поточними файлами.

Зведення: 5 критичних, 16 важливих, 21 дрібне. Головна проблема одна, і вона розходиться всім сайтом через `facts.ts`: лютий 2027 подано як початок обов'язку («ostrý provoz»), а січень як «dobrovolný… nanečisto». Друга проблема: порівняння з MOJE eet містить неперевірені «Ne». Третя: юридичних сторінок і даних оператора поки немає зовсім, хоча форма вже збирає персональні дані.

---

## Критичне

### К1. Січень 2027: «pilotní (dobrovolný) provoz», «nanečisto», «ostrý provoz od 1. 2.» суперечать факту 1

**Чому це не так.** Закон набирає чинності 1. 1. 2027 і не передбачає ні добровільного режиму, ні відкладення санкцій. Harmonogram на eet.gov.cz каже лише «v pilotním režimu». Сайт натомість у 8 місцях (плюс лист, llms.txt і JSON-LD) подає 1. 2. 2027 як дату, від якої «se musí evidovat», а hero-лічильник рахує дні до 1. 2. Через `FACTS`/`TIMELINE` ці тексти автоматично потрапляють у лист з EET-планом, у llms.txt і в FAQPage JSON-LD, тобто AI-відповіді цитуватимуть їх як факт. Підприємець, який повірить сайту, у січні не евідуватиме.

Місця й заміни:

1. **content/facts.ts:86–92** (TIMELINE, 1. 1. 2027)
   Зараз: `title: "Účinnost zákona, pilotní provoz"`, `action: "Zákon nabývá účinnosti. Leden je pilotní (dobrovolný) provoz – ideální čas na zkoušku nanečisto."`, `source: SOURCES.mfPredstavuje`
   Заміна:
   ```ts
   title: "Účinnost zákona – evidujte od 1. 1.",
   action: "Zákon o evidenci tržeb nabývá účinnosti. Finanční správa ohlásila pro leden pilotní režim, zákon ale platí od 1. 1. 2027 a odklad povinnosti ani sankcí nestanoví. Evidujte tržby od 1. 1. 2027.",
   source: SOURCES.harmonogram,
   ```
   (Джерело: harmonogram замість прес-релізу МФ, бо саме там формулювання «pilotní režim».)

2. **content/facts.ts:100–107** (TIMELINE, 1. 2. 2027)
   Зараз: `title: "Ostrý provoz"`, `action: "Tržby přijaté hotově, kartou nebo QR kódem při osobním kontaktu se musí evidovat."`
   Чому не так: з тексту випливає, що до 1. 2. евідувати не треба.
   Варіант A (рекомендую): видалити пункт (і змінити `md:grid-cols-5` у `components/timeline.tsx:17` на 4).
   Варіант B, якщо 1. 2. дослівно є в harmonogramu:
   ```ts
   title: "Konec pilotního režimu",
   action: "Podle harmonogramu Finanční správy končí lednový pilotní režim. Povinnost evidovat ale podle zákona platí už od 1. 1. 2027.",
   ```

3. **content/facts.ts:109** + **components/timeline.tsx:4, 8** (лічильник у hero)
   Зараз: `LIVE_DATE = "2027-02-01"` і текст `"… do ostrého provozu EET 2.0"`
   Заміна: `LIVE_DATE = "2027-01-01"`; текст: `{…"dní"} do účinnosti zákona o evidenci tržeb (1. 1. 2027)`

4. **content/landing.ts:45** (FAQ «Od kdy platí EET 2.0?», іде також у FAQPage JSON-LD)
   Зараз: «… Leden je podle Ministerstva financí pilotní (dobrovolný) provoz, ostrý provoz začíná 1. 2. 2027. …»
   Заміна:
   > Zákon o evidenci tržeb nabývá účinnosti 1. 1. 2027 a od tohoto dne je třeba tržby evidovat. Finanční správa ohlásila, že v lednu bude evidence fungovat v pilotním režimu; zákon ale odklad povinnosti ani sankcí nestanoví – evidujte proto od 1. 1. 2027. Přípravu v DIS+ – přihlášení k evidenci, evidenční jednotky a pokladní certifikát – lze zahájit od 1. 11. 2026.

5. **lib/eet-assessment.ts:142–148** (чекліст після перевірки за IČO)
   Зараз: `"V lednu běží pilotní provoz – vyzkoušejte si evidenci nanečisto."` і окремий пункт `"Ostrý provoz" / "Od 1. 2. 2027 musí být každá evidovaná tržba odeslána."`
   Заміна (один пункт замість двох):
   ```ts
   { date: "1. 1. 2027", title: "Evidujte od 1. 1. 2027",
     text: "Zákon platí od 1. 1. 2027. Finanční správa ohlásila pro leden pilotní režim, odklad povinnosti ani sankcí ale zákon nestanoví – mějte pokladnu připravenou do konce roku 2026.",
     href: "/#registrace" }
   ```
   Пункт «Ostrý provoz» видалити.

6. **components/tools/quiz.tsx:121** (результат `r-yes`)
   Зараз: «… Ostrý provoz začíná 1. 2. 2027.»
   Заміна: «… Tržby evidujte od 1. 1. 2027 – Finanční správa sice ohlásila pro leden pilotní režim, zákon ale odklad sankcí nestanoví.»

7. **app/(site)/musim-evidovat/page.tsx:33** (lead)
   Зараз: «Evidence tržeb EET 2.0 platí od 1. 1. 2027, ostrý provoz od 1. 2. 2027. …»
   Заміна: «Zákon o evidenci tržeb (EET 2.0) platí od 1. 1. 2027. Odpovězte na nejvýše 6 otázek a zjistěte, zda se vás pravděpodobně týká, zda máte výjimku, nebo můžete zvolit EET OFF.»

8. **content/guides/eet-bez-internetu.ts:12** (lead; гайд noindex, але публічний і йде в llms-full.txt)
   Зараз: «… Pravidlo platí od ostrého provozu **1. 2. 2027**.»
   Заміна: «… Pravidlo platí od účinnosti zákona **1. 1. 2027**.»

9. **Куди це поширюється** (виправиться разом із `facts.ts`, але після правки перевірити): `lib/emails.ts:53` (EET-план у листі `prereg-confirm`), `lib/llms.ts:13` (llms.txt / llms-full.txt), `app/(site)/page.tsx:34` (FAQPage JSON-LD з LANDING_FAQ).

10. **content/facts.ts:6, 10**: після правок оновити `FACTS_UPDATED = "2026-10-02"` і коментар «Stav ověření».

Застереження для того, хто правитиме: не замінювати «dobrovoln» масово. У `facts.ts:169` («Režim EET OFF je dobrovolný») слово стоїть правильно.
Технічне: `eet-assessment.ts:143, 148` звертається до `TIMELINE[2]!` і `TIMELINE[4]!`. Після видалення пункту 1. 2. `TIMELINE[4]` стане `undefined`, і `.dateLabel` впаде з TypeError. Треба шукати пункт за `date`, а не за індексом (див. В15).

### К2. FAQ на сторінці QR-платби вводить в оману щодо евіденції QR-платежів

**app/(site)/qr-platba/page.tsx:17–19**
Зараз: «Záleží na tom, jak zákon o evidenci tržeb vymezuje evidované platby. Bezhotovostní převod na účet se v původní EET neevidoval; jak je tomu v EET 2.0, popisujeme v návodu Kontaktní platba: co se eviduje a co ne. …»
**Чому не так.** Сайт сам стверджує в `facts.ts:122` з первинним джерелом (MF, eet.gov.cz), що QR-платіж при osobním kontaktu евідується. Цей FAQ натякає на протилежне, і саме на сторінці генератора QR, яким продавець користуватиметься за прилавком. До того ж посилання на гайд «Kontaktní platba» веде на 404.
Заміна:
> Ano, pokud vám zákazník zaplatí QR kódem při osobním kontaktu – v provozovně, u stánku nebo u vás na místě. Podle Ministerstva financí a eet.gov.cz se taková platba eviduje stejně jako hotovost nebo karta. Neeviduje se platba na dálku, například přes QR kód na webu e-shopu nebo úhrada faktury převodem. Bankovní převod, který zákazník odešle na místě bez QR kódu, oficiální zdroje zatím jednoznačně neřeší.

Під FAQ додати рядок «Zdroje:» з `SOURCES.kdoMusi` і `SOURCES.mfPredstavuje`.

### К3. Порівняння з MOJE eet: неперевірені «Ne» та «Jednodušší než státní aplikace»

**Чому не так.** MOJE eet ще не запущена (старт 1. 12. 2026). З джерел маємо лише: веб, 2 jednotky, 2 zaměstnanci, katalog, PDF doklady, 2FA (усе [S]). Офлайн у нас позначено [S/?]. Про термінал, принтери, e-mail-чеки й експорт джерел немає взагалі. Подавати це як «Ne» означає klamavé srovnání: тексти підуть у FAQPage, у llms.txt і в AI-відповіді. До того ж це суперечить нашому ж принципу «чесне порівняння». «Jednodušší» — суб'єктивна оцінка, яку неможливо перевірити.

1. **content/comparison.ts:8**: `state: "Ne – vyžaduje připojení"` → `state: "Nezveřejněno – podle dostupných informací vyžaduje připojení"`
2. **content/comparison.ts:10, 11, 13**: `state: "Ne"` (platební terminál; tiskárna, čtečka; přehledy a export) → `state: "Nezveřejněno"`
3. **content/comparison.ts:12**: `state: "Ne"` (účtenka e-mailem / SMS / QR) → `state: "Nezveřejněno (PDF doklad ano)"`
4. **components/comparison-table.tsx:35–50** (примітка під таблицею), дописати в кінці:
   > Stav k 2. 10. 2026. MOJE eet zatím není spuštěná – údaje upřesníme podle oficiálního popisu Finanční správy. Pokud najdete nepřesnost, napište nám na ahoj@evidujzdarma.cz.
5. **content/facts.ts:188**: «… Pro provoz potřebuje připojení k internetu.» → «… Zda bude fungovat bez připojení k internetu, Finanční správa zatím nezveřejnila; podle dostupných informací připojení vyžaduje.» (текст іде в llms.txt через `llms.ts:22`)
6. **app/(site)/page.tsx:45** (hero): «Jednodušší než státní aplikace, funguje i bez signálu.» → «Bezplatná pokladna pro EET 2.0, která funguje i bez signálu.»
7. **app/(site)/page.tsx:106–107**: «Státní aplikace je dobrá volba pro nejmenší podnikatele. My přidáváme to, co stát nedělá: práci bez signálu, …» →
   > Státní aplikace MOJE eet je dobrá volba pro nejmenší podnikatele. My navíc nabízíme práci bez signálu, tiskárny, účtenky e-mailem a nástroje pro účetní – funkce, které MOJE eet podle dosud zveřejněných informací nemá.
8. **content/facts.ts:83** (TIMELINE 1. 12., через нього й у лист): «… státní MOJE eet, nebo pokladnu s prací bez signálu.» → «Vyberte pokladnu a vyzkoušejte si ji – státní MOJE eet, nebo jinou pokladnu, například EvidujZdarma.»
9. **content/guides/eet-bez-internetu.ts:73**: «Podle zveřejněných informací potřebuje MOJE eet pro provoz připojení k internetu. …» → «Finanční správa zatím nezveřejnila, zda MOJE eet bude fungovat bez připojení; podle dostupných informací ([Podnikatel.cz](https://www.podnikatel.cz/clanky/jak-bude-fungovat-aplikace-zdarma-moje-eet-zjistili-jsme-detaily-od-financni-spravy/)) připojení vyžaduje. Pokladna EvidujZdarma tržby bez signálu ukládá a odešle je automaticky později.» Також додати `SOURCES.mojeEet` у `sources` (рядок 76).

### К4. На сайті немає ідентифікації оператора (§ 435 OZ)

**lib/site.ts:18–23**, **components/site-footer.tsx:80–88**
Зараз: `ico`, `address`, `registry` беруться з env і за замовчуванням порожні, тож у футері буде лише «Provozovatel: Swipe Scape s.r.o. · ahoj@…».
**Чому не так.** § 435 občanského zákoníku вимагає від підприємця вказувати на веб-сторінках firmu, sídlo, IČO і zápis do obchodního rejstříku (oddíl, vložka). Для нового сервісу, що конкурує з державною аплікацією, анонімний оператор ще й підриває довіру.
Заміна (заповнити env або захардкодити; у production збірку з порожніми значеннями варто валити):
> Provozovatel: Swipe Scape s.r.o., IČO …, se sídlem …, zapsaná v obchodním rejstříku vedeném Krajským soudem v …, oddíl C, vložka … · ahoj@evidujzdarma.cz

Те саме потрібно на сторінці «O nás a kontakt» (поки не існує).

### К5. Персональні дані збираються, а сторінок zásady ochrany osobních údajů і obchodní podmínky немає

**components/prereg-form.tsx:174–180** посилається на `/ochrana-osobnich-udaju`, а **components/site-footer.tsx:39–42** на `/o-nas`, `/podminky`, `/ochrana-osobnich-udaju`, `/namitka`. Жодна з цих сторінок не існує (у `app/(site)` їх немає, тож це 404).
**Чому не так.** З 15. 10. форма збиратиме e-mail, IČO, обор, počet provozoven, potřeby, UTM, referral і хеш IP+UA (`api/preregistrace/route.ts:86`). Стаття 13 GDPR вимагає надати інформацію в момент збору. Без zásad це прямий ризик претензії від ÚOOÚ. VOP потрібні щонайменше тому, що сайт обіцяє «zdarma navždy» і Premium за реферал.
Що робити: до запуску опублікувати сторінки зі змістом із розділу «Чого бракує» (пункти 2–3).

---

## Важливе

### В1. EET OFF: неповні умови (факт 5) і категоричні формулювання
- **content/facts.ts:170–171** (`howTo`). Зараз: «Oznámení … do 10. dne zdaňovacího období – pro rok 2027 do 11. 1. 2027 (10. 1. je neděle). Pozdní oznámení je neúčinné.» Бракує випадку відкриття бізнесу посеред року і незмінності режиму. Заміна:
  > Oznámení o přihlášení k přirážce se podává do 10. dne zdaňovacího období – pro rok 2027 do 11. 1. 2027 (10. 1. je neděle). Pozdní oznámení je neúčinné. Kdo zahajuje činnost v průběhu roku, podává oznámení o vstupu do paušálního režimu nejpozději v den zahájení činnosti (postup pro přirážku EET OFF viz eet.gov.cz). V průběhu roku režim změnit nelze.
- Додати нові поля:
  - `FACTS.eetOff.overLimit`: «Překročí-li vaše příjmy v průběhu roku 1 mil. Kč, přirážku podle Finanční správy platíte až do konce roku. Od kdy pak tržby evidovat, Finanční správa výslovně neuvádí – podle dostupných informací od následujícího roku.»
  - `FACTS.eetOff.leave`: «Z režimu EET OFF se odhlásíte oznámením podaným nejpozději do 10. dne následujícího zdaňovacího období (pro rok 2028 do 10. 1. 2028).»
  - Друга частина `overLimit` має лише вторинне джерело (eetoff.cz), див. «Питання до власника».
- **app/(site)/kalkulacka-eet-off/page.tsx:28–30**. Зараз: «Přesný postup při překročení limitu během roku zatím Finanční správa podrobně nepopsala…» Застаріло. Замінити на `FACTS.eetOff.overLimit` і додати FAQ «Jak se z EET OFF odhlásím?» з текстом `FACTS.eetOff.leave`.
- **lib/eet-assessment.ts:91**. Зараз: «Splňujete podmínky EET OFF: … Oznámení podejte do 11. 1. 2027.» Заміна: «Podle vašich odpovědí pravděpodobně splňujete podmínky EET OFF: místo evidence můžete platit přirážku 1 400 Kč měsíčně. Oznámení podejte do 11. 1. 2027 (kdo zahajuje činnost v průběhu roku, řídí se jinou lhůtou – viz eet.gov.cz).»
- **components/tools/quiz.tsx:109–110**. Зараз: title «Evidovat musíte – nebo zvolte EET OFF», text «Splňujete podmínky režimu EET OFF: …». Заміна: title «Pravděpodobně můžete zvolit EET OFF»; text «Podle vašich odpovědí pravděpodobně splňujete podmínky režimu EET OFF: za přirážku 1 400 Kč měsíčně k paušální záloze tržby evidovat nemusíte. Pokud EET OFF nezvolíte, tržby přijaté osobně budete evidovat. {howTo}»
- **components/tools/eet-off-calculator.tsx:184**. До «Pozdní oznámení je neúčinné a zpětně se přihlásit nelze.» дописати: «Kdo zahajuje činnost v průběhu roku, má jinou lhůtu – viz eet.gov.cz. Zvolený režim platí do konce roku.»
- **content/landing.ts:14**. «Přihlásit se lze do 11. 1. 2027.» → «Přihlásit se lze do 11. 1. 2027 (při zahájení činnosti během roku platí jiná lhůta).»

### В2. Калькулятор EET OFF звучить як порада й не враховує частину року (пункт B)
- **components/tools/eet-off-calculator.tsx:132–136**: «EET OFF se vám pravděpodobně vyplatí.» / «Evidence vás vyjde levněji než EET OFF.» / «Vychází to zhruba nastejno.» звучать як рекомендація у податковому рішенні. Заміна: «Podle zadaných údajů vychází levněji EET OFF.» / «Podle zadaných údajů vychází levněji evidence.» / «Podle zadaných údajů vycházejí obě varianty zhruba nastejno.»
- Дисклеймер «nejde o daňové poradenství» є лише внизу сторінки після FAQ (**kalkulacka-eet-off/page.tsx:66**), а не біля результату. У картку результату після таблиці (після рядка 181) додати: «Orientační výpočet z vašich údajů, nejde o daňové poradenství. Zvolený režim platí do konce roku – v nejasných případech se poraďte s daňovým poradcem.»
- **eet-off-calculator.tsx:104**: hint «EvidujZdarma: 0 Kč.» з дефолтом 0 подає наш продукт як єдину безкоштовну касу. Заміна: «0 Kč = bezplatná pokladna (např. státní MOJE eet nebo EvidujZdarma). Platíte-li za pokladnu, zadejte měsíční cenu.»
- **kalkulacka-eet-off/page.tsx:25**: «Pokladna EvidujZdarma je zdarma, takže u nás rozhoduje hlavně čas.» → «S bezplatnou pokladnou (státní MOJE eet nebo EvidujZdarma) rozhoduje hlavně čas, který evidenci věnujete.»
- **lib/eet-off.ts:54**: `surchargeYearly = surchargeMonthly * 12` завжди рахує повний рік, хоча частина 2027 (дата відкриття) не моделюється. Мінімум: під калькулятором написати «Kalkulačka počítá s celým rokem 2027. Zahajujete-li činnost v průběhu roku, platí jiná lhůta pro oznámení – viz eet.gov.cz.» Поле «měsíce činnosti» додавати лише після підтвердження, що přirážka платиться пропорційно (зараз це не визначено).
- Перевищення 1 млн у калькуляторі обробляється лише як «nejste způsobilí» (**eet-off.ts:51–52**), без пояснення наслідків → у блок неприйнятності додати `FACTS.eetOff.overLimit`.
- **eet-off.ts:50**: «Ve 2. a 3. pásmu musíte tržby evidovat.» → «Ve 2. a 3. pásmu EET OFF zvolit nelze.»
- **eet-off-calculator.tsx:122**: «Tržby přijaté osobně budete evidovat.» → «Pokud přijímáte platby osobně (hotově, kartou, QR kódem na místě), budete je pravděpodobně evidovat.»
- Паушал 2027 позначений як попередній (рядок 181 і FAQ на сторінці, рядок 21), це прийнято.
- **test/tools.test.ts**: бракує тестів на межу `income: 1_000_000` (має бути eligible, бо `>` у `eet-off.ts:51`), на зону «tie» (±1 200 Kč) і на від'ємні значення.

### В3. Квіз і перевірка за IČO: вироки замість «pravděpodobně» (пункт C)
- **quiz.tsx:85**: «Evidence tržeb se vás netýká» → «Evidence tržeb se vás pravděpodobně netýká»
- **quiz.tsx:120**: «Ano, tržby budete evidovat» → «Pravděpodobně budete tržby evidovat»
- **quiz.tsx:131**: «Ano, tržby budete evidovat – i mimo provozovnu» → «Pravděpodobně budete tržby evidovat – i mimo provozovnu»
- **lib/eet-assessment.ts:102**: «Subjekt podle ARES zanikl – evidence tržeb se ho netýká.» → «Subjekt podle ARES zanikl – evidence tržeb se ho pravděpodobně netýká.»
- Решта заголовків IČO (рядки 105–109) уже обережні, це прийнято.

### В4. Чекліст IČO показує «do 1. 11. 2026» для DIS+, хоча це дата відкриття
**lib/eet-assessment.ts:116–117** + **components/ico-result.tsx:140** (`do {c.date}` для всіх пунктів).
До 1. 11. користувач бачить «Přihlášení k evidenci v DIS+ do 1. 11. 2026», тобто термін, у який зробити це фізично неможливо.
Виправлення: додати в `ChecklistItem` поле `datePrefix: "od" | "do"`. Для DIS+: `od 1. 11. 2026`, текст «Od 1. 11. 2026 se v DIS+ (MOJE daně) přihlaste k evidenci tržeb – nejlépe s předstihem před 1. 1. 2027.»
Також: коли `eetOff === "possible"`, у чеклісті лишаються кроки «certifikát» тощо. Додати пункт: «Pokud zvolíte EET OFF, tržby neevidujete – certifikát ani pokladnu pak nepotřebujete.»

### В5. Майстер evidenčních jednotek видає директиву і завищує кількість для вебу
- **components/tools/units-wizard.tsx:100–104**: «Doporučení» / «Oznamte v DIS+ N evidenčních jednotek» → «Orientační výsledek» / «Pravděpodobně oznámíte N evidenčních jednotek».
- **units-wizard.tsx:52** (web): «Web nebo aplikace, přes které nabízíte zboží či služby. Platby přes platební bránu se ale neevidují.» Якщо оплата йде лише через bránu, евідованих тржб немає, а майстер усе одно рахує web як jednotku. Заміна: «Web nebo aplikace, přes které prodáváte. Zda web oznamovat, i když přes něj přijímáte jen platby na dálku (brána, převod), oficiální zdroje výslovně neuvádějí – takové platby se neevidují.»
- **content/facts.ts:153**: «Podnikatel bez provozovny uvede jako jednotku sám sebe.» Джерело [P] каже «OSVČ» (research:74). → «Fyzická osoba podnikající bez provozovny uvede jako jednotku sama sebe.» Сам майстер для PO вже обережний (рядки 118–122), це прийнято.

### В6. Факти з вторинних джерел [S] приписано первинному [P] (принцип «кожен факт — з першоджерелом»)
- **content/facts.ts:155** `units.change`: «… nejpozději do 15 dnů.» Позначка [S] (research:78), а джерело в коді `SOURCES.jakZacit` [P]. Текст використовується в `evidencni-jednotky/page.tsx:19`, `landing.ts:69`, `units-wizard.tsx:129`, `llms.ts:18` і в листі `lib/server/reminders.ts:91` («do 15 dnů»). Доки немає первинного джерела, заміна: «Změnu údajů o evidenční jednotce oznamte v DIS+ ještě před první tržbou po změně. Přesnou lhůtu Finanční správa zatím podrobně nepopsala (podle dostupných informací 15 dnů).»
- **content/facts.ts:132–133** `exemptions`: перелік вилучених činností має позначку [S] (research:33–34), а джерело `kdoMusi` [P]. Заміна початку: «Zákon vyjímá z evidence některé činnosti – podle dostupných informací např. …»; або звірити перелік на eet.gov.cz і лишити [P].
- **content/facts.ts:180–185** `penalties`: єдине джерело Podnikatel.cz [S]. Сам факт підтверджено, але потрібне первинне посилання (текст закону, sněmovní tisk 189, або сторінка eet.gov.cz про санкції). Додати в `sources`.
- **content/facts.ts:144** «může být i elektronický» [S]: окремого джерела на цю частину немає (дрібне, але в тій самій правці).

### В7. «Zdarma navždy» як юридично обов'язкова обіцянка без VOP; розбіжність щодо SMS
- **content/landing.ts:53**, **components/tool-cta.tsx:9**, **kalkulacka-eet-off/page.tsx:69**, **lib/llms.ts:49**: «zdarma navždy». Без закріплення у VOP це реклама, яку неможливо гарантувати. Заміна: «zdarma bez časového omezení – závazek najdete v obchodních podmínkách» (або закріпити «navždy» у VOP).
- Розбіжність: **llms.ts:32** «… až 5 uživatelů a 3 evidenční jednotky zdarma, účtenka e-mailem, SMS i QR», тоді як **landing.ts:53** каже, що SMS-чеки платні. → llms.ts:32: «… účtenka e-mailem a QR (SMS jako placený doplněk) …».
- **llms.ts:49**: «Premium 149 Kč/měsíc» опубліковано, хоча сторінки ceníku немає (див. питання).

### В8. Текст про обробку даних у формі передреєстрації: неправильна правова підстава й неповний обсяг
**components/prereg-form.tsx:174–180**. Зараз: «Odesláním souhlasíte se zpracováním e-mailu a IČO za účelem předregistrace a zaslání EET plánu.» Підставою тут є виконання запиту (čl. 6/1/b GDPR), а не souhlas. До того ж форма збирає більше, ніж e-mail та IČO. Заміна:
> Údaje z formuláře (e-mail, případně IČO, obor, počet provozoven a potřeby) zpracovává Swipe Scape s.r.o., abychom vás zařadili do předregistrace a poslali vám EET plán a zprávu o spuštění pokladny. Podrobnosti a vaše práva najdete v [zásadách ochrany osobních údajů](/ochrana-osobnich-udaju).

### В9. Реферальна акція «Premium na 3 měsíce» без правил, ще й у транзакційному листі без згоди
- **app/(site)/page.tsx:163**, **prereg-form.tsx:204**, **registrace/potvrzeni/page.tsx:60**, **lib/emails.ts:67, 85**.
- Premium ще не існує, а правил акції немає (коли нараховується, що як Premium не запуститься, ліміти, зловживання).
- Блок «Pozvěte kolegu…» вставлено в потвердний лист `prereg-confirm`, який іде всім, незалежно від `marketingConsent`. Це obchodní sdělení без згоди (zákon č. 480/2004 Sb., § 7).
- Виправлення: сторінка «Pravidla doporučovací akce». У листі показувати блок лише за `marketingConsent === true` (або перенести його лише на сторінку потвердження).

### В10. Листи не ідентифікують відправника
**lib/emails.ts:25–26** (`layout`, патичка): там лише незалежність і odhlášení. Додати рядок: «Odesílá Swipe Scape s.r.o., IČO …, sídlo … · ahoj@evidujzdarma.cz». Це вимога § 7 zákona 480/2004 Sb. (не приховувати відправника obchodního sdělení) і § 435 OZ.

### В11. llms.txt / llms-full.txt обходять принцип noindex і містять биті посилання
- **lib/llms.ts:44** і **:83** включають усі `GUIDES`, зокрема нерецензовані, а llms-full.txt віддає їхній повний текст AI-ботам. Фільтрувати `GUIDES.filter(isIndexable)`, як це вже зроблено в `sitemap.ts:15`.
- **llms.ts:38, 48, 49, 50**: посилання на `/ucetni/hromadna-kontrola`, `/srovnani/moje-eet`, `/cenik`, `/ucetni` ведуть на неіснуючі сторінки.
- **llms.ts:32**: описує функції продукту в теперішньому часі, хоча каса ще не запущена (див. В16).

### В12. Sitemap, breadcrumbs і внутрішні посилання ведуть на 404
- **lib/static-pages.ts:9, 11–17**: 8 із 15 URL у sitemap не існують: `/nastroje`, `/srovnani/moje-eet`, `/ucetni`, `/ucetni/hromadna-kontrola`, `/cenik`, `/o-nas`, `/podminky`, `/ochrana-osobnich-udaju`.
- Breadcrumb «Nástroje» → `/nastroje` (404), до того ж у BreadcrumbList JSON-LD: `kalkulacka-eet-off/page.tsx:40`, `musim-evidovat/page.tsx:30`, `kontrola-ico/page.tsx:64`, `evidencni-jednotky/page.tsx:33`, `qr-platba/page.tsx:41`.
- Неіснуючі гайди (`navody/[slug]` має `dynamicParams = false`, отже 404):
  - `/navody/koho-se-eet-tyka`: landing.ts:9, page.tsx:126, quiz.tsx:87, 103, site-footer.tsx:20
  - `/navody/kontaktni-platba`: landing.ts:37, quiz.tsx:95
  - `/navody/eet-2-0-kompletni-pruvodce`: page.tsx:69, site-footer.tsx:19, potvrzeni/page.tsx:67
  - `/navody/jak-aktivovat-dis-a-certifikat`: eet-assessment.ts:120, 132, quiz.tsx:124, emails.ts:92 (лист dis-launch)
  - `/navody/evidencni-jednotka`: units-wizard.tsx:134, site-footer.tsx:21
  - `/navody/eet-off`: quiz.tsx:113
- Інші сторінки: `/pokladna` (site-header.tsx:43, site-footer.tsx:29, jsonld.tsx:53, лист app-ready emails.ts:106), `/ucetni`, `/cenik`, `/firmy` у футері (site-footer.tsx:30–33), `/o-nas`, `/podminky`, `/ochrana-osobnich-udaju`, `/namitka` (site-footer.tsx:39–42), `/ucetni/hromadna-kontrola` (kontrola-ico/page.tsx:84), NAV у `lib/site.ts:29–35`.
- До 15. 10.: або створити сторінки, або прибрати посилання й URL з sitemap/llms.

### В13. «Příležitostné příjmy» поруч з «ojedinělá tržba» (факт 2)
- 50 000 Kč ніде в коді немає, це прийнято. Але **content/facts.ts:131** («Netýká se … nájmu a příležitostných příjmů») виводиться у квізі як результат «Evidence tržeb se vás netýká» (`quiz.tsx:86`), без пояснення, що мова про вид доходу за ZDP. На ринку ходить міф про «příležitostné tržby do 50 000 Kč», тож тут легко сплутати. Заміна: «Netýká se příjmů ze zaměstnání, kapitálových příjmů, nájmu a ostatních (příležitostných) příjmů podle § 10 zákona o daních z příjmů.»
- Про ojedinělou tržbu (§ 7 zákona o evidenci tržeb) сайт не каже нічого. Запропонований FAQ (квіз, landing, llms):
  > **Musím evidovat jednorázovou platbu?** Neeviduje se tržba, která je z hlediska vašich obvykle přijímaných tržeb ojedinělá – tedy platba přijatá výjimečně a nečekaně, se kterou vaše běžné podnikání nepočítá. Nejde o tržby, které se opakují, i když s dlouhými odstupy. Pevnou částkovou hranici (například „do 50 000 Kč“) zákon nestanoví.

  Джерело: eet.gov.cz (точний URL сторінки потрібен від контролера) + § 7 zákona.

### В14. docs/research/eet2-fakta-2026-10.md відстає від перевірених фактів
- **:65**: «leden = **pilotní (dobrovolný) provoz** [P]» → «leden = pilotní režim podle harmonogramu FS; zákon odklad sankcí nestanoví [P]; „dobrovolný“ jen v TZ MF 18. 2. 2026».
- **:67, 69**: «Ostrý provoz [P]», «Zda je lednový pilot zakotven v zákoně… [?]» → тепер відомо: у законі немає (§ 36, účinnost 1. 1. 2027).
- **:42**: «Odhlášení až od dalšího roku [?]; překročení 1 mil. během roku [?]» → оновити за фактом 5.
- **:56**: «Povinnost uvádět POK na dokladu: nezveřejněno [?]» → «POK na dokladu dobrovolně, není povinné [P]».
- Додати розділи: ojedinělá tržba (§ 7), розмежування з příležitostnými příjmy (§ 10 ZDP), sleva na dani § 35be (факт 3).

### В15. Крихка прив'язка до індексів TIMELINE
**lib/eet-assessment.ts:115, 143, 148** (`TIMELINE[0]!`, `[2]!`, `[4]!`). Будь-яка правка TIMELINE (а К1 її вимагає) зсуне дати або зламає рендер. Шукати пункти через `TIMELINE.find(t => t.date === "2027-01-01")`. У `components/timeline.tsx:17` сітка `md:grid-cols-5` теж розрахована на 5 пунктів.

### В16. Функції продукту описано в теперішньому часі, хоча каса ще не існує
**app/(site)/page.tsx:22–29** (BENEFITS), `comparison.ts` (стовпець «ours»), `tool-cta.tsx:9`, `llms.ts:32`, `SoftwareApplication` (`jsonld.tsx:46–58`). Підприємець читає, що все вже працює, хоча це передреєстрація. Конкретні твердження, які потребують підтвердження: «Bezpečně v EU – Data i certifikáty jsou šifrovaně uložené na serverech v Evropské unii» (рядок 28), «Placeně (Tap to Pay / SoftPOS)», «Tiskárna … (Bluetooth, USB)», «zvládne ji každý za 15 minut». Біля hero/CTA варто додати: «Pokladnu spouštíme [datum]. Teď se můžete předregistrovat.»

---

## Дрібне

1. **lib/eet-assessment.ts:66**: `je ${n} provozoven` для n = 2–4 дає «je 3 provozoven». Правильно: n = 2–4 → «jsou N provozovny», n ≥ 5 → «je N provozoven».
2. **lib/eet-assessment.ts:125**: `${n} provozovny` для n ≥ 5 дає «máte 7 provozovny». Правильно: «7 provozoven».
3. **lib/emails.ts:94, 96, 99**: «DIS+ je spuštěné» фактично неточне (DIS+ існує з 2021 року, нова лише евіденція в ній). → subject «Evidence tržeb v DIS+ je spuštěná – návod krok za krokem»; текст «Finanční správa zpřístupnila v DIS+ přihlášení k evidenci tržeb.»
4. **lib/emails.ts:140**: subject листа-чека використовує `esc()`, і в plain-text темі з'явиться «&amp;». Для subject екранування прибрати.
5. **lib/jsonld.tsx:18**: `logo: /icon.svg`, але такого файлу немає (немає ні `public/`, ні `app/icon`).
6. **lib/jsonld.tsx:24**: `taxID: OPERATOR.ico`. taxID/vatID має бути DIČ (CZ…), IČO лишити як `identifier`.
7. **lib/jsonld.tsx:53**: SoftwareApplication `url: /pokladna` веде на 404 (див. В12).
8. **app/(site)/page.tsx:160**: «co udělat do 1. 11., 1. 12. a 1. 1.» → «co udělat od 1. 11., do 1. 12. a do 1. 1.»
9. **app/(site)/page.tsx:23**: «Účtenka s kódem od Finanční správy.» може читатися як обов'язок (факт 4). → «Na účtence může být i kód POK od Finanční správy (není povinný).»
10. **content/guides/eet-bez-internetu.ts:39**: «… musí být tržba odeslána a potvrzená.» Закон вимагає відправлення, а не підтвердження. → «… musí být tržba odeslána.»
11. **content/guides/eet-bez-internetu.ts:53**: «Zařízení nevypínejte a nemažte data prohlížeče…» Вимкнення пристрою дані не стирає. → «Nemažte data prohlížeče ani neodinstalujte aplikaci, dokud fronta neodeslaných tržeb není prázdná…»
12. **content/comparison.ts:14**: «Klíč v zařízení + PIN pokladní» звучить незграбно. → «Klíč uložený v zařízení + PIN pro každou pokladní».
13. **app/(site)/musim-evidovat/page.tsx:20**: «Můžu se evidenci vyhnout přirážkou?» звучить як ухиляння. → «Můžu místo evidence platit přirážku?»
14. **app/(site)/kontrola-ico/page.tsx:28**: «Údaje neukládáme k žádnému profilu…» Насправді ARES-відповідь кешується на 24 год (`lib/server/ares.ts:8`). → «Odpověď z ARES krátce (24 hodin) ukládáme do mezipaměti; k žádnému profilu ji nepřiřazujeme.»
15. На сторінках інструментів (kalkulačka, kvíz, jednotky, IČO) немає «Ověřeno k {FACTS_UPDATED}». Додати під джерелами.
16. **app/(site)/navody/page.tsx:23**: «s odkazy na zákon» — research каже конкретні § поки не цитувати. → «s odkazy na Finanční správu a zdroje». **:11** опис перелічує теми, гайдів для яких ще немає.
17. **app/(site)/page.tsx:74–79**: «Zdroj: eet.gov.cz a tiskové zprávy Finanční správy», але джерелом є також прес-реліз МФ. → «… a tiskové zprávy Finanční správy a Ministerstva financí».
18. **app/layout.tsx:14**: `alternates: { canonical: "/" }` у кореневому layout успадкується будь-якою майбутньою сторінкою без власного canonical (o-nas, podminky…). Прибрати з root або завжди задавати canonical.
19. Немає OG-зображення (`twitter: summary_large_image` без image), немає favicon.
20. **kalkulacka-eet-off/page.tsx:12**: «Přihláška do 11. 1. 2027.» → «Oznámení do 11. 1. 2027.» (офіційний термін).
21. **lib/eet-off.ts:49**: «EET OFF je jen pro poplatníky v paušálním režimu.» → «EET OFF je jen pro fyzické osoby v 1. pásmu paušálního režimu.»

---

## Прийнято як є

- **Незалежність (E).** `IndependenceBar` у `site-header.tsx:5–20` відображається на кожній сторінці `(site)` через `(site)/layout.tsx`, у футері є окремий блок з посиланням на eet.gov.cz (`site-footer.tsx:54–61`). Текст незалежності також у кожному листі (`emails.ts:26`), у llms.txt і в Organization JSON-LD. FAQ «Jste státní aplikace? Ne…» (`landing.ts:56–58`).
- **Відсутність імітації держави.** Власний логотип (чек із галочкою, `logo.tsx`), зелена палітра, самостійно хостований Inter (Google Fonts не використовується), коментар у `globals.css:4–7`. Слова «oficiální» про себе ніде немає. Назва EvidujZdarma не схожа на «MOJE eet».
- **Порівняння з MOJE eet** має примітку «podle zveřejněných informací» з джерелами й посиланням на eet.gov.cz (`comparison-table.tsx:35–50`). Рядки про 2 jednotky, 2 zaměstnanci, 2FA, katalog і PDF коректні в межах [S].
- **Факти 4–6** у `facts.ts`: штраф до 500 000 Kč і відсутність закриття провозовни; 48 год офлайн; чек законом про EET не вимагається; POK як підтвердження. 50 000 Kč, sleva na dani, REST/JSON ніде не згадуються.
- **EET OFF: базові умови.** Лише FO, 1. pásmo, ≤ 1 млн, 1 400 Kč/міс., 11. 1. 2027 (10. 1. 2027 справді неділя), пізнє oznámení neúčinné, PO виключено (`eet-assessment.ts:86–88`). Паушал 2027 позначено як předběžný.
- **Перевірка за IČO.** Вердикти «Pravděpodobně ano / Možná / Pravděpodobně ne», FAQ «Proč je výsledek jen pravděpodobný», noindex для `?ico=`, IČP ≠ id_jednotky, дисклеймер «nejde o daňové poradenství».
- **Дисклеймери** у футері (на всьому сайті), у квізі, на сторінці IČO, у майстрі jednotek, у гайдах і внизу сторінки калькулятора.
- **Гайди.** noindex без `reviewedBy` (`navody/[slug]/page.tsx:27`), sitemap фільтрує нерецензовані, видно «Aktualizováno» і «Před odbornou revizí», Article JSON-LD додає `reviewedBy` лише за наявності рецензента.
- **robots (G).** Явно дозволені Googlebot, Bingbot, SeznamBot, GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, Claude-SearchBot, Claude-User, PerplexityBot, Perplexity-User, Google-Extended, Applebot(-Extended), DuckDuckBot; приватні шляхи закриті.
- **JSON-LD.** Organization (з parentOrganization), WebSite, SoftwareApplication з `price: "0"`, FAQPage на всіх сторінках з FAQ, BreadcrumbList.
- **QR-генератор.** Твердження «data neopouštějí váš prohlížeč» правдиве: `qr-generator.tsx` не робить жодних мережевих запитів.
- **Маркетингова згода.** Окремий чекбокс, за замовчуванням вимкнений; лист dis-launch іде лише зі згодою (`api/preregistrace/route.ts:126`); odhlášení в кожному маркетинговому листі; збережено доказ згоди.

---

## Чого бракує до запуску лендингу 15. 10.

1. **Виправити К1–К3** у `facts.ts` → перевірити лист prereg-confirm, llms.txt і FAQPage. Оновити `FACTS_UPDATED`.
2. **Zásady ochrany osobních údajů** (`/ochrana-osobnich-udaju`): správce (Swipe Scape s.r.o. з IČO і sídlem), контакт; účely й právní tituly (передреєстрація — čl. 6/1/b; маркетинг — souhlas; ARES-кеш і rate-limit — oprávněný zájem; хеш IP+UA як доказ згоди); příjemci (поштовий провайдер, хостинг — де саме); doby uložení; права й ÚOOÚ; cookies і localStorage (session cookie, `ez_ref`).
3. **Obchodní podmínky** (`/podminky`): що входить у «zdarma» і на який строк; Premium; правила реферальної акції; **відповідальність**: «Za evidenci tržeb odpovídá poplatník. EvidujZdarma odesílá datové zprávy jeho jménem a upozorňuje na neodeslané tržby, neodpovídá však za sankce způsobené výpadkem spojení, neplatným certifikátem, nesprávně oznámenými jednotkami ani nedostupností systému Finanční správy.» Також dostupnost služby, ukončení účtu, export dat, rozhodné právo.
4. **«O nás a kontakt»** (`/o-nas`) з даними оператора за § 435 OZ; ті самі дані у футері (К4) і в патичці листів (В10).
5. **Прибрати або створити** всі 404-цілі з В12 (sitemap, NAV, футер, breadcrumbs, чекліст, квіз, листи).
6. **llms.txt**: лише рецензовані гайди, без битих посилань, без «Premium 149 Kč», якщо ціну не затверджено.
7. **Порівняльна таблиця**: «Nezveřejněno» замість неперевірених «Ne», дата стану.
8. **Калькулятор**: дисклеймер у результаті, нові формулювання, FAQ про 1 млн і odhlášení (В1, В2).
9. Позначка, що каса ще не запущена, і дата запуску (В16).
10. Іконка й OG-зображення (Дрібне 5 і 19).
11. Тести: оновити `tools.test.ts` під новий чекліст (без «Ostrý provoz»), межу 1 000 000, тексти «pravděpodobně».
12. Бажано, але не блокує запуск: FAQ про ojedinělou tržbu (В13). Якщо писати про slevu на dani, то лише з точними умовами:
    > Sleva na dani za evidenci tržeb (§ 35be zákona o daních z příjmů) činí nejvýše 5 000 Kč. Uplatní ji jen fyzická osoba s příjmy ze samostatné činnosti (§ 7), a to jen za zdaňovací období, ve kterém poprvé zaevidovala tržbu (nejdříve za rok 2027). Sleva je omezena na 15 % dílčího základu daně z § 7 snížených o základní slevu na poplatníka, takže může být i nulová. Právnické osoby ji uplatnit nemohou.

---

## Питання до власника

1. IČO, sídlo, oddíl/vložka OR і DIČ Swipe Scape s.r.o. для футера, «O nás», листів і JSON-LD.
2. Коли реально запускається каса? Лист «Pokladna je připravena» запланований на 1. 12. 2026, 08:00 (`registrace/potvrzeni/page.tsx:23–31`). Якщо дата не гарантована, лист і тексти треба змінити.
3. «Zdarma navždy», Premium 149 Kč/міс., реферал «Premium na 3 měsíce pro oba»: це остаточні рішення? Хто пише правила акції та VOP?
4. На чому ґрунтується «Bezpečně v EU» (який хостинг/регіон)? І чи будуть до запуску Tap to Pay/SoftPOS, Bluetooth/USB-принтери, SMS-чеки (у таблиці вони стоять як «Ano»)?
5. Пункт «1. 2. 2027 – Ostrý provoz»: чи є він дослівно в harmonogramu eet.gov.cz? Від цього залежить, видалити його (варіант A) чи переформулювати (варіант B) у К1.2.
6. Чи приймаємо eetoff.cz як джерело для «evidovat od následujícího roku» після перевищення 1 млн? Якщо ні, лишаємо «Finanční správa výslovně neuvádí».
7. Хто daňový poradce і коли рецензія? Доти гайди noindex, і пропоную не віддавати їх у llms-full.txt.
8. «Katalog firem» (`/firmy`) з OSVČ і оцінкою «týká se EET»: чи запускається він 15. 10.? Потрібні LIA (oprávněný zájem), процес «Námitka» і сторінка `/namitka`.
9. Чи зберігати `ez_ref` у localStorage без згоди (ePrivacy / § 89 ZEK)? Альтернатива: передавати `ref` лише в URL до відправки форми.
10. «Jednodušší než státní aplikace»: чи є під цим тест юзабіліті? Якщо ні, прибрати (К3.6).
11. Хто після 1. 12. відстежує офіційний опис MOJE eet і оновлює порівняльну таблицю?
12. Точний URL сторінки eet.gov.cz з визначенням «ojedinělá tržba» (для FAQ з В13).
