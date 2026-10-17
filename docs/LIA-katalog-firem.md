# Test oprávněného zájmu (LIA) – katalog firem EvidujZdarma.cz

| | |
|---|---|
| Správce | Swipe Scape s.r.o., IČO 22269134, Chebská 38/5, Dvory, 360 06 Karlovy Vary (lib/site.ts) |
| Zpracování | Veřejný katalog firem a provozoven na evidujzdarma.cz (`/firmy`, `/firma/…`, `/obor/…`, `/provozovna/…`) |
| Právní základ | Oprávněný zájem – čl. 6 odst. 1 písm. f) GDPR |
| Verze | 1.0 ze 17. 10. 2026 (proud S3, otevření katalogu) |
| Stav | Interní posouzení provozovatele. Ke kontrole advokátem v listopadu 2026 (DECISIONS Ф13); otázky pro právníka jsou v kapitole 9. |
| Přezkum | Při každé změně rozsahu (další kraj, nové pole, `CATALOG_INDEX_PERSONS=1`), nejpozději za 12 měsíců |

Dokument odpovídá kódu ke dni verze. Kde se o něco opírá, je uveden soubor; změní-li se kód, musí se změnit i tento test
a zásady ochrany osobních údajů (`apps/web/src/app/(site)/ochrana-osobnich-udaju/page.tsx`, sekce „Katalog firem“).

## 1. Popis zpracování

**Co zveřejňujeme.** Stránky podnikatelských subjektů se sídlem v Karlovarském kraji (kód kraje 51, `CATALOG_INDEX_REGIONS`),
seznamy podle kraje, obce, oboru a měsíce vzniku a u každého subjektu orientační odhad, zda se ho může týkat evidence tržeb
(EET 2.0, zákon č. 180/2026 Sb., účinnost od 1. 1. 2027). Subjekt z jiného kraje lze otevřít jen podle IČO (údaje se načtou
živě z ARES, stránka je `noindex` a nikam se neukládá).

**Zdroje.**

- Registr ekonomických subjektů (RES) Českého statistického úřadu – soubory otevřených dat (`apps/worker/src/catalog/import-res.ts`).
- ARES Ministerstva financí – základní údaje subjektu a u právnických osob provozovny, jak je ARES zpřístupňuje ze
  živnostenského rejstříku (`apps/worker/src/catalog/enrich-ares.ts`).

Nic jiného nepřebíráme: žádné údaje přímo ze živnostenského rejstříku, obchodního rejstříku, insolvenčního rejstříku ani
z jiných webů, žádné vlastní popisy ani hodnocení.

**Subjekty údajů.** Osobními údaji jsou údaje o podnikajících fyzických osobách (OSVČ; právní formy 101–108, 424, 425,
a neznámá forma – `isNaturalPerson`, „fail-closed“). U právnických osob jde o údaje o firmě; osobní údaj může obsahovat
nanejvýš obchodní firma (např. jméno ve firmě s.r.o.).

**Rozsah údajů (co se zobrazuje).**

| Údaj | Právnická osoba | OSVČ |
|---|---|---|
| Název / jméno a příjmení, IČO, právní forma | ano | ano |
| Datum vzniku a zániku | ano | ano |
| Sídlo | celá adresa (+ odkaz na mapu) | **jen obec** |
| Kraj, obory činnosti CZ-NACE | ano | ano |
| Plátce DPH (jen ověřeno v ARES) | ano | ano |
| DIČ | ano (jen z ARES) | **ne** – u OSVČ ho ani neukládáme |
| Provozovny a živnosti ze živnostenského rejstříku | ano | **ne** – neukládáme, stránka provozovny OSVČ je 404 |
| Odhad „EET 2.0“ podle oboru | ano | ano |
| Datum narození, rodné číslo, statutární orgány, společníci, bankovní účty, historie podnikání | ne | ne |

Seznam zobrazených údajů je jednotně v `apps/web/src/content/catalog-data.ts` (stejný text v zásadách i na `/namitka`).

**Příjemci.** Veřejnost (web je veřejný). Stránky právnických osob indexují vyhledávače; stránky OSVČ jsou `noindex`.
AI asistenti dostávají přes MCP nástroj `eet_check_ico` jen odkaz na stránku (`catalog_url`); nástroj sám čte ARES.
Technicky údaje zpracovává poskytovatel hostingu v EU. Seznamy a stránky katalogu drží nginx v mikrocache nejvýše
10 minut (`infra/nginx/evidujzdarma.conf`).

## 2. Krok 1 – účel a oprávněný zájem

Účely:

1. **Najít obchodního partnera a vystavit mu fakturu** – fakturační údaje ke zkopírování, předvyplnění odběratele
   v bezplatné faktuře (`/faktura-zdarma#odberatel=IČO`).
2. **Ověřit údaje partnera** – IČO, DIČ a plátcovství DPH, sídlo, datum vzniku, s datem ověření a odkazem na ARES
   (u firem i na Veřejný rejstřík).
3. **Informovat o EET 2.0** – srozumitelný a vždy výslovně orientační odhad podle oboru („rozhoduje způsob placení,
   ne obor“) a odkaz na návod pro obor.

Oprávněné zájmy:

- **správce**: provoz bezplatné služby a její propagace (obchodní zájem, recitál 47 GDPR);
- **třetích osob**: odběratelé a dodavatelé, účetní a sami podnikatelé potřebují rychle a bez registrace dohledat a ověřit
  identifikační údaje a zjistit, co pro ně znamená EET 2.0;
- **veřejný**: transparentnost podnikání. Údaje RES a ARES stát zveřejňuje právě proto, aby je bylo možné využít
  „při podnikání nebo jiné výdělečné činnosti“ (§ 4b zákona č. 106/1999 Sb., jak ho cituje ÚOOÚ v rozhodnutí
  čj. UOOU-10201/18-31; tamtéž domněnka, že před dalším zpracováním otevřených dat nemají přednost oprávněné zájmy
  subjektu údajů – vyvratitelná, proto tento test).

Zájmy jsou zákonné, konkrétní a skutečné (služba existuje a je zdarma).

## 3. Krok 2 – nezbytnost

- **Bez údajů o subjektu účel splnit nelze**: fakturovat a ověřovat se dá jen konkrétní subjekt.
- **Proč nestačí odkaz do ARES**: ARES neukáže fakturační údaje ke zkopírování, nepředvyplní fakturu a neřekne nic o EET.
  Pro OSVČ ale katalog nepřidává nic, co by ARES neukazoval – jen to jinak uspořádá.
- **Minimalizace** (co jsme ubrali, protože to účel nepotřebuje):
  - OSVČ: jen obec místo adresy (bývá to bydliště), žádné DIČ (u starších bývá odvozené z rodného čísla), žádné
    provozovny a živnosti (údaje živnostenského rejstříku – viz kap. 4), žádné vyhledávání podle jména (`searchFirmsByName`
    jen pro právnické osoby), v seznamech jen počtem, stránky `noindex` a mimo sitemapu. Kdo potřebuje fakturovat, IČO zná.
  - Zaniklé subjekty: ze seznamů hned po aktualizaci, stránka 90 dní po zániku 404, záznam smazán při příštím importu.
  - Statutární orgány, společníci, osoby: stránky nevytváříme vůbec.
- **Méně invazivní alternativa** „jen odkaz na ARES bez stránky“ by nesplnila účely 1 a 3; alternativa „OSVČ úplně
  vynechat“ by znemožnila podnikatelům dohledat se podle IČO a vystavit fakturu OSVČ – zvolili jsme střední cestu
  (stránka existuje, ale není vyhledatelná a není v seznamech).

## 4. Krok 3 – vyvážení zájmů

**Povaha údajů.** Veřejné identifikační údaje ze zákonem zřízených registrů, žádné zvláštní kategorie (čl. 9), žádné
údaje o trestných činech. Rizikem je u OSVČ adresa sídla (bývá bydlištěm) – nezveřejňujeme ji.

**Rozumná očekávání (recitál 47).** Podnikatel zapsaný v RES a ARES ví, že jeho identifikační údaje jsou veřejné.
ÚOOÚ ale zdůrazňuje, že „veřejnost určitých údajů nezakládá oprávnění k jejich dalšímu neomezenému zpracování“
a že fyzické osoby podnikající „nemohou předvídat, že jejich osobní údaje uvedené ve veřejných rejstřících budou dále
zveřejňovány na internetu neomezeným počtem správců“ (čj. UOOU-10201/18-31, rekapitulace rozhodnutí o rozkladu).
Proto u OSVČ omezujeme dosah (noindex, mimo sitemapu, v seznamech počtem, bez hledání podle jména).

**Precedens ÚOOÚ – UOOU-10201/18** (rozhodnutí čj. -9 z 28. 1. 2019 a po rozkladu čj. -31 z 18. 12. 2019, pokuta
50 000 Kč provozovateli katalogu podnikatelů):

1. Zveřejňovat OSVČ, jejichž živnostenské oprávnění zaniklo a byly přesunuty do neveřejné části živnostenského rejstříku
   (§ 60 odst. 3 zákona č. 455/1991 Sb.; 4 roky od zániku posledního oprávnění), nelze – chybí právní titul.
   → **U nás**: zaniklé subjekty ze seznamů hned, stránka 90 dní po zániku zmizí (404), záznam se smaže při importu
   (`lib/catalog-policy.ts` `isGone`, `lib/server/firm-page.ts`, `import-res.ts` `purgeDissolved`).
2. Údaje ze živnostenského rejstříku, které ARES (tehdy) neobsahoval – DIČ, bankovní účet, informace o provozovaných
   živnostech a o historii podnikání – nelze hromadně „překlápět“: živnostenský rejstřík není otevřená data
   (nařízení vlády č. 425/2016 Sb.) a § 60 odst. 6 živnostenského zákona zakazuje sestavu z něj zveřejnit.
   → **U nás**: u OSVČ žádné DIČ, živnosti, provozovny ani historie; bankovní účty nikde.
3. ARES je podle ÚOOÚ veden v seznamu informací zveřejňovaných jako otevřená data (nařízení vlády č. 425/2016 Sb.,
   bod 14); zpracování údajů „jméno a příjmení nebo obchodní firma, právní forma, datum vzniku, IČO, adresa sídla,
   příslušný úřad (ZÚJ) a klasifikace provozovaných ekonomických činností“ se může opřít o čl. 6 odst. 1 písm. f)
   po balančním testu, „s důrazem na aktuálnost“ a s plněním informační povinnosti a práv subjektů.
   → **U nás**: u OSVČ zobrazujeme právě tyto kategorie (adresu jen v rozsahu obce), navíc datum zániku, kraj
   a plátcovství DPH z ARES (viz otázka 2 v kap. 9); údaje pravidelně obnovujeme (kap. 6).

**Dopady na subjekty.** Nehrozí profilování, automatizované rozhodování (čl. 22) ani spojování s jinými zdroji.
Odhad „EET 2.0“ je výslovně orientační a nemá právní účinky. Nejvýznamnější dopad – dohledatelnost OSVČ podle jména
přes vyhledávače – je vyloučen (`noindex`, mimo sitemapu, žádné hledání podle jména).

**Opatření (implementovaná v kódu):**

| Opatření | Kde |
|---|---|
| OSVČ `noindex, follow`, mimo sitemapu (přepínač `CATALOG_INDEX_PERSONS`, výchozí 0) | `lib/catalog-policy.ts`, `lib/server/catalog.ts` (`indexableSql`) |
| OSVČ v seznamech jen počtem („a dalších 37 živnostníků“) + hledání podle IČO | `components/catalog/persons-note.tsx`, `listFirms({ legalOnly })` |
| Hledání podle názvu jen právnické osoby | `searchFirmsByName` |
| OSVČ bez ulice, DIČ, provozoven a živností – ani ve view modelu, ani v DB | `firmViewFromRow`, `liveFirmView`, `enrich-ares.ts` |
| „Na stejné adrese“ a „Podobné firmy“ jen právnické osoby | `sameAddressFirms`, `similarFirms` |
| JSON-LD u OSVČ jen název, IČO, obec | `components/catalog/jsonld.ts` |
| Zaniklé: ze seznamů hned, stránka noindex, po 90 dnech 404, smazání při importu | `listableSql`, `isGone`, `purgeDissolved` |
| Námitka: u OSVČ noindex hned po odeslání, u firem po potvrzení e-mailu | `lib/server/objections.ts` |
| Informace podle čl. 14 | zásady, sekce „Katalog firem z veřejných registrů“ |
| Jen kraj 51 (postupné spuštění) | `CATALOG_INDEX_REGIONS=51` |

**Výsledek.** Za uvedených opatření převažuje oprávněný zájem správce a uživatelů nad zájmy a právy podnikatelů:
u právnických osob jde převážně o údaje, které nejsou osobní, u OSVČ zveřejňujeme jen kategorie, které ÚOOÚ u otevřených
dat ARES považuje za zpracovatelné, a s omezeným dosahem. Bez opatření z tabulky by výsledek neplatil.

## 5. Práva subjektů údajů

- **Námitka (čl. 21)** – formulář `/namitka` (odkaz na každé stránce katalogu, IČO ve fragmentu adresy). U OSVČ stránku
  vyřadíme z vyhledávačů hned po odeslání, u firem po potvrzení e-mailu (aby nikdo nemohl vyřadit cizí firmu).
  Vyřízení nejpozději do 30 dnů (čl. 12 odst. 3: do jednoho měsíce). Nevyhovíme jen při závažných oprávněných důvodech.
- **Oprava (čl. 16)** – tamtéž; chyby v samotném registru je nutné opravit u správce registru.
- **Přístup (čl. 15), výmaz (čl. 17)** – e-mailem; po námitce záznam skryjeme nebo odstraníme.
- **Informace (čl. 14)** – zásady ochrany osobních údajů, sekce „Katalog firem z veřejných registrů“: zdroje, kategorie,
  účel, právní základ, doba, příjemci, námitka a právo podat stížnost u ÚOOÚ.

## 6. Doba uložení a aktualizace

- Údaje zobrazujeme, dokud je subjekt zapsán v registrech. RES importuje provozovatel z nového souboru ČSÚ
  (`catalog:import`, zatím ručně – četnost má stanovit provozovatel, doporučení: měsíčně), ARES ověřujeme znovu
  po 30 dnech (`catalog:enrich`, výchozí `--max-age-days 30`; worker ho spouští každou noc, je-li nastaveno
  `CATALOG_ENRICH=1` – jinak ručně).
- Zaniklý subjekt: při nejbližším importu dostane datum zániku a zmizí ze seznamů; 90 dní po zániku je stránka 404
  a `catalog:import` záznam smaže (`--keep-dissolved` to výjimečně potlačí).
- Mikrocache nginx: nejvýše 10 minut (při výpadku aplikace se může vydat i starší kopie – `proxy_cache_use_stale`).

## 7. Zabezpečení

Data v EU (hosting), přístup k DB jen rolí s právy SELECT/INSERT/UPDATE/DELETE (DECISIONS Т6), žádné třetí strany
ani analytické skripty (DECISIONS К8). Formulář námitky ukládá jen údaje nutné k vyřízení (3 roky od vyřízení).

## 8. Co se změní, když…

- **přidáme kraj**: stačí `CATALOG_INDEX_REGIONS`; test platí beze změny, upravit text zásad („zatím pro Karlovarský kraj“);
- **zapneme indexaci OSVČ** (`CATALOG_INDEX_PERSONS=1`): nový test – mění se dosah (vyhledatelnost podle jména);
  provozovny OSVČ se ani tak nezobrazí;
- **přidáme pole** (např. kontakty, otevírací doba z profilu převzatého vlastníkem): nový test pro dané pole.

## 9. Otázky pro právníka (listopad 2026)

1. Stačí u OSVČ `noindex` + mimo sitemapu + v seznamech jen počtem, nebo má být stránka OSVČ jen na vyžádání
   (např. až po zadání IČO, bez stálé URL)?
2. **Plátce DPH u OSVČ**: údaj bereme z ARES (zdroj registr DPH). Je u fyzických osob v rozsahu otevřených dat ARES,
   nebo ho u OSVČ skrýt (jako DIČ)?
3. Provozovny **právnických osob** přebíráme z ARES (zdroj živnostenský rejstřík). Nejde o osobní údaje, ale ÚOOÚ
   v UOOU-10201/18 označil živnostenský rejstřík za neotevřená data – vadí to i u firem (např. § 60 odst. 6 ŽZ)?
4. Lhůta 90 dní po zániku: přiměřená, nebo zkrátit (např. vyřadit stránku hned)?
5. Je potřeba e-mailem informovat předregistrované uživatele o změně zásad (nová verze 17. 10. 2026 se týká jen katalogu)?
6. Obchodní firma právnické osoby obsahující jméno fyzické osoby (např. „Jan Novák s.r.o.“) – stačí obecný režim pro
   právnické osoby?
