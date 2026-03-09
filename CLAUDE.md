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
    page.tsx                          – startsida
    layout.tsx
    globals.css
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
  lib/
    scrape.ts                         – all scrape-logik (startScrape + processScrapeResults)
    supabaseAdmin.ts                  – Supabase-klient (service role)
    validation.ts
vercel.json                           – Vercel Cron-schema (måndagar kl 07 UTC)
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
      2. Upsertar videos i Supabase
      3. Uppdaterar followers + followers_updated_at på accounts
```

**Varför asynkront?** Vercel Hobby-plan tillåter max 10 sekunders körtid per funktion. Apify-scraping tar längre tid. Lösningen är att starta jobbet och svara direkt – Apify kallar på webhooken när det är klart.

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
```

---

## Admin-sidan (`/admin`)

- Lägg till TikTok-konton via handle (utan @)
- Aktivera/avaktivera konton med toggle
- Ta bort konton
- Knapp för att trigga scraping manuellt (asynkront – svarar direkt, data sparas när Apify är klar)
- Visar följarantal och senaste uppdatering per konto

Sidan är ännu inte lösenordsskyddad – planeras med Supabase Auth.

---

## Lokalt test av scraping

Webhooken kan inte testas lokalt. Men man kan verifiera att Apify-körningen startar:

```bash
curl -X POST http://localhost:3000/api/scrape \
  -H "Authorization: Bearer <CRON_SECRET>"
```

Förväntat svar: `{"message":"Scraping startad","runId":"...","handles":N}`

För att testa hela flödet inklusive webhook, kör mot Vercel:

```bash
curl -X POST https://guldraketen.vercel.app/api/scrape \
  -H "Authorization: Bearer <CRON_SECRET>"
```

Kontrollera sedan i Apify-konsolen att **Triggered integrations** visar **1** på körningen.

---

## Webbplats

- Deployad på Vercel: `https://guldraketen.vercel.app`
- Nomineringsformulär fungerar
- Topplista med inbäddade TikTok-videos planeras (påbörjad design)

---

## Möjliga nästa steg

**Data**
- Topplista på webbplatsen med inbäddade videos
- Filtrera på kategori, kontostorlek, typ av engagemang
- Fler konton att tracka
- Kategori-fält på accounts

**Admin**
- Lösenordsskydd med Supabase Auth

**Brand**
- LinkedIn som huvudkanal
- Samarbete med branschmedia

---

## Hur man återupptar projektet

1. Klona repot från GitHub (`borickard/guldraketen`)
2. Kör `npm install`
3. Lägg in miljövariabler i `.env.local`
4. Kör `npm run dev`
5. Admin-sidan: `/admin`
6. Supabase-tabeller: skapa via SQL ovan om de saknas

---

## Projektägare

Rickard
Digital Strategist, IQ-initiativet
Drivs som sidoprojekt