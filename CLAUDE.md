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
  lib/
    scrape.ts                         – all scrape-logik (delas mellan route.ts och trigger)
    supabaseAdmin.ts                  – Supabase-klient (service role)
    validation.ts
vercel.json                           – Vercel Cron-schema
```

---

## Supabase-schema

### `accounts`
Konton att scrapea. Hanteras via admin-sidan.

```sql
id                   uuid primary key
handle               text unique not null
is_active            boolean default true
followers            integer
followers_updated_at timestamptz
created_at           timestamptz default now()
```

### `videos`
Scrapad videodata. Upsert på `video_url`.

```sql
id              uuid primary key
handle          text references accounts(handle)
video_url       text unique not null
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

Engagement rate = `(likes + comments×5 + shares×10) / views × 100`  
Räknas automatiskt av databasen – skrivs aldrig manuellt.

---

## Scraping-flöde

```
Vercel Cron (måndag kl 07)
  → GET /api/scrape  (Authorization: Bearer CRON_SECRET)
  → src/lib/scrape.ts
      1. Hämtar aktiva handles från Supabase accounts
      2. Anropar Apify API (senaste 14 dagar, max 50 videos/konto)
      3. Upsertar videos i Supabase
      4. Uppdaterar followers + followers_updated_at på accounts
```

Kan även triggas manuellt via admin-sidan (`/admin` → "Kör scraping nu").  
Admin-knappen anropar `/api/scrape/trigger` som importerar `scrape.ts` direkt – hemligheten lämnar aldrig browsern.

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
- Knapp för att trigga scraping manuellt
- Visar följarantal och senaste uppdatering per konto

Sidan är ännu inte lösenordsskyddad – planeras med Supabase Auth.

---

## Webbplats

- Deployad på Vercel
- Nomineringsformulär fungerar
- Topplista med inbäddade TikTok-videos planeras (påbörjad design)

---

## Möjliga nästa steg

**Data**
- Topplista på webbplatsen med inbäddade videos
- Filtrera på kategori, kontostorlek, typ av engagemang
- Fler konton att tracka

**Admin**
- Lösenordsskydd med Supabase Auth
- Kategori-fält på konton

**Brand**
- LinkedIn som huvudkanal
- Samarbete med branschmedia

---

## Hur man återupptar projektet

1. Klona repot från GitHub
2. Kör `npm install`
3. Lägg in miljövariabler i `.env.local`
4. Kör `npm run dev`
5. Admin-sidan: `/admin`
6. Supabase-tabeller: skapa via SQL i `CLAUDE.md` ovan om de saknas

---

## Projektägare

Rickard  
Digital Strategist, IQ-initiativet  
Drivs som sidoprojekt