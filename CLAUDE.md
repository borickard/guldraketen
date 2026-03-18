# Guldraketen – CLAUDE.md

## Syfte

Guldraketen identifierar och uppmärksammar svenska företag och organisationer som skapar exceptionellt engagerande innehåll på TikTok. Projektet kombinerar automatiserad datainsamling, engagemangsanalys och en webbplats för nomineringar och presentation.

---

## Kärnidé

Guldraketen fokuserar på faktiskt publikengagemang – likes, kommentarer, delningar – i relation till räckvidd. Fokus är på svenska företagskonton på TikTok. Engagement rate-formeln: `(likes + comments×5 + shares×10) / views × 100` – delningar väger tyngst eftersom de kräver mest av tittaren.

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

---

## Filstruktur

```
src/
  app/
    page.tsx                          – startsida med hero + topplista
    layout.tsx                        – Google Fonts (Jersey 10, Montserrat, Inter)
    globals.css                       – all CSS
    nominera/
      page.tsx                        – nomineringsformuläret
    admin/
      page.tsx                        – admin-UI
    [week]/
      [rank]/
        page.tsx                      – delningssida /2026-W10/top1 etc
    api/
      accounts/route.ts               – CRUD inkl. display_name
      nominate/route.ts
      scrape/route.ts                 – Vercel Cron endpoint
      scrape/trigger/route.ts         – manuell trigger från admin
      scrape/webhook/route.ts         – Apify callback
      videos/route.ts                 – topplista med veckofilter
      weeks/route.ts                  – tillgängliga veckor (exkl. nuvarande + föregående)
      top3/route.ts                   – topp 3 för en vecka (används av hero)
  lib/
    scrape.ts                         – startScrape + processScrapeResults
    supabaseAdmin.ts
    validation.ts
vercel.json                           – Cron: måndagar kl 07 UTC
next.config.ts                        – remotePatterns för thumbnails
```

---

## Supabase-schema

### `accounts`
```sql
id                   uuid primary key default gen_random_uuid()
handle               text not null unique
display_name         text                        -- visningsnamn, t.ex. "Lidl Sverige"
is_active            boolean not null default true
followers            integer
followers_updated_at timestamptz
created_at           timestamptz default now()
```

### `videos`
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

---

## Scraping-flöde

```
Vercel Cron (måndag kl 07 UTC) ELLER admin-knapp
  → startScrape(webhookUrl, daysBack)  [lib/scrape.ts]
  → Apify kör asynkront
  → POST /api/scrape/webhook
  → processScrapeResults(datasetId)
      – upsertar videos inkl. thumbnail_url och caption
      – uppdaterar followers på accounts
```

`daysBack` = 14 för Cron. Valbart i admin-UI.
Webhook fungerar bara i produktion (Vercel).

---

## Veckologik

- `weeks/route.ts` exkluderar **innevarande + föregående vecka** för att säkerställa att data hunnit landa
- Topplistan defaultar alltid till senaste kompletta veckan
- Ingen normalisering på publiceringsålder just nu – accepterad kompromiss

---

## Design

- **Bakgrund:** `#64a4c8` (blå)
- **Fönster/kort:** vit bakgrund, svarta outlines (`#222`)
- **Typsnitt:** Jersey 10 (logotyp), Montserrat (siffror/handles), Inter (brödtext)
- **"Guld"** i logotypen: `#ffb800`
- Retro OS-fönster-tema med box-shadow offset

---

## Webbplats

### Startsida (`/`)
- **Hero-sektion** med topp 3 för senaste veckan (komponent `HeroSection`)
- Veckotopplista i OS-fönster med sortering, filter, URL-parametrar
- Dela-knapp på alla videor (top1–topN) – kopierar text + öppnar LinkedIn
- Tooltips på eng.rate-kolumnen förklarar viktningsformeln
- Innevarande + föregående vecka döljs alltid

### Delningssidor (`/[week]/[rank]`)
- Server-renderade sidor med OG-metadata för LinkedIn-delning
- `og:image` pekar på videons `thumbnail_url`
- URL-format: `/2026-W10/top1`, `/2026-W10/top8` etc.
- Innehåller: logotyp, rank, display_name/@handle, stats, länk till TikTok och topplistan

### Admin (`/admin`)
- Lägg till/ta bort/aktivera/avaktivera konton
- Redigera `display_name` inline (visas istf handle överallt på sajten)
- Inputfält för `daysBack` (default 14) vid manuell scraping
- Ej lösenordsskyddad ännu

---

## Miljövariabler

```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
APIFY_TOKEN=
CRON_SECRET=
NEXT_PUBLIC_SITE_URL=https://guldraketen.vercel.app
```

---

## TODO

### 🚀 Hero-sektion (pågående – behöver redesign)
Nuvarande layout fungerar inte bra visuellt. Behöver:
- Tydlig hierarki där 1:an dominerar
- Konsekvent thumbnail-höjd
- Renare, mer editorial känsla

### Hall of Fame
- Poängsystem: 1:a = 3p, 2:a = 2p, 3:e = 1p per vecka
- Ackumulerat per konto, egen sida `/hall-of-fame`

### Lösenordsskydd på `/admin`
- Supabase Auth

### LinkedIn-delning via admin
- Manuell trigger av LinkedIn-post med veckans topp-video

---

## Projektägare

Rickard · Digital Strategist, IQ-initiativet · GitHub: `borickard/guldraketen`
Deployad: `https://guldraketen.vercel.app`

---

## Viktiga kodreferenser

### displayName(video)
Supabase returnerar joined relations (`accounts`) som en **array**, inte ett objekt. Använd alltid:
```ts
const acct = Array.isArray(video.accounts) ? video.accounts[0] : video.accounts;
const name = acct?.display_name || `@${video.handle}`;
```

### caption i /api/videos/route.ts
Måste explicit inkluderas i `.select()` – den försvinner lätt vid refaktorering.

---

## Senaste ändringar (2026-03-18)

- **Share-sida** (`[week]/[rank]/page.tsx`) är nu en klientkomponent (löste 503-fel vid RSC-refetch)
- Data hämtas via `/api/video?week=X&rank=Y` (ny route)
- URL-format: `/2026-W10/guld`, `/2026-W10/silver`, `/2026-W10/brons`, `/2026-W10/top4` etc.
- Share-sidan har inbäddad TikTok-spelare (klicka play-knapp) + diskret TikTok-länk
- Engagement rate visas med gul bakgrund (#ffb800) på share-sidan
- Hero-korten på startsidan länkar till share-sidan via `window.location.href`
- **Undvik unicode-tecken** (↗ ← → ◆ etc.) i JSX/HTML – de kan få blå renderingsbug i vissa browsers. Använd alltid SVG-ikoner eller Lucide istället.