# Oficiální artefakty EET 2.0

Veřejné soubory Finanční správy a certifikačních autorit, použité pro sestavení,
validaci a ověření zpráv. Neobsahují žádné privátní klíče ani hesla.

| Soubor | Zdroj | SHA-256 |
| --- | --- | --- |
| `eet-v4_1/EETXMLSchema.xsd` (verze 4.1) | https://eet.gov.cz/files/EETXMLSchema.xsd | `83597d08520cbfab7e51145df9a765d5ca22e2f9a38644a468d695657c7a032a` |
| `eet-v4_1/EETServiceSOAP.wsdl` (verze 4.1) | https://eet.gov.cz/files/EETServiceSOAP.wsdl | `df149c0bef4ac18c2a6e82116b6eb9bb17d29c055cb0821ac6d3885ec90faeb4` |
| `response-trust/ica/ica-root-rsa-05-2022.pem` | https://www.ica.cz/sites/default/files/download/2025/rca22_rsa.pem | `f72dc3232df2c9598f60c1bbc82f4bcc5acc80af73a60ed6eb3f6bd67ab473e2` |
| `response-trust/ica/ica-public-rsa-06-2022.pem` | https://www.ica.cz/sites/default/files/download/2025/pca22_rsa.pem | `db03fb10906d8cc357ef2d68f2f130d6a5381de3ca9a8cbf45216350ca695116` |

Soubory I.CA byly převzaty z veřejného repozitáře
[fakturaonline/ruby-eet2](https://github.com/fakturaonline/ruby-eet2) (MIT, snapshot 21. 7. 2026),
který uvádí stejné zdrojové URL a kontrolní součty. Před produkčním spuštěním
ověřte aktuálnost na https://eet.gov.cz/pro-vyvojare/ (popis rozhraní v1.2, 25. 8. 2026).

`response-trust/*` jsou kotvy důvěry pro **ověření XML podpisu odpovědi** (POK).
Nejde o TLS důvěru ani o CA pokladních certifikátů.

**Produkce i Playground používají stejné kotvy I.CA** (Root CA/RSA 05/2022 → Public CA/RSA 06/2022).
Zdroj: Finanční správa, „Přístupové a provozní informace – produkční prostředí“ v1.1 (10. 7. 2026),
kap. 3.3 („změna vydávající autority“: odpovědi podepisuje systémový certifikát od I.CA Public CA/RSA
06/2022, NTRCZ-26439395); obdobný dokument pro Playground. Ověřil kontrolor 2. 10. 2026 (recenze č. 2,
DECISIONS Т8). Dřívější produkční kotvy NCA Root CA/RSA 10/2023 a NCA SubCA2/RSA 12/2023 (převzaté
z ruby-eet2) byly odstraněny (R5.2): podle v1.1 odpovědi nepodepisují.

Ověřovací mód produkce vrací nepodepsanou `Chyba kod=0`, takže podpis produkčních odpovědí nejde
předem vyzkoušet. Pin podepisujícího (`organizationIdentifier=NTRCZ-72080043`, keyUsage) je proto pro
produkci nepotvrzený – zkontrolovat na první ostré odpovědi.

## CA EET – vydavatelé pokladních certifikátů (`ca-eet/`)

Kořenové a mezilehlé certifikáty certifikační autority EET (Správa státních služeb vytvářejících důvěru,
`organizationIdentifier=NTRCZ-19122063`). Jimi jsou podepsány pokladní certifikáty, které podnikatel
vygeneruje v DIS+ a nahraje k nám jako .p12. Slouží ke kontrole, z jakého prostředí certifikát pochází
(R12.2: produkční účet přijme jen řetězec `prod`). Nejde o kotvy pro podpis odpovědí (`response-trust/`).

| Soubor | Prostředí | Subjekt (CN) | Platnost do | SHA-256 |
| --- | --- | --- | --- | --- |
| `ca-eet/ca_eet-root_prod.pem` | produkční | EETv2 NCA Root CA RSA 09/2026 | 30. 9. 2036 | `462afa5e88c894ec414690baef1440419478b31c8524d5de5237a20ce305ec8b` |
| `ca-eet/ca_eet-sub_prod.pem` | produkční | EETv2 NCA SubCA RSA 10/2026 | 6. 10. 2030 | `fd0ae27da503f70c99b85affe3c85640cfbc8569b39aef15252c415c30215800` |
| `ca-eet/ca_eet-root_zkus.pem` | zkušební | neprodukcni EETv2 NCA Root CA RSA 09/2026 | 22. 9. 2036 | `8bf166ff5892a2189b4ffd7fd6f2b2401888a33ed22c7c3812ccf0ee9a2eb135` |
| `ca-eet/ca_eet-sub_zkus.pem` | zkušební | neprodukcni EETv2 NCA SubCA RSA 09/2026 | 21. 9. 2030 | `2bcac5bfc93e217723e7a95101fb5be827f26db1d92f4ccda95c553e5af176cc` |
| `ca-eet/ca_eet-root_test.pem` | testovací | test EETv2 NCA Root CA RSA 08/2026 | 31. 8. 2036 | `119fb95054563d4bd409bf086647c24ea77e0a819bbc76476b7521e975e11bf5` |
| `ca-eet/ca_eet-sub_test.pem` | testovací | test EETv2 NCA SubCA RSA 09/2026 | 8. 9. 2030 | `fece368ff7b85bd4b7f5b9525fb68ef2d95b8bb6b2e3ce87c16fe71f86961f82` |
| `ca-eet/ca_eet-root_cert-playground.crt` | Playground | playground EETv2 NCA RootCA RSA 05/2026 | 2. 5. 2036 | `c0257db7f2d9dde3f9413e904814a330cbd2efa41f2ab4ecd8f91f7c5f73f3b6` |
| `ca-eet/ca_eet-sub_cert-playground.crt` | Playground | playground EETv2 NCA SubCA RSA 05/2026 | 4. 5. 2030 | `28182077cb77338070e209fe9e950481d01ecbc181dfc76ecd7985bd2e0f9046` |

Zdroj: https://eet.gov.cz/cs/pro-vyvojare/dokumenty-ke-stazeni (soubory `/assets/cs/cmsmedia/pro-vyvojare/<soubor>`),
staženo kontrolorem 9. 10. 2026 po oznámení FS (Informační e-mail č. 6 z 8. 10. 2026; stahování bylo 8. 10.
dočasně nefunkční). Všechny soubory jsou PEM. Řetězec SubCA → Root ověřen `openssl verify` pro všechna čtyři prostředí.

Testovací přílohy v `../test/fixtures/`:

- `official-request-CZ00000019.xml` – oficiální veřejný vzorek podepsané zprávy (konformační test kanonikalizace a podpisu),
- `playground-accepted.xml` – skutečná odpověď Playgroundu z 21. 7. 2026 na tento vzorek (podepsaná, POK končí `-ff`),
- `unsigned-error.xml` – syntetický vzorek nepodepsané chybové odpovědi podle XSD.
