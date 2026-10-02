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

Testovací přílohy v `../test/fixtures/`:

- `official-request-CZ00000019.xml` – oficiální veřejný vzorek podepsané zprávy (konformační test kanonikalizace a podpisu),
- `playground-accepted.xml` – skutečná odpověď Playgroundu z 21. 7. 2026 na tento vzorek (podepsaná, POK končí `-ff`),
- `unsigned-error.xml` – syntetický vzorek nepodepsané chybové odpovědi podle XSD.
