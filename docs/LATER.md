# Відкладене свідомо

| Що | Звідки | Коли повертатись |
| --- | --- | --- |
| Перевірка відкликання (CRL) сертифіката підписувача відповідей FS | рецензія №1, A В4 | після бети, до 1. 1. 2027 |
| «Ключ лише на пристрої» (підпис у браузері, WebCrypto) — колонка `storage` уже є | специфікація, «Амбітні напрями» | рішення власника (DECISIONS, Відкрите 5) |
| Фіскальне ядро як пакет для Alisio | DECISIONS Т2 | після ostrého provozu (лютий 2027) |
| KMS у ЄС замість `MASTER_KEY` в env | рецензія №1, B | до 1 000 активних провозовен |
| Нативні застосунки (Capacitor) | специфікація | грудень 2026, після бети каси |
| Монітор доступності «Je EET dole?», open-source SDK eet2 для TS | специфікація, аналіз eet20/eetoff | після першої тржби на Playground з бетою |
| Мікросайти з точним доменом (eetkalkulacka.cz тощо) | аналіз eet20.cz / eetoff.cz | рішення власника; не більше 3–4 і лише з інструментом |
| Сторінка «Co se o EET 2.0 píše špatně» (наша версія Rozpory) | аналіз eet20.cz | хвиля 2 контенту, листопад |
| `node-forge` ≤ 1.4.0: high-advisory про перевірку підпису RSA PKCS#1 v1.5, виправленої версії немає. У нас уразлива функція не викликається: forge лише парсить PKCS#12 і атрибути сертифіката (у воркері з лімітами, R2/B), підписи й ланцюжки — `node:crypto`. Tripwire-тест `r3-13-deps` падає, якщо forge почне перевіряти підписи | звіт R3.13, рішення контролера | щойно вийде виправлена версія; або заміна forge на `pkijs`/`@peculiar/x509` до 1. 1. 2027, якщо advisory не закриють |
| Session: klouzavá platnost, „odhlásit všude“, seznam relací, odvolání starých relací po novém přihlášení; automatické odpojení neaktivních zařízení (token pokladny je teď bez expirace) | рецензія №1, B Дрібне 2 (R4: hotové jen upozornění vlastníkovi e-mailem) | před prvním placeným plánem nebo při incidentu |
| Cookie `__Host-ez_session` (dnes `ez_session`; CSRF kryje kontrola původu + formátu v `proxy.ts`) | рецензія №1, B Дрібне 1 | při další změně přihlašování (odhlásí všechny) |
