# Smlouva o zpracování osobních údajů – EET API

**Návrh – neschváleno.** Pracovní text k ČEKPOINTU „podmínky“ (S8, rozd. 11). Nezveřejňovat. Před použitím ho musí schválit majitel a právník.

Verze návrhu: 30. 10. 2026 · podle čl. 28 nařízení (EU) 2016/679 (GDPR)

---

## 1. Strany a role

1.1 **Správce:** poplatník – podnikatel, jehož tržby se přes EET API evidují.
1.2 **Zpracovatel:** provozovatel služby EvidujZdarma.
1.3 Partnerský systém (např. hotelový PMS) je ve vztahu k těmto údajům samostatným zpracovatelem nebo správcem podle smlouvy s poplatníkem; tato smlouva upravuje jen zpracování u provozovatele.

## 2. Předmět, povaha a účel zpracování (čl. 28 odst. 3)

2.1 **Účel:** evidence tržeb podle zákona č. 180/2026 Sb. – příjem tržeb přes API, sestavení a podpis datové zprávy, odeslání Finanční správě, opakování, stav a upozornění, doklady.

2.2 **Kategorie subjektů:** poplatník – fyzická osoba podnikatel; osoby uvedené v textu položek nebo poznámek, pokud je tam partnerský systém uvede (doporučujeme je tam neuvádět).

2.3 **Kategorie údajů:** EIČ / DIČ (**u fyzické osoby může obsahovat rodné číslo**), IČO, jméno a adresa provozovny, údaje tržby (položky, částky, způsob platby, čas), technické záznamy API bez obsahu tržeb.

2.4 **Doba:** po dobu trvání služby a dále jen po dobu uchování podle zásad ochrany osobních údajů EvidujZdarma; retence je stejná jako u tržeb z pokladny. Provozovatel nepřebírá zákonnou archivaci dokladů poplatníka (např. 10 let).

## 3. Povinnosti zpracovatele

3.1 Zpracovávat údaje jen na doložené pokyny správce – pokynem je zejména tržba odeslaná přes API a nastavení účtu.
3.2 Zajistit mlčenlivost osob, které mají k údajům přístup.
3.3 Technická a organizační opatření (čl. 32): šifrovaný přenos (TLS); pokladní certifikáty a tajemství webhooků uložené šifrovaně (envelope encryption); tokeny uložené jen jako otisk; deník požadavků bez obsahu tržeb; EIČ v odpovědích API maskované; data v EU.
3.4 Další zpracovatelé (čl. 28 odst. 2 a 4): jen s předchozím obecným souhlasem správce a s informací o změnách. Aktuální seznam: hosting a e-mail podle zásad ochrany osobních údajů EvidujZdarma [právník: připojit seznam].
3.5 Pomoc správci s právy subjektů údajů, se zabezpečením, ohlášením porušení (bez zbytečného odkladu) a s posouzením vlivu.
3.6 Po skončení služby údaje vymazat nebo vrátit podle volby správce, nestanoví-li právo jinak.
3.7 Poskytnout informace k doložení souladu a umožnit audit [právník: rozsah a náklady].

## 4. Předávání mimo EU

4.1 Údaje se zpracovávají v EU; předání mimo EU jen s rozhodnutím majitele zapsaným v DECISIONS a při splnění kapitoly V GDPR.

## 5. Otevřené body pro majitele a právníka

- seznam dalších zpracovatelů a postup oznamování změn;
- rozsah auditu;
- vztah k obchodním podmínkám a k partnerské smlouvě s vendorem PMS;
- zda u partnerského systému uzavírat třístrannou dohodu.
