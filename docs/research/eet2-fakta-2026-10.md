# EET 2.0 — ověřená fakta a zdroje (stav k 1. 10. 2026)

Podklad pro obsah webu, kvíz, kalkulačky a revizi daňovým poradcem. Na webu se fakta
berou z jediného místa: `apps/web/src/content/facts.ts`.

Značky: **[P]** primární zdroj (oficiální stránka/soubor), **[S]** sekundární zdroj,
**[?]** nejasné / zatím nezveřejněné — na webu formulovat opatrně nebo vynechat.

> Weby `.gov.cz` nebyly z vývojového prostředí přímo dostupné; primární fakta byla
> ověřena přes výtahy vyhledávačů a oficiální soubory zrcadlené ve veřejných
> repozitářích. Před publikací klíčových návodů otevřete zdroje v prohlížeči.

## 0. Opravy k 1. 10. 2026 (rozbor eet20.cz „Rozpory“, eetoff.cz, rešerše Compass)

Porovnání tiskových zpráv se schváleným zněním zákona (sněmovní tisk 189, stav 29. 9. 2026). Promítnuto do `facts.ts`,
návodů, FAQ, kalkulačky EET OFF a stránky `/co-se-o-eet-pise-spatne`.

| Téma | Dříve na webu | Podle schváleného znění |
| --- | --- | --- |
| „Příležitostné tržby do 50 000 Kč“ | výjimka z tiskové zprávy MF, „ověřit“ | v zákoně **není**; jen tržba „ojedinělá z hlediska obvykle přijímaných tržeb“ (§ 7) [S] |
| Leden 2027 | pilotní (dobrovolný) provoz | zákon pilotní režim nezná; účinnost 1. 1. 2027 (§ 36), pokuta až 500 000 Kč (§ 24) [S] |
| Sleva na dani 5 000 Kč | „opět 5 000 Kč“ | **až** 5 000 Kč, jen OSVČ, jen 1. období s evidencí, může být nižší/nulová (§ 35be ZDP) [S] |
| EET OFF | přirážka 1 400 Kč, lhůta 11. 1. | + jen FO; volba na celý rok; při zahájení v průběhu roku přirážka od měsíce zahájení; při překročení 1 mil. přirážka do konce roku a evidence až od dalšího roku; odhlášení do 10. dne následujícího roku [S – eetoff.cz] |
| POK na dokladu | „nezveřejněno“ | dobrovolné (eet.gov.cz) [P – nepřímo] |
| Oznámení jednotek | — | i jednotky bez evidovaných tržeb, pokud má poplatník aspoň jednu s evidovanými tržbami [S] |
| Doba čekání na odpověď | — | nastavuje poplatník, min. 2 s; prodej se neblokuje; znovu jen bez POK [S] |
| Certifikáty | — | CA EET zveřejnila API automatické obnovy (caeetapi_jwt, 30. 9. 2026) [S] |

Čísla § jsou převzata ze sekundárních rozborů schváleného znění – po vyhlášení ve Sbírce ověřit (viz `docs/revize-danovy-poradce.md`).

## 1. Zákon

- *Zákon o evidenci tržeb a o změně některých dalších zákonů* — sněmovní tisk 189. Vláda 4. 5. 2026,
  3. čtení 15. 7. 2026, Sněmovna přehlasovala Senát 9. 9. 2026, prezident podepsal 17. 9. 2026.
  Účinnost **1. 1. 2027**. [P] [psp.cz t=189](https://www.psp.cz/sqw/historie.sqw?o=10&t=189),
  [eet.gov.cz – tisková zpráva](https://eet.gov.cz/cs/pro-media/tiskove-zpravy/2026/prezident-podepsal-zakon-o-eet-2-0-evidence-trzeb-1315)
- Číslo ve Sbírce zákonů: **neověřeno** [?]. Čísla paragrafů finálního znění: **neověřena** [?] — na webu
  zatím necitovat konkrétní § zákona o evidenci tržeb.

### Kdo eviduje
- Každý poplatník daně z příjmů (FO i PO), který přijímá evidované tržby. [P] [Kdo musí evidovat](https://eet.gov.cz/cs/koho-se-eet-tyka/kdo-musi-evidovat-trzby)
- Netýká se příjmů ze zaměstnání, kapitálových příjmů, nájmu, příležitostných příjmů a autorských příjmů (pokud nejde o podnikání). [P]

### Co se eviduje
- Platby **při osobním kontaktu nebo v provozovně**: hotovost, karta, QR kód, poukázka, šek, virtuální aktiva. [P]
  [MF](https://mf.gov.cz/cs/ministerstvo/media/tiskove-zpravy/2026/eet-2-0-ministerstvo-financi-predstavuje-moderni-a-62878)
- Neeviduje se: platební brána, QR kód na webu e-shopu, vzdálený převod, úhrada faktury. [P/S]
- Převod provedený „u pokladny“: nejasné [?].
- Zálohy, poukazy, dobití kreditu: eviduje se přijetí platby určené k čerpání i samotné čerpání, odděleně
  (pole `urceno_cerp_zuct` / `cerp_zuct`). [S] [podnikatel.cz – srovnání](https://www.podnikatel.cz/clanky/v-cem-se-eet-2-0-lisi-od-eet-1-0-prinasime-velke-srovnani/)
- Vyjmuté činnosti (jen daná činnost): část železniční osobní a letecké dopravy, poštovní služby, hazardní hry,
  licencované dodávky energií, voda a kanalizace, nebankovní spotřebitelské úvěry. [S]

### EET OFF
- Jen **fyzická osoba v 1. pásmu paušálního režimu** s příjmy ze samostatné činnosti **≤ 1 mil. Kč/rok**, dobrovolně. [P]
  [Co je EET OFF](https://eet.gov.cz/cs/eet-off/co-je-rezim-eet-off)
- Přirážka **1 400 Kč/měsíc** k paušální záloze (16 800 Kč/rok). „1 500 Kč“ v titulcích = 100 Kč daň + 1 400 Kč. [P/S]
- Oznámení o přihlášení k přirážce do **10. dne zdaňovacího období** — pro 2027 **11. 1. 2027** (10. 1. je neděle).
  Pozdní oznámení je neúčinné. [P] [Jak a kdy se přihlásit](https://eet.gov.cz/cs/eet-off/jak-a-kdy-se-prihlasit-k-rezimu-eet-off)
- Odhlášení až od dalšího roku [?]; překročení 1 mil. během roku [?].

### Sankce
- Až **500 000 Kč** za neodeslání datové zprávy / závažné maření; **uzavření provozovny už není**. [S]
  [podnikatel.cz](https://www.podnikatel.cz/clanky/provozovnu-uz-vam-kvuli-eet-nezavrou-maximalni-vyse-sankce-ale-zustane-500-000-kc/)
- Až 50 000 Kč za méně závažné porušení [S/?]. Pokuta za „nevydání účtenky“ — rozpor, nepoužívat [?].

### Čas a offline
- Datová zpráva se odesílá nejpozději při přijetí platby; při výpadku bez zbytečného odkladu, **nejpozději do 48 hodin**,
  pokladna opakuje odeslání do získání **POK**. [P] [Praktické informace](https://eet.gov.cz/cs/zacinam-s-eet/prakticke-informace)

### Účtenka
- EET 2.0 **neukládá povinnost vydat účtenku**. [P]
- Na žádost zákazníka doklad dle **§ 16 zákona o ochraně spotřebitele** (datum, zboží/služba, cena, jméno/firma a IČO),
  může být elektronický. [S] Povinnost uvádět POK na dokladu: nezveřejněno [?]. Informační cedulka: rozporné [?].

## 2. Harmonogram

| Datum | Událost | |
| --- | --- | --- |
| 5. 6. / 1. 7. / 25. 8. 2026 | Technická dokumentace / Playground / popis rozhraní v1.2 | [P] |
| **1. 11. 2026** | EET v DIS+ (MOJE daně): přihlášení k evidenci, evidenční jednotky, pokladní certifikáty | [P] |
| **1. 12. 2026** | Spuštění MOJE eet | [P] |
| **1. 1. 2027** | Účinnost zákona (§ 36) – evidence povinná. FS leden označuje jako pilotní měsíc (metodická podpora), zákon pilotní ani dobrovolný režim **nezná** | [P] |
| **11. 1. 2027** | Lhůta EET OFF | [P] |
| **1. 2. 2027** | Plný provoz podle harmonogramu FS | [P] |

Zdroj: [Harmonogram EET 2.0](https://eet.gov.cz/cs/o-eet/jaky-je-harmonogram-eet-2-0). Lednový pilot **není** zakotven
v zákoně (schválené znění, sněmovní tisk 189, stav 29. 9. 2026: účinnost 1. 1. 2027, pokuta až 500 000 Kč dle § 24).
Harmonogram FS: v lednu „půjde však již o standardní evidenci“. „Bez sankcí v lednu“ = jen sekundární zdroje.

## 3. Evidenční jednotka

- Provozovna (i mobilní stánek), webová stránka / její část / aplikace; OSVČ bez provozovny uvede jako jednotku **sebe**. [P]
  [Jak začít evidovat](https://eet.gov.cz/cs/zacinam-s-eet/jak-zacit-evidovat)
- Typy v DIS+: stálá provozovna, mobilní provozovna, automat, internetová stránka, dopravní prostředek. [P]
- DIS+ → Evidence tržeb → Evidenční jednotky; systém **přidělí ID** (`id_jednotky` ve zprávě). [P]
- Změny před první tržbou po změně, nejpozději **do 15 dnů**. [S]
- **IČP z RŽP ≠ id_jednotky.**

## 4. Certifikáty

- Certifikační autorita EET v2.0, z DIS+ → Obslužný portál EET → „Správa pokladních certifikátů EET“; zdarma. [P]
- X.509, RSA 2048, sha256WithRSA, platnost **366 dní**; obnova podepsaná stávajícím klíčem (lze automatizovat). [P]
- Subjekt obsahuje **EIČ** (DIČ/RČ/VČP) → certifikát patří poplatníkovi, ne zařízení; jeden certifikát pro více pokladen. [P/S]
- Formát PKCS#12 (.p12) s heslem. [S]

## 5. Technika (pro vývojáře)

- Dokumentace: [Pro vývojáře](https://eet.gov.cz/pro-vyvojare/) — `EET_popis_rozhrani_v1.2.pdf` (25. 8. 2026), XSD v4.1, WSDL.
- **Pouze SOAP**, namespace `http://fs.gov.cz/eet/schema/v4`, operace `OdeslaniTrzby`, SOAPAction `http://fs.gov.cz/eet/OdeslaniTrzby`.
- Playground `https://pg.trzbyeet.gov.cz/eet/services/EETServiceSOAP/v4`, produkce `https://trzbyeet.gov.cz/eet/services/EETServiceSOAP/v4`.
- WS-Security BinarySecurityToken + XMLDSig (exc-c14n, rsa-sha256, sha256) nad Body. Odpovědi podepisuje FS.
- **PKP / BKP / FIK už neexistují.** Odpověď `Potvrzeni pok="…" test="…"`, POK = UUIDv4 + `-` + 2 hex znaky.
- Pole: `Hlavicka` (uuid_zpravy, dat_odesl, prvni_zaslani, overeni), `Data` (eic_popl, eic_poverujiciho, povereni_vice_popl,
  id_jednotky, id_pokl ≤20, porad_cis ≤25, dat_trzby, celk_trzba, urceno_cerp_zuct, cerp_zuct). Žádné DPH, způsob platby ani položky.
- Registrace vývojáře: e-mail **epodpora@fs.gov.cz**, předmět **„Registrace vývojáře EET“**.

Implementace: `packages/fiscal-core/src/eet2/*`, konformační testy proti oficiálnímu vzorku v `packages/fiscal-core/test/eet2.test.ts`.

## 6. MOJE eet

- Od 1. 12. 2026, zdarma, **webová** aplikace (ne nativní). [P/S]
- Max. **2 evidenční jednotky**, přístup pro max. **2 zaměstnance**, bez limitu tržeb. [S]
- Katalog zboží a služeb, PDF doklady, propojení s DIS+. [S]
- **Dvoufázové ověření při každém přihlášení**. [S]
- Offline fronta nezveřejněna — vyžaduje připojení [S/?].

## 7. ARES

- Základ `https://ares.gov.cz/ekonomicke-subjekty-v-be/rest`; `GET /ekonomicke-subjekty/{ico}`, `GET /ekonomicke-subjekty-rzp/{ico}`,
  `POST /ekonomicke-subjekty/vyhledat` (start, pocet, razeni). OpenAPI `…/rest/v3/api-docs`.
- RŽP provozovna: `icp`, `sidloProvozovny`, `platnostOd`, `platnostDo`, `nazev`, `typProvozovny`, `pozastaveniProvozovny`.
- Limit: > 500 dotazů/min může být blokováno. [P]
- Hromadná data: `ares_vreo_all.tar.gz` (jen VR, měsíčně); **ČSÚ RES CSV** pro všechny subjekty vč. OSVČ (2× měsíčně):
  `https://opendata.csu.gov.cz/soubory/od/od_org03/res_data.csv`. Hromadný výpis RŽP s provozovnami: nenalezen [?].
- Nespolehlivý plátce DPH: SOAP MF `https://adisrws.mfcr.cz/adistc/axis2/services/rozhraniCRPDPH.rozhraniCRPDPHSOAP?wsdl`.

## 8. Paušální daň (měsíčně)

| Pásmo | 2026 | 2027 (oznámeno, předběžně) |
| --- | --- | --- |
| 1. | 9 162 Kč (od 1. 7. 2026, zpětně) | **9 662 Kč** |
| 2. | 16 745 Kč | 16 745 Kč |
| 3. | 27 139 Kč | 27 139 Kč |

EET OFF 2027 v 1. pásmu: 9 662 + 1 400 = **11 062 Kč/měs.** Oficiální leták FS pro 2027 zatím nevyšel [?].
Zdroje: [FS 2026](https://financnisprava.gov.cz/cs/financni-sprava/media-a-verejnost/tiskove-zpravy-gfr/tiskove-zpravy-2026/poplatnikum-v-prvnim-pasmu-pausalniho-rezimu-snizeni-zalohy),
[podnikatel.cz 2027](https://www.podnikatel.cz/clanky/pausalni-dan-osvc-v-roce-2027-opet-vzroste-vime-kolik-bude-nove-cinit-1/).
