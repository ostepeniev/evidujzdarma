# Obrázky značky EvidujZdarma

Logo a obálky sociálních sítí (rozhodnutí К3). Na serveru leží v `/var/www/evidujzdarma-brand` a nginx je vydává na `https://evidujzdarma.cz/brand/…`.

| Soubor | Kde |
| --- | --- |
| `profil-1080.png` | profilový obrázek Facebook (stránka, skupina), LinkedIn |
| `linkedin-logo-400.png` | logo LinkedIn |
| `fb-stranka-cover-1640x624.png` | obálka Facebook stránky |
| `fb-skupina-cover-1640x856.png` | obálka Facebook skupiny |
| `linkedin-cover-1128x191.png` | obálka LinkedIn |
| `post-uvod-1200.png` | úvodní příspěvek |

Generují se z HTML (`render.mjs`, `render-shots.mjs` – varianty 1423×672 pro nahrání přes snímek obrazovky prohlížeče) headless Chromiem s fontem Inter. Barvy a ikona jsou stejné jako na webu (`apps/web/src/app/icon.svg`, `--color-brand-600 #0b7a57`). Žádné státní symboly ani barvy státu (П3); text „Nezávislá služba, není provozována Finanční správou." je na každé obálce.
