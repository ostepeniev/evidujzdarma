# Oficiální artefakty EET 2.0

Veřejné soubory Finanční správy a certifikačních autorit, použité pro sestavení,
validaci a ověření zpráv. Neobsahují žádné privátní klíče ani hesla.

| Soubor | Zdroj | SHA-256 |
| --- | --- | --- |
| `eet-v4_1/EETXMLSchema.xsd` (verze 4.1) | https://eet.gov.cz/files/EETXMLSchema.xsd | `83597d08520cbfab7e51145df9a765d5ca22e2f9a38644a468d695657c7a032a` |
| `eet-v4_1/EETServiceSOAP.wsdl` (verze 4.1) | https://eet.gov.cz/files/EETServiceSOAP.wsdl | `df149c0bef4ac18c2a6e82116b6eb9bb17d29c055cb0821ac6d3885ec90faeb4` |
| `response-trust/playground/ica-root-rsa-05-2022.pem` | https://www.ica.cz/sites/default/files/download/2025/rca22_rsa.pem | `f72dc3232df2c9598f60c1bbc82f4bcc5acc80af73a60ed6eb3f6bd67ab473e2` |
| `response-trust/playground/ica-public-rsa-06-2022.pem` | https://www.ica.cz/sites/default/files/download/2025/pca22_rsa.pem | `db03fb10906d8cc357ef2d68f2f130d6a5381de3ca9a8cbf45216350ca695116` |
| `response-trust/production/nca-root-rsa-10-2023.der` | https://www.narodni-ca.gov.cz/Dokumenty/rsaRootCA_2023.der | `d2d98e1b7af2d0e33276a33120d30863a66858d881eafd7400d09a4942630cb7` |
| `response-trust/production/nca-subca2-rsa-12-2023.der` | https://www.narodni-ca.gov.cz/Dokumenty/rsaSubCA2_2023.der | `ae36c864fc904b29cbc4b38a096364ae311ff1db544c5c064c12ec4bf9c5a8b3` |

Soubory byly převzaty z veřejného repozitáře
[fakturaonline/ruby-eet2](https://github.com/fakturaonline/ruby-eet2) (MIT, snapshot 21. 7. 2026),
který uvádí stejné zdrojové URL a kontrolní součty. Před produkčním spuštěním
ověřte aktuálnost na https://eet.gov.cz/pro-vyvojare/ (popis rozhraní v1.2, 25. 8. 2026).

`response-trust/*` jsou kotvy důvěry pro **ověření XML podpisu odpovědi** (POK).
Nejde o TLS důvěru ani o CA pokladních certifikátů.

Testovací přílohy v `../test/fixtures/`:

- `official-request-CZ00000019.xml` – oficiální veřejný vzorek podepsané zprávy (konformační test kanonikalizace a podpisu),
- `playground-accepted.xml` – skutečná odpověď Playgroundu z 21. 7. 2026 na tento vzorek (podepsaná, POK končí `-ff`),
- `unsigned-error.xml` – syntetický vzorek nepodepsané chybové odpovědi podle XSD.
