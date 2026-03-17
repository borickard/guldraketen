# Guldraketen – CLAUDE.md

## Syfte

Guldraketen identifierar och uppmärksammar svenska företag och organisationer som skapar exceptionellt engagerande innehåll på TikTok. Projektet kombinerar automatiserad datainsamling, engagemangsanalys, manuell jurybedömning och en webbplats för nomineringar och presentation.

Projektet är i aktiv utvecklingsfas.

---

## Kärnidé

De flesta reklampriser bedömer kreativitet. Guldraketen fokuserar på faktiskt publikengagemang – likes, kommentarer, delningar – i relation till räckvidd. Data används för att identifiera kandidater, men slutbedömningen görs av en jury. Fokus är på svenska företagskonton på TikTok.

---

## Tech Stack

| Del | Teknologi |
|---|---|
| Webbramverk | Next.js (App Router) |
| Hosting | Vercel |
| Databas | Supabase (PostgreSQL) |
| Scraping | Apify (`clockworks~tiktok-profile-scraper`) |
| Schemalagda jobb | Vercel Cron Jobs |
| Ikoner | lucide-react |

Google Sheets och Google Apps Script används inte längre.

---

## Filstruktur

```
src/
  app/
    page.tsx                          – startsida med veckotopplista
    layout.tsx                        – Google Fonts (Jersey 10, Montserrat, Inter)
    globals.css                       – all CSS (retro OS-tema, monokromt)
    nominera/
      page.tsx                        – nomineringsformuläret
    admin/
      page.tsx                        – admin-UI för att hantera konton + trigga scraping
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
      weeks/
        route.ts                      – returnerar tillgängliga ISO-veckor (exkl. innevarande)
  lib/
    scrape.ts                         – all scrape-logik (startScrape + processScrapeResults)
    supabaseAdmin.ts                  – Supabase-klient (service role)
    validation.ts
vercel.json                           – Vercel Cron-schema (måndagar kl 07 UTC)
next.config.ts                        – remotePatterns för externa bilder (thumbnails)
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
caption         text
engagement_rate numeric generated always as (
                  case when views > 0
                    then round(((likes + comments * 5 + shares * 10)::numeric / views) * 100, 4)
                  else null end
                ) stored
last_updated    timestamptz default now()
```

**Engagement rate-formel:** `(likes + comments×5 + shares×10) / views × 100`
Räknas automatiskt av databasen – skrivs aldrig manuellt.

---

## Scraping-flöde

```
Vercel Cron (måndag kl 07 UTC) ELLER admin-knapp
  → POST /api/scrape  (Cron) eller POST /api/scrape/trigger  (admin)
  → src/lib/scrape.ts → startScrape(webhookUrl, daysBack)
      1. Hämtar aktiva handles från Supabase accounts
      2. Startar Apify-körning asynkront (returnerar direkt med runId)
      3. Registrerar webhook via base64-kodad query-parameter

Apify kör klart (ca 10–30 sek)
  → POST /api/scrape/webhook
  → src/lib/scrape.ts → processScrapeResults(datasetId)
      1. Hämtar dataset-items från Apify (via resource.defaultDatasetId)
      2. Upsertar videos i Supabase inkl. thumbnail_url och caption
      3. Uppdaterar followers + followers_updated_at på accounts
```

**daysBack** – standardvärde 14 för Cron. Admin-UI har inputfält för manuell körning.
**Webhook fungerar bara i produktion (Vercel)**, inte lokalt.

---

## Miljövariabler

```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
APIFY_TOKEN=
CRON_SECRET=
NEXT_PUBLIC_SITE_URL=https://guldraketen.vercel.app
```

`.env.local` ska **inte** committas – finns i `.gitignore`.

---

## Webbplats

### Design
- Retro OS-fönster-tema med svarta kanter och box-shadow offset
- Bakgrundsfärg: `#64a4c8` (blå)
- Fönster/kort: vit bakgrund, svarta outlines
- Typsnitt: **Jersey 10** (logotyp), **Montserrat** (siffror/handles), **Inter** (brödtext/labels)
- "Guld" i logotypen: `#ffb800`

### Startsida (`/`)
- Veckotopplista med videos live från Supabase
- Dropdown för att välja vecka (ISO-veckonummer), defaultar till senaste kompletta veckan
- Innevarande vecka exkluderas alltid (ej komplett data)
- Sortering via klickbara kolumnrubriker med Lucide-ikoner (Rocket, Eye, ThumbsUp, MessageCircle, Share2)
- Filter för followers och views – bakom "Filters"-knapp på mobil
- URL-parametrar för delningsbara vyer (`?week=&sort=&size=&views=`)
- Thumbnails via Next.js image proxy (72×72px kvadrat)
- Caption visas under handle
- Modal med inbäddad TikTok-spelare vid klick på thumbnail
- Mobil: stats i full bredd under thumbnail, sortering alltid synlig

### Nominera (`/nominera`)
- Formulär för att nominera TikTok-konton

### Admin (`/admin`)
- Lägg till/ta bort konton, aktivera/avaktivera
- Inputfält för dagar bakåt (default 14)
- Knapp för att trigga scraping manuellt

---

## Lokalt test av scraping

```bash
curl -X POST https://guldraketen.vercel.app/api/scrape \
  -H "Authorization: Bearer <CRON_SECRET>"
```

---

## TODO / Nästa steg

### 🚀 Hero-sektion på startsidan (prioriterat)
Redesigna startsidan till två delar:

**Del 1 – Hero / Om Guldraketen**
- Kort beskrivning av vad Guldraketen är och vad som premieras
- Tydliggör att fokus är på svenska företagskonton
- Visa föregående veckas topp 3 som en karusell eller tre kort sida vid sida
- Tydlig visuell hierarki: 1a, 2a, 3a plats

**Del 2 – Fullständig topplista**
- Nuvarande topplista med filter och sortering
- Kan vara på `/topplista` som undersida, eller längre ned på startsidan

### 🔗 Delbarhet och LinkedIn-integration
För att varje veckas topp 3 ska kunna delas på LinkedIn och andra plattformar:

- **`/vecka/[week]`** – dedikerad sida per vecka (t.ex. `/vecka/2026-W11`) med hero-layout för topp 3. Fungerar som permanent arkiv – data finns kvar i Supabase hur länge som helst.
- **Open Graph-bilder** via `@vercel/og` – generera dynamiska `og:image` per vecka/video som visar thumbnail + rank + handle + stats. Gör att länkförhandsvisningen ser snygg ut på LinkedIn, Slack etc.
- **"Dela"-knapp** på varje topplacerad video som öppnar LinkedIn share-dialog med rätt URL och förhandsvisning.

### Övriga nästa steg
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

---

## Projektägare

Rickard
Digital Strategist, IQ-initiativet
Drivs som sidoprojekt

---

## Uppdaterade TODO (senast)

### Hall of Fame
- Poängsystem: 1:a plats = 3p, 2:a = 2p, 3:e = 1p per vecka
- Ackumulerat per konto över alla veckor
- Egen sida `/hall-of-fame` med rankning

### LinkedIn-delning via admin
- Knapp i `/admin` för att manuellt trigga en LinkedIn-post
- Postar topp 1-videons thumbnail + stats för senaste veckan
- Kräver LinkedIn API-integration (OAuth)

### Nomineringsflöde
- Befintligt formulär på `/nominera` används
- Admin granskar och godkänner med ett klick → kontot läggs till i `accounts`

### Delbarhet
- `/vecka/[week]` – dedikerad sida per vecka med hero för topp 3
- `@vercel/og` för Open Graph-bilder per vecka/video
- "Dela"-knapp med LinkedIn share-dialog