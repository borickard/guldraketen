# Guldraketen – CLAUDE.md

## Syfte

Guldraketen identifierar och uppmärksammar svenska företag och organisationer som skapar exceptionellt engagerande innehåll på TikTok. Projektet kombinerar automatiserad datainsamling, engagemangsanalys och en webbplats för presentation.

---

## Kärnidé

Guldraketen fokuserar på faktiskt publikengagemang – likes, kommentarer, delningar – i relation till räckvidd. Fokus är på svenska företagskonton på TikTok. Engagement rate-formeln: `(likes + comments×5 + shares×10) / views × 100` – delningar väger tyngst eftersom de kräver mest av tittaren.

**Rankinglogik:** Topplistan rankar konton baserat på deras **bästa enskilda video** den veckan (högst engagement_rate). Det är ett medvetet designbeslut: ett konto vinner på sin starkaste prestation, inte på volym. Statistiken som visas i listan (visningar, eng.rate) tillhör just den bästa videon.

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
    page.tsx                          – startsida (topplista, ny design)
    layout.tsx                        – Google Fonts (Syne 400/700/800, DM Mono, DM Sans)
    globals.css                       – all CSS (bakgrund #EBE7E2, gammal blå borttagen)
    nominera/
      page.tsx                        – nomineringsformuläret
    admin/
      page.tsx                        – admin-UI
    [week]/
      [rank]/
        page.tsx                      – delningssida /2026-W10/guld etc
    api/
      accounts/route.ts               – CRUD inkl. display_name, category
      nominate/route.ts
      scrape/route.ts                 – Vercel Cron endpoint
      scrape/trigger/route.ts         – manuell trigger från admin
      scrape/webhook/route.ts         – Apify callback
      videos/route.ts                 – topplista med veckofilter (ISO-veckobaserad)
      video/route.ts                  – enskild video per rank (för share-sidor)
      weeks/route.ts                  – tillgängliga veckor (exkl. nuvarande + föregående)
      top3/route.ts                   – topp 3 för en vecka (legacy, används av gamla hero)
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
category             text                        -- branschkategori, t.ex. "Mat & dryck"
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

## API-routes — viktig distinktion

### `videos/route.ts` (plural)
- Används av `page.tsx` (topplistan)
- Parameter: `?week=2026-W10`
- Returnerar **alla** videos inom den ISO-veckan som array
- Inget views-filter
- Limit: 200

### `video/route.ts` (singular)
- Används av share-sidorna `[week]/[rank]/page.tsx`
- Parametrar: `?week=2026-W10&rank=1`
- Returnerar **ett enskilt** video-objekt för given rank
- Behåller `.gte("views", 5000)` för att ge rimliga share-sidor
- Returnerar `data[rank - 1]`

**Kritisk skillnad:** Den gamla `videos/route.ts` använde en rullande 14-dagars cutoff och ignorerade `week`-parametern. Nu använder båda routes `weekBounds()`-funktionen för ISO-veckobaserad filtrering.

### `weekBounds(weekStr)` — delad logik
Finns i både `video/route.ts` och `videos/route.ts`. Beräknar exakt start (måndag 00:00 UTC) och slut (söndag 23:59 UTC) för en ISO-vecka.

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
- ISO-veckor börjar på måndag — `weekBounds()` hanterar detta korrekt med UTC

---

## Design

### Färgpalett
- **Bakgrund:** `#EBE7E2` (varm sandbeige)
- **Mörk:** `#1C1B19` (nästan svart — används för #1-raden och footer)
- **Guld:** `#C8962A`
- **Silver:** `#8A9299`
- **Brons:** `#96614A`
- **Kort:** `#E2DDD7` (något mörkare än bakgrund)

### Typsnitt
- **Syne 800** — rankingssiffror, rubriker, wordmark
- **DM Mono** — statistik, etiketter, meta-info
- **DM Sans** — brödtext, video-captions

### Designprinciper
- Rankingshierarki kommuniceras via **typografisk skala**, inte grid-linjer
- **#1-raden** inverteras till mörk bakgrund för visuell tyngd
- **Videokort** med 18px radius, 1.5px border — konsekvent rounding
- **Ticker** med scrollande text i mörk bakgrund
- **Wordmark** fyller tillgänglig bredd via JavaScript resize-observer
- Footer: mörk bakgrund, stor Syne 800-text

### Topplistan
- Rankar på **bästa enskilda videons** engagement_rate
- Minimum 10 000 visningar på bästa videon för att räknas
- Statistik i kollapsad rad = bästa videons views + eng.rate
- Metaraden i kollapsad rad säger "Bästa inlägg" + trend/NY-badge
- Klickar man på en rad expanderar den med:
  - Sammandragsrad: antal inlägg, totala visningar, snitt eng.rate
  - Horisontell scroll-rad med videokort
  - Bästa videokortet highlightas med guldborder + "Bäst"-badge
- Trend (↑/↓) jämförs mot föregående veckas ranking

### Räckviddsfilter (sliding pill)
- Lägen: **Av** (default), **Låg** (under 100K), **Hög** (100K+)
- Filtrar på bästa videons visningar
- Pill-komponenten `ReachPill` använder `useLayoutEffect` + `getBoundingClientRect()` för att animera en highlight-ruta organiskt mellan knapparna
- Aktivt filter visas som ett chip med kryss-knapp — kan stängas av via chipet eller genom att klicka på aktiv knapp igen
- Label "FILTER" (Syne 800 13px) + sublabel "VISNINGAR" (DM Mono 8px) ovanför pillen

---

## Webbplats

### Startsida (`/`)
- Nav: wordmark (Syne 800, fyller bredden via JS resize-loop), hamburgarmeny utan funktion (3 streck, kortast underst)
- **G** i GULDRAKETEN är guld (`#C8962A`), resten mörk
- Ticker: mörk bakgrund med scrollande redaktionell text (se nedan)
- Räckviddsfilter med sliding pill ovanför listan
- Topplista med expanderbara rader och videokort
- Vecko-dropdown i höger kant av list-headern
- Footer: "VAD ÄR ENGAGEMANG?" + förklaringstext + signaturen Guldraketen · 2026

### Delningssidor (`/[week]/[rank]`)
- URL-format: `/2026-W10/guld`, `/2026-W10/silver`, `/2026-W10/brons`, `/2026-W10/top4` etc.
- Server-renderade med OG-metadata för LinkedIn-delning
- Inbäddad TikTok-spelare

### Ticker-text
> Vem nådde fram i bruset den här veckan? · Guldraketen · Varje måndag · Likes räknas · Kommentarer väger mer · Delningar väger tyngst · Det är vår måttstock · Sveriges mest engagerande TikTok-konton · [vecka]

### Footer-filosofi
Rubrik: **VAD ÄR ENGAGEMANG?**

Brödtext:
> Likes i all ära. Men när någon kommenterar har de stannat upp — något väckte en reaktion. Och när de delar? Då har du nått fram genom bruset, rört något, och fått dem att säga: *"det här måste du se."* Det är vår definition av engagemang.

### Admin (`/admin`)
- Lägg till/ta bort/aktivera/avaktivera konton
- Redigera `display_name` och `category` inline
- Manuell scraping med valbart `daysBack`

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

### Hall of Fame
- Poängsystem: 1:a = 3p, 2:a = 2p, 3:e = 1p per vecka
- Ackumulerat per konto, egen sida `/hall-of-fame`
- Vid årets slut utses vinnare baserat på ackumulerade poäng

### Kategorier på konton
- Kolumn `category` behöver läggas till i Supabase `accounts`-tabellen
- Admin-UI behöver ett inmatningsfält för kategorin
- Visas i meta-raden i topplistan (t.ex. "Mat & dryck · Bästa inlägg")

### Lösenordsskydd på `/admin`
- Supabase Auth

### LinkedIn-delning via admin
- Manuell trigger av LinkedIn-post med veckans topp-video

---

## Projektägare

Rickard · Digital Strategist · GitHub: `borickard/guldraketen`
Deployad: `https://guldraketen.vercel.app`

---

## Viktiga kodreferenser

### displayName(video)
Supabase returnerar joined relations (`accounts`) som en **array**, inte ett objekt. Använd alltid:
```ts
const acct = Array.isArray(video.accounts) ? video.accounts[0] : video.accounts;
const name = acct?.display_name || `@${video.handle}`;
```

### groupByAccount() i page.tsx
Grupperar videos per konto, rankar på `max(engagement_rate)`, returnerar `bestVideo` och `bestEngagement` per AccountRow. Trendpilar beräknas genom att jämföra rank mot föregående vecka.

### Undvik unicode-tecken i JSX
Tecken som ↗ ← → ◆ kan ge blå renderingsbug i vissa browsers. Använd alltid SVG-ikoner eller Lucide istället.

### CSS-arkitektur
All `.gr-`-CSS (ticker, entries, videokort, pill, mobilregler) ligger i `globals.css` under rubriken "GULDRAKETEN — ny design". CSS custom properties (`--gr-bg`, `--gr-dark`, `--gr-gold` etc.) definieras i `:root`. Dynamisk styling (per-rad-färger, isDark, rankColor) sitter kvar som inline styles i `page.tsx` eftersom de beror på runtime-state.

### Backtick-problem i route.ts
`.select()` i Supabase-queries ska använda en vanlig strängvariabel, inte template literals:
```ts
const fields = "id, handle, video_url, ...";
const { data } = await supabaseAdmin.from("videos").select(fields)...
```

---

## Senaste ändringar (2026-03-18)

- **Ny design på startsidan** — editorial estetik: sandbeige bakgrund, Syne 800, DM Mono, mörk #1-rad, ticker, footer
- **Rankinglogik** — bästa enskilda videons eng.rate, min 10K visningar krävs
- **videos/route.ts** — ISO-veckobaserad filtrering via `weekBounds()`, inget views-filter, limit 200
- **video/route.ts** — samma `weekBounds()`-logik, views ≥ 5000, används av share-sidor
- **Videokort** — expanderbara rader, bästa video highlightas, sammandragsrad i panel
- **Räckviddsfilter** — sliding pill (Låg <100K / Hög ≥100K, av som default), chip med kryss
- **Eng.rate-spann** — höger i listan visas `0.56–2.43%` (min–max alla videons); 1 inlägg = exakt procent
- **Wordmark** — fyller bredden via JS resize-loop (max 48px), G:et är guld (#C8962A)
- **Hamburgarmeny** — ersätter nav-länkarna, ingen funktion ännu
- **Rank-siffror** — responsiva med `clamp()`, krymper organiskt på mobil
- **Ticker** — redaktionell engagemangsfilosofi
- **Footer** — "VAD ÄR ENGAGEMANG?" med förklaringstext om delningsfilosofin
- **CSS** — all `.gr-`-CSS utlyft från page.tsx till globals.css med CSS custom properties (`--gr-*`)
- **globals.css** — Syne/DM Mono/DM Sans importeras, gamla klasser bevarade för admin/share-sidor
- **TypeScript-fix** — `navLinksRef` typad som `HTMLButtonElement`