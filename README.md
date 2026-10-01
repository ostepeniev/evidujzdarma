# EvidujZdarma.cz

Безкоштовна каса для чеської електронної евіденції тржб **EET 2.0** (обов'язкова з 1. 1. 2027; закон не передбачає «пілотного» січня). До неї входять SEO/GEO-сайт з інструментами і каталог фірм.
Незалежний сервіс. Finanční správa його не провозує.

## Що є в репозиторії

| Частина | Де | Стан |
| --- | --- | --- |
| Лендинг + передреєстрація (double opt-in, реферал, лист «Váš EET plán») | `apps/web/src/app/(site)/page.tsx` | готово |
| Kontrola podle IČO (ARES + RŽP, оцінка «чи стосується», чекліст) | `/kontrola-ico` | готово |
| Kalkulačka EET OFF, kvíz «Musím evidovat?», průvodce evidenčními jednotkami, generátor QR platby | `/kalkulacka-eet-off`, `/musim-evidovat`, `/evidencni-jednotky`, `/qr-platba` | готово |
| Гайди (контент-модель, Article/FAQ/HowTo schema, noindex до рецензії) | `/navody`, `apps/web/src/content/guides` | хвиля 1 |
| SEO/GEO: robots (дозволено ШІ-ботів), sitemap, `llms.txt`, `llms-full.txt`, JSON-LD | `apps/web/src/app` | готово |
| **PWA-каса** (офлайн, PIN, каталог, оплати, повернення, чеки, історія, підсумок, vklad/výběr, денне закриття) | `/pokladna` | готово (mock / Playground / продакшн) |
| Налаштування «EET za 15 minut» (ARES, одиниці, сертифікат, тестова тржба, пристрої, персонал) | `/pokladna/nastaveni` | готово |
| **Фіскальне ядро EET 2.0** (SOAP v4.1, WS-Security, перевірка підпису відповіді, черга 48 год) | `packages/fiscal-core` | готово, перевірено на офіційному зразку FS |
| Каталог фірм і провозовен (ARES / ČSÚ RES, поступова індексація, GDPR-námitky) | `/firma`, `/provozovna`, `/firmy`, `/namitka` | готово (імпорт: `pnpm --filter @ez/worker catalog:import`) |
| Бухгалтери: hromadná kontrola IČO, šablony dopisů, кабінет (готовність клієнтів, запрошення, експорт) | `/ucetni`, `/kabinet` | готово |
| «Co se o EET 2.0 píše špatně» (твердження vs. закон, історія закону) | `/co-se-o-eet-pise-spatne` | готово |
| «Je EET dole?» — монітор доступності FS, алерти оператору (збій FS, тржби без POK > 1 год) | `/stav-eet`, `/api/stav-eet` | готово |
| Анонімне опитування на лендингу | `/api/anketa` | готово |
| Інфраструктура: Docker, Caddy (HTTPS), бекапи, worker | `infra/`, `Dockerfile` | готово |

## Документація

- [Архітектура і хостинг (чому без Supabase, Hetzner vs. чеські провайдери)](docs/architektura-i-hosting.md)
- [Деплой на Hetzner і DNS evidujzdarma.cz у Webglobe](docs/deploy.md)
- [Дорожня карта (з аналізу конкурентів і оновленої специфікації)](docs/roadmap.md)
- [Перевірені факти про EET 2.0 і джерела](docs/research/eet2-fakta-2026-10.md)
- [Що має перевірити daňový poradce](docs/revize-danovy-poradce.md)
- [Офіційні артефакти FS (XSD, WSDL, кореневі сертифікати)](packages/fiscal-core/official/README.md)

## Швидкий старт (розробка)

```bash
pnpm install
cp .env.example apps/web/.env.local     # заповніть DATABASE_URL, MASTER_KEY, APP_SECRET, CRON_SECRET; ARES_MOCK=1
pnpm db:migrate
pnpm dev                                 # http://localhost:3000
pnpm test
```

Стек: TypeScript, Next.js 16 (App Router, SSR/ISR), PostgreSQL 16 + Drizzle, Tailwind CSS 4, IndexedDB (каса офлайн), Docker + Caddy.
