# Hotel a PMS: co poslat do EET API

EvidujZdarma, 30. 10. 2026 (S8, rozd. 10). Pro vývojáře hotelového PMS (první klient: ALiSiO). Stejná tabulka je na [/api-docs](https://evidujzdarma.cz/api-docs#hotel).

Pravidla jsou převzatá z recenzovaného návodu [EET u ubytování](https://evidujzdarma.cz/navody/eet-ubytovani) a z ověřených faktů webu – nic nového tu netvrdíme. Co evidovat, rozhoduje podnikatel (případně jeho účetní); API odešle to, co PMS pošle. Oficiální informace: https://eet.gov.cz

## Kdy volat API

| Událost v PMS | Volat API? | Jak |
|---|---|---|
| Záloha převodem / platební bránou / přes Booking, Airbnb online | **Ne** | Vzdálená platba – neeviduje se. |
| Záloha zaplacená na recepci (hotovost, karta, QR) | **Ano** | Běžná tržba, `kind: goods`, řádek např. „Záloha – rezervace …“. |
| Doplatek na recepci | **Ano** | Samostatná tržba; záloha a doplatek se v datové zprávě nepropojují. |
| Doplatek převodem na fakturu | **Ne** | Neeviduje se. Chce-li PMS mít vše na jednom místě, může poslat `transfer` – tržba bude `not_evidenced` a do FS nepůjde. |
| Minibar, wellness, parkování placené na místě | **Ano** | Běžná tržba. |
| Vratná kauce – složení / vrácení | **Ne** | Při složení ani při vrácení se neeviduje (ani stornem). |
| Část kauce složené na místě, kterou si ponecháte | **Ano** | Tržba jen na ponechanou (použitou) částku. |
| Kauce poslaná převodem, část ponechána | **Ne** | Nejde o kontaktní platbu. |
| Storno / vrácení peněz na místě | **Ano** | `POST /v1/sales/{id}/refund`. |
| Místní poplatek z pobytu | **Otevřené** | Finanční správa zatím nezveřejnila, zda se zahrnuje do evidované tržby (návod, oddíl „Místní poplatek“). V PMS jako nastavení na úrovni hotelu – rozhodnutí podnikatele a jeho účetní, bez výchozí hodnoty. |
| Dobití kreditu / hotelové karty k pozdějšímu čerpání | **Ano** | `kind: credit_topup`; čerpání kreditu `method: credit`. |

Obecně (fakta webu): „Evidují se platby přijaté při osobním kontaktu nebo v provozovně: hotovost, platební karta, QR kód, poukázka, šek i virtuální aktiva. Neevidují se vzdálené platby – platební brána e-shopu, QR kód na webu, bankovní převod na základě faktury.“ Viz také [Kontaktní platba](https://evidujzdarma.cz/navody/kontaktni-platba) a [Storno a vrácení peněz](https://evidujzdarma.cz/navody/storno-a-vraceni-eet).

## Místní poplatek z pobytu

Finanční správa zatím nezveřejnila, zda se poplatek, který ubytovatel vybírá pro obec, zahrnuje do evidované tržby (návod, oddíl „Místní poplatek z pobytu“). V PMS proto dejte nastavení na úrovni hotelu „Poplatek z pobytu evidovat: ano / ne“ – **bez výchozí hodnoty**, rozhodne podnikatel se svou účetní. Až FS stanovisko vydá, upravíme návod i tento dokument.

## Příklad: záloha na recepci a doplatek kartou při odjezdu

Host při příjezdu zaplatí na recepci zálohu kartou, při odjezdu doplatí kartou zbytek a minibar. Jsou to **dvě samostatné tržby**, každá s vlastním `id` (uuid platby v PMS) a `externalRef`. Záloha poslaná předem převodem by se neposílala vůbec.

Záloha:

```json
{
  "sales": [
    {
      "id": "0b6f3f1e-2a51-4c8e-9a4e-6a1d2f0c7a11",
      "externalRef": "ALI-PAY-1001",
      "unitId": "3f2a9c7e-5b1d-4e8f-a2c4-9d6e1b0f3a22",
      "soldAt": "2027-01-05T15:20:00+01:00",
      "lines": [
        {
          "name": "Záloha – rezervace R-2027-0042",
          "qty": 1,
          "unitPrice": 200000,
          "vatRate": 12,
          "kind": "goods"
        }
      ],
      "payments": [
        {
          "method": "card",
          "amount": 200000
        }
      ]
    }
  ]
}
```

Doplatek:

```json
{
  "sales": [
    {
      "id": "6c1d8a42-9e3b-4f70-b5a1-2e8c7d4f9b33",
      "externalRef": "ALI-PAY-1002",
      "unitId": "3f2a9c7e-5b1d-4e8f-a2c4-9d6e1b0f3a22",
      "soldAt": "2027-01-08T10:05:00+01:00",
      "lines": [
        {
          "name": "Doplatek – rezervace R-2027-0042",
          "qty": 1,
          "unitPrice": 340000,
          "vatRate": 12,
          "kind": "goods"
        },
        {
          "name": "Minibar",
          "qty": 2,
          "unitPrice": 6000,
          "vatRate": 21,
          "kind": "goods"
        }
      ],
      "payments": [
        {
          "method": "card",
          "amount": 352000
        }
      ]
    }
  ]
}
```

## Příklad: kauce, ponecháno 300 Kč

Host složil na recepci v hotovosti vratnou kauci 3 000 Kč. Složení ani vrácení zbytku se neposílá. Z kauce si ubytovatel ponechá 300 Kč na škodu → jedna tržba jen na 300 Kč (30000 haléřů):

```json
{
  "sales": [
    {
      "id": "9a4e2b17-3c6d-4f8a-8b1e-5d2c7f0a6e44",
      "externalRef": "ALI-KAUCE-77",
      "unitId": "3f2a9c7e-5b1d-4e8f-a2c4-9d6e1b0f3a22",
      "soldAt": "2027-01-08T10:10:00+01:00",
      "lines": [
        {
          "name": "Úhrada škody z kauce (poškozené povlečení)",
          "qty": 1,
          "unitPrice": 30000,
          "vatRate": 21,
          "kind": "goods"
        }
      ],
      "payments": [
        {
          "method": "cash",
          "amount": 30000
        }
      ]
    }
  ]
}
```

Kdyby host kauci poslal předem převodem, neposílá se nic ani při ponechání části.

Sazby DPH v příkladech jsou ilustrativní – určuje je podnikatel podle povahy plnění.

## Storno a vrácení peněz na místě

`POST /v1/sales/{id}/refund` k původní tržbě (celá vratka bez `lines`, částečná s `lines`). Vratka je záporná tržba na jednotce původní tržby; platby zrcadlí původní platby.

## Zdroje

- [MF ČR: EET 2.0 – ministerstvo představuje moderní evidenci](https://mf.gov.cz/cs/ministerstvo/media/tiskove-zpravy/2026/eet-2-0-ministerstvo-financi-predstavuje-moderni-a-62878)
- [eet.gov.cz: Kdo musí evidovat tržby](https://eet.gov.cz/cs/koho-se-eet-tyka/kdo-musi-evidovat-trzby)
- [Daňovky.cz: Finanční správa vysvětluje nový pojem kontaktní platby](https://danovky.cz/cs/eet-2-0-financni-sprava-vysvetluje-novy-pojem-kontaktni-platby)
- [eet.gov.cz: Praktické informace](https://eet.gov.cz/cs/zacinam-s-eet/prakticke-informace)
- [MF a FS: Seminář pro vývojáře EET 2.0 (prezentace, „Specifické případy“)](https://eet.gov.cz/assets/cs/cmsmedia/pro-vyvojare/EET2_Prezentace_Seminar_pro_vyvojare_23-.pdf)
