# Podmínky služby EET API (EET Gateway)

**Návrh – neschváleno.** Pracovní text k ČEKPOINTU „podmínky“ (S8, rozd. 11). Nezveřejňovat. Před použitím ho musí schválit majitel a právník; ceny tu záměrně nejsou (ČEKPOINT „cena“).

Verze návrhu: 30. 10. 2026 · připravila kódová relace podle docs/tasks/2026-10-30-S8-partner-api.md

---

## 1. Strany a předmět

1.1 Provozovatel služby EvidujZdarma (dále „provozovatel“) zpřístupňuje rozhraní EET API, přes které může software třetí strany (rezervační systém, hotelový PMS, fakturace – dále „partnerský systém“) předávat tržby podnikatele k evidenci tržeb podle zákona č. 180/2026 Sb.

1.2 Uživatelem API je podnikatel, který má u provozovatele účet a integraci vytvořil sám nebo ji schválil při připojení partnerského systému (dále „poplatník“). Partnerský systém jedná jménem poplatníka v rozsahu oprávnění, která mu poplatník udělil.

## 2. Model technického zprostředkovatele

2.1 Provozovatel je **technický zprostředkovatel**: tržba se odesílá s DIČ (EIČ), evidenční jednotkou a pokladním certifikátem poplatníka. Provozovatel není pověřeným poplatníkem podle § 10 zákona a neeviduje tržby svým jménem.

2.2 **Odpovědnost vůči Finanční správě za evidenci tržeb nese poplatník.** Poplatník (a partnerský systém, který používá) rozhoduje, které platby evidovat; API odešle to, co obdrží.

2.3 Provozovatel neposkytuje daňové poradenství. Popisy v dokumentaci jsou obecné informace se zdroji.

## 3. Co provozovatel zajišťuje

3.1 Přijetí tržby přes API, uložení a odeslání Finanční správě se stejnou evidencí, frontou a podpisem jako u pokladny EvidujZdarma.

3.2 Frontu a opakované odeslání při nedostupnosti Finanční správy nebo sítě; tržba, kterou API přijalo, se neztratí a je k dohledání (stav, POK, chyby).

3.3 Upozornění: stav tržby v odpovědi API a ve webhoocích, upozornění na tržby, kterým se blíží lhůta **48 hodin** pro dodatečné odeslání (sale.deadline_soon), na konec platnosti certifikátu a na nefunkční webhook; e-mail vlastníkovi účtu podle nastavení služby.

3.4 Ochranu přístupu: tokeny uložené jen jako otisk, odvolání integrace s okamžitou účinností, deník požadavků bez obsahu tržeb (30 dní).

## 4. Povinnosti poplatníka a partnerského systému

4.1 Udržovat platný pokladní certifikát, správné údaje účtu (DIČ/EIČ, evidenční jednotky) a chránit token; podezření na zneužití tokenu neprodleně řešit odpojením integrace.

4.2 Posílat tržby s pravdivými údaji, v čase přijetí platby, a sledovat jejich stav (odpověď API, webhooky). Tržbu, která skončila odmítnutím nebo v karanténě, vyřešit v účtu nebo jinak.

4.3 Dodržovat limity API (počet požadavků, velikost dávky) a dokumentaci.

## 5. Omezení odpovědnosti

5.1 Provozovatel odpovídá za škodu způsobenou porušením svých povinností podle čl. 3 jen do výše [částka / násobek ceny za období – doplní právník], s výjimkou škody způsobené úmyslně nebo hrubou nedbalostí.

5.2 Provozovatel neodpovídá za: obsah a správnost tržeb předaných partnerským systémem; rozhodnutí poplatníka, co evidovat; nedostupnost systémů Finanční správy; výpadky sítě poplatníka nebo partnerského systému; následky zneužití tokenu, který poplatník nebo partnerský systém nechránil.

5.3 [Právník: soulad s § 2898 občanského zákoníku a se spotřebitelskými pravidly, pokud by uživatelem byl spotřebitel – u podnikatelů se nepředpokládá.]

## 6. Osobní údaje

6.1 Při zpracování tržeb přes API je provozovatel **zpracovatelem** osobních údajů poplatníka (zejména EIČ, které u fyzické osoby může obsahovat rodné číslo, a údaje na dokladech). Podmínky zpracování upravuje smlouva o zpracování osobních údajů (docs/legal/dpa-api-navrh.md, návrh).

## 7. Uchovávání

7.1 Data tržeb se uchovávají podle stejných pravidel jako tržby z pokladny (zásady ochrany osobních údajů a podmínky služby). Provozovatel **nepřebírá** povinnost poplatníka archivovat účetní a daňové doklady po zákonné lhůty (např. 10 let); export si poplatník zajišťuje sám.

## 8. Ostré prostředí, ceny, ukončení

8.1 Ostré (produkční) tokeny pro aplikace partnerů zapíná provozovatel až po schválení těchto podmínek; do té doby je k dispozici testovací prostředí Playground.

8.2 Cena a tarify: [ČEKPOINT „cena“ – doplní majitel].

8.3 Poplatník může integraci kdykoli odpojit. Tržby přijaté před odpojením se odešlou.

## 9. Otevřené body pro majitele a právníka

- výše a způsob omezení odpovědnosti (čl. 5.1);
- zda podmínky API jsou samostatné, nebo příloha obchodních podmínek EvidujZdarma;
- smluvní vztah s vendorem PMS (partnerská smlouva) vs. s poplatníkem;
- SLA a status-stránka (mimo v1).
