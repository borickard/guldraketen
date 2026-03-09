# Guldraketen – CLAUDE.md

## Syfte

Guldraketen identifierar och uppmärksammar svenska företag och organisationer som skapar exceptionellt engagerande innehåll på TikTok. Projektet kombinerar automatiserad datainsamling, engagemangsanalys, manuell jurybedömning och en webbplats för nomineringar och presentation.

Projektet är i aktiv utvecklingsfas.

---

## Kärnidé

De flesta reklampriser bedömer kreativitet. Guldraketen fokuserar på faktiskt publikengagemang – likes, kommentarer, delningar – i relation till räckvidd. Data används för att identifiera kandidater, men slutbedömningen görs av en jury.

---

## Tech Stack

| Del | Teknologi |
|---|---|
| Webbramverk | Next.js (App Router) |
| Hosting | Vercel |
| Databas | Supabase (PostgreSQL) |
| Scraping | Apify (`clockworks~tiktok-profile-scraper`) |
| Schemalagda jobb | Vercel Cron Jobs |

Google Sheets och Google Apps Script används inte längre.

---

## Filstruktur

```
src/
  app/
    page.tsx                          – startsida med topplista live från Supabase
    layout.tsx
    globals.css                       – all CSS för hela sajten
    nominera/
      page.tsx                        – nomineringsformuläret (flyttat från startsidan)
    admin/
      page.tsx                        – admin-UI för att hantera konton
    api/
      accounts/
        route.ts                      – CRUD för accounts-tabellen
      nominate/
        route.ts                      – nomineringsformulär
      scrape/
        route.ts                      – scrape-endpoint (används av Vercel Cron)
        trigger/
          route.ts                    – anropas från admin-UI (ingen hemlighet i browsern)
        webhook/
          route.ts                    – tar emot callback från Apify när scraping är klar
      videos/
        route.ts                      – hämtar videos från Supabase för topplistan
  lib/
    scrape.ts                         – all scrape-logik (startScrape + processScrapeResults)
    supabaseAdmin.ts                  – Supabase-klient (service role)
    validation.ts
vercel.json                           – Vercel Cron-schema (måndagar kl 07 UTC)
next.config.ts                        – Next.js config inkl. remotePatterns för externa bilder
```

---

## Supabase-schema

### `accounts`
Konton att scrapea. Hanteras via admin-sidan.

```sql
id                   uuid primary key default gen_random_uuid()
handle               text not null unique
is_active            boolean not null default true
followers            integer
followers_updated_at timestamptz
created_at           timestamptz default now()
```

### `videos`
Scrapad videodata. Upsert på `video_url`.

```sql
id              uuid primary key default gen_random_uuid()
handle          text not null references accounts(handle) on delete cascade
video_url       text not null unique
published_at    timestamptz
views           integer
likes           integer
comments        integer
shares          integer
thumbnail_url   text
engagement_rate numeric generated always as (
                  case when views > 0
                    then round(((likes + comments * 5 + shares * 10)::numeric / views) * 100, 4)
                  else null end
                ) stored
last_updated    timestamptz default now()
```

**Engagement rate-formel:** `(likes + comments×5 + shares×10) / views × 100`
Räknas automatiskt av databasen – skrivs aldrig manuellt.

**OBS:** Supabase lagrar alla tider i UTC. Vid visning på sajten, konvertera till lokal tid:
```ts
new Date(video.last_updated).toLocaleString("sv-SE", { timeZone: "Europe/Stockholm" })
```

---

## Scraping-flöde

```
Vercel Cron (måndag kl 07 UTC) ELLER admin-knapp
  → POST /api/scrape  (Cron) eller POST /api/scrape/trigger  (admin)
  → src/lib/scrape.ts → startScrape()
      1. Hämtar aktiva handles från Supabase accounts
      2. Startar Apify-körning asynkront (returnerar direkt med runId)
      3. Registrerar webhook på Apify-körningen via query-parameter (base64-kodad)

Apify kör klart (ca 10–30 sek)
  → POST /api/scrape/webhook
  → src/lib/scrape.ts → processScrapeResults()
      1. Hämtar dataset-items från Apify (via resource.defaultDatasetId i payload)
      2. Upsertar videos i Supabase inkl. thumbnail_url
      3. Uppdaterar followers + followers_updated_at på accounts
```

**Varför asynkront?** Vercel Hobby-plan tillåter max 10 sekunders körtid per funktion. Lösningen är att starta jobbet och svara direkt – Apify kallar på webhooken när det är klart.

**Webhook-URL i produktion:** `https://guldraketen.vercel.app/api/scrape/webhook`
Webhooken fungerar bara i produktion (Vercel), inte lokalt i Codespaces.

---

## Miljövariabler

Krävs i `.env.local` och Vercel Environment Variables:

```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
APIFY_TOKEN=
CRON_SECRET=
NEXT_PUBLIC_SITE_URL=https://guldraketen.vercel.app
```

`.env.local` ska **inte** committas – den finns i `.gitignore`.

---

## Webbplats

### Startsida (`/`)
- Topplista med videos live från Supabase
- Thumbnails från TikTok visas via Next.js image proxy
- Sortering: engagemangsrate, views, likes, kommentarer, delningar
- Filter: kontostorlek (följare)
- Klick på thumbnail expanderar inbäddad TikTok-video
- Design: ljust editorial tema, Cormorant Garamond + DM Mono + DM Sans

### Nominera (`/nominera`)
- Formulär för att nominera TikTok- eller Instagram-konton
- Sparar till Supabase via `/api/nominate`

### Admin (`/admin`)
- Lägg till/ta bort konton
- Aktivera/avaktivera konton med toggle
- Visar följarantal och senaste uppdatering
- Knapp för att trigga scraping manuellt
- Ej lösenordsskyddad ännu – planeras med Supabase Auth

---

## Lokalt test av scraping

Webhooken kan inte testas lokalt. Verifiera att Apify-körningen startar:

```bash
curl -X POST http://localhost:3000/api/scrape \
  -H "Authorization: Bearer <CRON_SECRET>"
```

Testa hela flödet mot Vercel:

```bash
curl -X POST https://guldraketen.vercel.app/api/scrape \
  -H "Authorization: Bearer <CRON_SECRET>"
```

Kontrollera i Apify-konsolen att **Triggered integrations** visar **1**.

---

## Möjliga nästa steg

- Lösenordsskydd på `/admin` med Supabase Auth
- Kategori-fält på konton (för filtrering)
- Fler konton att tracka
- Presentera vinnare/shortlist

---

## Hur man återupptar projektet

1. Klona repot från GitHub (`borickard/guldraketen`)
2. Kör `npm install`
3. Lägg in miljövariabler i `.env.local`
4. Kör `npm run dev`
5. Startsida: `/` · Admin: `/admin` · Nominera: `/nominera`
6. Supabase-tabeller: skapa via SQL ovan om de saknas

---

## Projektägare

Rickard
Digital Strategist, IQ-initiativet
Drivs som sidoprojekt