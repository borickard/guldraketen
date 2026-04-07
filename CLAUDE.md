# Sociala Raketer – CLAUDE.md

## Syfte

Sociala Raketer identifierar och uppmärksammar svenska företag och organisationer som skapar exceptionellt engagerande innehåll på TikTok. Projektet kombinerar automatiserad datainsamling, engagemangsanalys och en webbplats för presentation.

---

## Kärnidé

Sociala Raketer fokuserar på faktiskt publikengagemang – likes, kommentarer, delningar – i relation till räckvidd. Fokus är på svenska företagskonton på TikTok. Engagement rate-formeln: `(likes + comments×5 + shares×10) / views × 100` – delningar väger tyngst eftersom de kräver mest av tittaren.

**Rankinglogik:** Topplistan rankar konton baserat på deras **bästa enskilda video** den veckan (högst engagement_rate). Det är ett medvetet designbeslut: ett konto vinner på sin starkaste prestation, inte på volym. Statistiken som visas i listan (visningar, eng.rate) tillhör just den bästa videon.

---

## Tech Stack

| Del | Teknologi |
|---|---|
| Webbramverk | Next.js (App Router) |
| Hosting | Vercel |
| Databas | Supabase (PostgreSQL + Storage) |
| Scraping | Apify (`clockworks~tiktok-profile-scraper`) |
| Schemalagda jobb | Vercel Cron Jobs |
| Ikoner | lucide-react |

---

## Filstruktur

```
src/
  app/
    page.tsx                          – startsida (hero + topplista + kalkylator + karusell + HoF + om engagemang)
    layout.tsx                        – Google Fonts (Barlow, Barlow Condensed)
    globals.css                       – all CSS (bakgrund #EBE7E2)
    components/
      NavBar.tsx                      – sticky nav som krymper vid scroll; wordmark är <a href="/"> för full reload
    hall-of-fame/
      page.tsx                        – Hall of Fame (flat kortgrid vänster + Konton höger, split grid)
    konto/
      [handle]/
        page.tsx                      – profilsida per konto; visar videos äldre än föregående vecka
    kalkylator/
      page.tsx                        – Engagemangskalkylator (video only, publik)
    kalkylatorn/
      page.tsx                        – Premiumkalkylator (video + profil, ej länkad i nav)
    nominera/
      page.tsx                        – nomineringsformuläret (dold, ej länkad)
    om-engagemang/
      page.tsx                        – förklaring av engagemangsformeln
    admin/
      page.tsx                        – admin-UI
    [week]/
      [rank]/
        page.tsx                      – delningssida /2026-W10/guld etc (ny design: mörk navy, Barlow, sp2-* CSS)
    api/
      accounts/route.ts               – CRUD inkl. display_name, category
      nominate/route.ts
      scrape/route.ts                 – Vercel Cron endpoint
      scrape/trigger/route.ts         – manuell trigger från admin
      scrape/webhook/route.ts         – Apify callback
      videos/route.ts                 – topplista med veckofilter (ISO-veckobaserad) + Cache-Control headers
      video/route.ts                  – enskild video per rank (för share-sidor)
      weeks/route.ts                  – tillgängliga veckor (exkl. nuvarande + föregående) + Cache-Control
      stats/route.ts                  – { video_count, account_count } för hero social proof
      tidigare-raketer/route.ts       – top 3 per vecka, grupperat (Hall of Fame) + Cache-Control
      topplistan/route.ts             – ackumulerade poäng per konto (Hall of Fame) + Cache-Control
      benchmark/route.ts              – percentildata för kalkylatorns jämförelse + Cache-Control
      konto/
        [handle]/route.ts             – profildata + videor per konto (äldre än föregående vecka)
      fetch-video/
        start/route.ts                – DB-lookup med cache-logik + starta Apify-körning, loggar till calculator_tests
        result/route.ts               – poll Apify-resultat, loggar till calculator_tests
      fetch-profile/
        start/route.ts                – starta Apify-profilkörning (premium, används av /kalkylatorn)
        result/route.ts               – poll Apify-profilresultat
      admin/
        contest-videos/route.ts       – GET flaggade videor, PATCH godkänn/återflagga
        backfill-thumbnails/route.ts  – ladda upp TikTok-thumbnails till Supabase Storage
        backfill-avatars/route.ts     – hämta + spara profilbilder för konton
        calculator-tests/route.ts     – GET calculator_tests med sortering
  lib/
    scrape.ts                         – startScrape + processScrapeResults + detectContest + avatar-upload
    thumbnails.ts                     – uploadThumbnail + uploadThumbnailsBatch + uploadAvatar
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
avatar_url           text                        -- Supabase Storage URL: avatars/{handle}.jpg
created_at           timestamptz default now()
```

### `videos`
```sql
id               uuid primary key default gen_random_uuid()
handle           text not null references accounts(handle) on delete cascade
video_url        text not null unique
published_at     timestamptz
views            integer
likes            integer
comments         integer
shares           integer
thumbnail_url    text
caption          text
is_contest       boolean not null default false   -- auto-flaggad via caption-nyckelord
contest_approved boolean not null default false   -- manuellt godkänd i admin trots flagg
engagement_rate  numeric generated always as (
                   case when views > 0
                     then round(((likes + comments * 5 + shares * 10)::numeric / views) * 100, 4)
                   else null end
                 ) stored
last_updated     timestamptz default now()
```

### `scrape_runs`
```sql
id           uuid primary key default gen_random_uuid()
run_id       text                        -- Apify run ID (set after successful start)
triggered_by text not null default 'unknown'  -- 'cron' | 'manual'
days_back    integer
handles      integer                     -- number of active accounts at start
status       text not null default 'started'  -- 'started' | 'completed' | 'failed'
error        text                        -- error message if failed
upserted     integer                     -- videos upserted on completion
skipped      integer
followers    integer                     -- accounts with follower updates
started_at   timestamptz not null default now()
completed_at timestamptz
```
**Create table SQL:**
```sql
create table scrape_runs (
  id           uuid primary key default gen_random_uuid(),
  run_id       text,
  triggered_by text not null default 'unknown',
  days_back    integer,
  handles      integer,
  status       text not null default 'started',
  error        text,
  upserted     integer,
  skipped      integer,
  followers    integer,
  started_at   timestamptz not null default now(),
  completed_at timestamptz
);
```

### `calculator_tests`
```sql
id               uuid primary key default gen_random_uuid()
video_url        text
video_id         text
handle           text
views            integer
likes            integer
comments         integer
shares           integer
engagement_rate  numeric
tested_at        timestamptz default now()
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

### `tidigare-raketer/route.ts`
- Returnerar `[{ week, entries: [{rank, handle, displayName, bestVideo}] }]`
- **Top 3 per vecka**, grupperat på vecka — inte längre bara #1
- Exkluderar innevarande + föregående vecka
- Kräver min 5 konton per vecka för att veckan ska inkluderas

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
      – sätter is_contest=true om caption innehåller tävlingsnyckelord
      – uppdaterar followers på accounts
      – hämtar och sparar avatar_url per konto till Supabase Storage
```

`daysBack` = 14 för Cron — scraper hämtar videor publicerade de senaste 14 dagarna per körning (för Veckans Raket). Valbart i admin-UI.
`RESULTS_PER_PROFILE` = 100 (i `src/lib/scrape.ts`) — max antal videor per konto och körning, skickas som `resultsPerPage` till Apify. Datumsnittet `oldestPostDateUnified` är den primära begränsningen; detta är ett säkerhetstak. Höj vid behov om konton postar extremt frekvent.
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
- **Mörk:** `#1C1B19` (nästan svart — används för #1-raden, nav, footer)
- **Guld:** `#C8962A`
- **Silver:** `#8A9299`
- **Brons:** `#96614A`
- **Kort:** `#E2DDD7` (något mörkare än bakgrund)

### Typsnitt
- **Barlow Condensed** — rubriker, hero H1, wordmark, vecko-labels (`--gr-syne`)
- **Barlow** — all övrig text: statistik, etiketter, brödtext (`--gr-mono`, `--gr-sans`)

### Designprinciper
- Rankingshierarki kommuniceras via **typografisk skala**, inte grid-linjer
- **#1-raden** inverteras till mörk bakgrund för visuell tyngd
- **Videokort** med 18px radius, 1.5px border — konsekvent rounding
- **Ticker** med scrollande text i mörk bakgrund
- Footer: mörk bakgrund (TODO: personlig text om Rickard + kontakt)
- Nav: sticky, krymper från `padding: 18px` till `9px` och logga från 20px till 15px efter 60px scroll

### Topplistan
- Rankar på **bästa enskilda videons** engagement_rate
- Minimum 10 000 visningar på bästa videon för att räknas
- Visar **top 3** på startsidan (3-kolumns grid desktop, 1-kolumn mobil)
- Kort: flip-animation — framsida (thumbnail + mint info-strip), baksida (statistik + knappar)
  - Framsida: thumbnail överst (object-position: top), mint strip (#EDF8FB) med rank+handle på samma rad, ER och label nedan
  - Baksida: rankfärg "01" + ER på samma rad, divider, 2×2 metrics-grid, följarantal, "Visa videon" (magenta) + "Visa profil" (ghost) på samma rad
  - rankColor: guld/silver/brons för topp 3, mörk (#07253A) för rank 4+
  - Inget share-ikon på baksidan (borttaget)
- Veckoväljare: höger i header-raden med ←/→ pilar för att bläddra en vecka i taget
- `dataFreshnessLabel` visas på egen rad under sektionsrubriken (beräknas från `max(last_updated)`)
- Trend (↑/↓) och NY-badge borttagna från korten

---

## Webbplats

### Startsida (`/`)
Strukturen uppifrån och ned:
1. **NavBar** — sticky, krymper vid scroll
2. **Hero** — stor H1, manifest, URL-input-form → `/kalkylator?v={id}&h={handle}`, social proof (avatarer + räknare), scroll-CTA
3. **Topplista** — id="topplistan", veckoväljare, freshness-label, expanderbara rader med videokort; top 3 flip-kort
4. **Inbyggd kalkylator** — video-URL-input direkt på startsidan
5. **Strip-karusell** — 185px hög rad med TikTok-thumbnails, scrollar automatiskt, tonas ut i kanterna
6. **Hall of Fame-preview** — inlinelista med top 10 konton + poäng, länk till `/hall-of-fame`
7. **Om engagemang** — tre förklaringskort
8. **FAB** — fixed bottom-right, kalkylator-länk, expanderar till pill på hover (desktop)
9. **Footer** — personlig tagline + LinkedIn-länk

### Kalkylator (`/kalkylator`)
- **Video only** — accepterar enbart TikTok-videolänkar, inte profiler
- URL-param `?v={videoId}&h={handle}` — delas med andra, videon laddas och statistik hämtas direkt
- Auto-fetch triggas en gång vid mount om `?v=` finns i URL
- Thumbnail hämtas via TikTok oEmbed; klick öppnar lightbox med iframe-embed
- Kollar DB först: om videon scrapades inom 48 timmar används cachat resultat → visar cachad-not med datum
- Vid cache-träff loggas `source: "db"` till `calculator_tests`; annars `source: "apify"`
- Annars startar Apify-körning, pollar var 3:e sekund i upp till 120s
- Varje hämtning loggas till `calculator_tests`-tabellen
- Benchmark-visualisering: percentilutrop + progress bar, baseras på användarens valda vikter
- Anpassningsbara vikter (±-knappar, 0–20), formelförhandsvisning, återställningsknapp
- Apify 403 hard limit → visar användarvänligt felmeddelande

> **VIKTIGT:** Kalkylatorn på startsidan (`page.tsx`, `startCalcFetch`) och `/kalkylator` (`kalkylator/page.tsx`) ska alltid vara **funktionellt identiska**. Vid ändringar i logik, cache-hantering, felmeddelanden eller UI-beteende — uppdatera alltid båda.

### Premiumkalkylator (`/kalkylatorn`)
- **Video + profil** — samma som `/kalkylator` men accepterar även TikTok-profilsidor och @handle
- Inte länkad i nav eller från startsidan — delas direkt med utvalda användare
- Profilanalys kör `clockworks~tiktok-profile-scraper`, pollar var 5:e sekund i upp till 5 min

### Hall of Fame (`/hall-of-fame`)
- Ljus bakgrund (`gr-hof-page`, #EBE7E2) — matchar startsidans stil
- Split-grid layout (`gr-content-grid`): Raketer vänster (2fr), Konton höger (1fr), 40px gap
- **Raketer**: flat kortgrid (inte grupperat per vecka)
  - 3 kolumner desktop, 2 kolumner mobil (breakpoint 600px, matchar CSS exakt via `window.innerWidth`)
  - Visar 3 rader initialt; "Visa fler"-knapp lägger till 3 rader åt gången
  - Filler-divs (`gr-hof-filler`) fyller upp sista raden — aldrig ett ensamt kort
  - Sorteringsalternativ: Nyaste, Äldsta, Eng.rate, Visningar, Likes, Kommentarer, Delningar
  - Varje kort visar veckolabel (t.ex. "V12 2026") under ER
  - Sektionsrubrik "Raketer" + sorterpills är sticky (top: 34px)
- **Konton**: sticky poängtabell (top 10)
  - Medaljer som SVG-färgprickar (`MedalDot`)
  - Poäng: 1:a=15p, 2:a=10p, 3:e=5p
  - Länkikon (`gr-score-profile-btn`) bredvid varje kontonamn → `/konto/[handle]`
- Data från `/api/tidigare-raketer` (Raketer) och `/api/topplistan` (Konton)
- Exkluderar innevarande + föregående vecka (kräver min 5 konton per vecka)

### Konto (`/konto/[handle]`)
- Ljus bakgrund (`gr-konto-page`, bakgrund: `var(--gr-bg)`)
- Visar profilinfo (avatar, display_name, följare) + videogrid
- Videor filtreras: endast videor äldre än måndag i föregående ISO-vecka
- Data från `/api/konto/[handle]`

### Delningssidor (`/[week]/[rank]`)
- URL-format: `/2026-W10/guld`, `/2026-W10/silver`, `/2026-W10/brons`, `/2026-W10/top4` etc.
- Server-renderade med OG-metadata för LinkedIn-delning
- Ny design (2026-04): mörk navy bakgrund, Barlow-typsnitt, `sp2-*` CSS-klasser
- Grid-layout: 280px thumbnail-kolumn + 1fr info-kolumn (mobil: single column ≤680px)
- Rankfärg på ER-värdet, "Kopiera länk"-knapp med kopierad-feedback, prev/next rank-navigation
- Kontonamn länkas till `/konto/[handle]`

### OG-bild för delningssidor (`/api/og`)
- Genereras via `next/og` (ImageResponse) och cachas av CDN
- Parametrar: `?week=2026-W10&rank=1`
- Data hämtas via `lib/getVideoForRank.ts` (delad med `[week]/[rank]/page.tsx`)
- **Nuvarande implementation (2026-04-06):** Full-bleed thumbnail (1200×630, objectFit cover, objectPosition top center) med gradient-overlay längst ned (transparent → navy rgba 0.92, 220px höjd). Rank-label, vecka, kontonamn och ER-värde visas i overlaytext (bottom 44px, left 52px).
- Fallback utan thumbnail: solid navy bakgrund med samma overlay-text

**⚠️ Känd issue — OG-bildtext behöver justeras:**
LinkedIn-förhandsgranskning visar OG-bilden i ~300px bredd, vilket gör texten i overlay svårläst. Nästa steg:
- Öka fontstorlekar i overlay-texten (rankLabel, ER-värde) markant
- Eventuellt förenkla overlayinnehållet: bara rankLabel + ER, inte kontonamn + vecka
- Alternativ övervägd men pausad: generera bilden från sidan med html2canvas/puppeteer (komplex setup på Vercel Edge)

### Admin (`/admin`)
- Lägg till/ta bort/aktivera/avaktivera konton
- Redigera `display_name` och `category` inline
- Manuell scraping med valbart `daysBack`
- Tävlingsgranskare: lista flaggade videor, godkänn felaktigt flaggade
- Kalkylator-tester: sorterbar tabell över `calculator_tests`
- "Hämta avatarer"-knapp: kör `/api/admin/backfill-avatars` för att hämta profilbilder

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

### FAQ-sektion på startsidan
Ersätt den sista sektionen på startsidan ("Om engagemang" — tre förklaringskort) med en FAQ med expanderbara dropdown-rader (accordion). Frågorna:
- "Vad räknas som engagemang?"
- "Hur räknas engagement rate ut?"
- "Vilka typer av konton mäts av Sociala Raketer?"
- "Vem ligger bakom Sociala Raketer?"
- "Jag vill att mitt content ska mätas här"
- (Eventuellt fler efter behov)

Implementation: klient-komponent med `useState` per rad eller en gemensam `openIndex`-state. Styling ska matcha övrig startsida (bakgrund `#EBE7E2`, mörk text, `--gr-dark`). Varje rad: fråga som klickbar rubrik + chevron-ikon som roterar vid öppning, svar som expanderbar text nedanför.

---

### Snabba fixes
- **Mobil nav** — hamburgarmenyns länkar saknar funktion, behöver wiras upp
- **Skeleton loading** — ersätt "Laddar..."-texten i listan med skeleton-rader i rätt höjd
- **OG-bildtext** — overlay-texten i `/api/og` är för liten vid LinkedIn-förhandsvisning; öka fontstorlekar (rankLabel, ER) och förenkla innehållet (ev. bara rankLabel + ER, ta bort kontonamn + vecka)

### Delning från listan
- Share-ikoner på expanderade videokort → `/[week]/[rank]`-URL:er

### Kategorier på konton
- `category`-kolumnen finns i schemat men används inte i UI
- Admin-UI behöver inmatningsfält
- Visas i meta-raden i topplistan (t.ex. "Mat & dryck · Bästa inlägg")

### Scraping — felhantering och notifieringar
- Om en schemalagd scrape misslyckas behöver Rickard notifieras via e-post
- Förslag på retry-logik: kör om efter 1h, sedan 12h, sedan 24h
- Vercel Cron kan inte hantera retries nativt — lagra scrape-status i Supabase + separat check-cron

### Admin-redesign
- Gör om admin-sidan med tydliga sektioner och flikar
- Huvudfunktioner i fokus; flytta debug-knappar (backfill thumbnails, avatarer etc.) till ett separat "Verktyg"-flöde
- Lösenordsskydd med sparad inloggning i localStorage — användaren ska inte behöva logga in igen vid återbesök
- Bredare layout, bättre visuell hierarki

### Användarinloggning & dashboard (premium)
- Användare hanteras av Rickard i admin (ingen självregistrering)
- Inloggad vy: dashboard med användarens senaste TikTok-innehåll, filterbart
- Insikter: vecko-/månadsvis ER-benchmark, toppinnehåll, trender
- Anpassningsbara vikter för ER-formeln som sparas per användare och är aktiva tills de ändras
- Betalning/prenumeration: undersök lösning för svenska marknaden
  - Alternativ att utvärdera: Stripe (global, bra Next.js-integration), Billogram (svensk faktura), Swish (engångsbetalning), Paddle (VAT-hantering ingår)
  - Stripe Checkout med månads-/årsplan är troligen enklast att integrera med Supabase Auth + Row Level Security

### LinkedIn-delning via admin
- Manuell trigger av LinkedIn-post med veckans topp-video

### Permanent vinnarhistorik (weekly snapshots)
Ranking beräknas live vid varje request — inga snapshots finns. Risk: om någon delar `/2026-W10/guld` på LinkedIn och vi sedan retroaktivt ändrar data, kan länken visa en annan vinnare.

**Varför cron-jobbet inte är huvudrisken:** `daysBack=14` innebär att W-2 (den senast synliga veckan) uppdateras av cron-körningen *samma måndag morgon* som den first blir synlig. Nästa måndag når inte W-2 längre (den är då >14 dagar gammal). Alltså stabiliseras rankingen naturligt efter den första cron-körningen.

**Faktiska riskscenarier (admin-åtgärder):**
- Manuellt godkänna/avslå tävlingsflagga på en äldre video
- Backfill-scrape med större `daysBack` som lägger till nya videor i en gammal vecka
- Nytt konto läggs till + backfill som täcker tidigare veckor

**Föreslagen implementation:**
- Ny tabell `weekly_snapshots (week text, rank int, handle text, video_url text, views int, likes int, comments int, shares int, engagement_rate numeric, locked_at timestamptz, PRIMARY KEY (week, rank))`
- Auto-lock: steg i `processScrapeResults()` — efter upsert, snapshotar veckor som är äldre än 14 dagar
- Admin UI: visa låsta vs. live-rankingar, knapp för manuell lås/upplås
- Berörda filer: `src/lib/scrape.ts`, `src/app/api/video/route.ts`, `src/app/api/tidigare-raketer/route.ts`, ny admin-endpoint
- Hall of Fame bör också läsa från snapshots för konsekvens

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
All `.gr-`-CSS ligger i `globals.css`. CSS custom properties (`--gr-bg`, `--gr-dark`, `--gr-gold` etc.) definieras i `:root`. Dynamisk styling (per-rad-färger, isDark, rankColor) sitter kvar som inline styles i `page.tsx` eftersom de beror på runtime-state.
- `/* HERO & LANDING */` — hero, strip-karusell, info-grid, FAB
- `/* ── Hall of Fame ── */` — HoF-specifika klasser inkl. `.gr-hof-flat-grid`, `.gr-hof-filler`, `.gr-hof-load-more`
- `/* sp2-* */` — delningssidans layout och komponenter

**Viktigt — `--gr-line` är genomskinlig:** `--gr-line: rgba(237,248,251,0.07)` är designad för mörk bakgrund. Använd **inte** `var(--gr-line)` för borders på ljusa sidor — använd `rgba(28,27,25,0.1)` istället.

**Ljusa sidor** (konto, hall-of-fame) använder egna wrapper-klasser (`gr-konto-page`, `gr-hof-page`) med `background: #EBE7E2` — inte `gr-root` som har mörk navy-bakgrund.

### Delad kolumnlayout (`gr-content-grid`)
Används av Hall of Fame:
- Mobil: 1 kolumn
- Desktop (≥840px): `2fr 1fr`, gap `40px`
- `.gr-content-main` — vänster/bred kolumn; måste ha `min-width: 0; overflow: hidden` för att förhindra att kortgridar spiller över i höger kolumn och blockerar klick
- `.gr-content-aside` — höger/smal kolumn; `border-left` och `padding: 32px 24px` som default

### Sticky i CSS Grid
För att `position: sticky` ska fungera på ett grid-item måste det ha `align-self: start`. Det räcker inte med `align-items: start` på containern.

### Backtick-problem i route.ts
`.select()` i Supabase-queries ska använda en vanlig strängvariabel, inte template literals.

### HoF kolumndetektering
`window.innerWidth <= 600 ? 2 : 3` — matchar exakt CSS-breakpointen för `.gr-hof-flat-grid`. Använd **inte** `getComputedStyle(el).gridTemplateColumns` — browsers returnerar ibland template-strängen ("repeat(2, 1fr)") istället för de beräknade värdena.

---

## Senaste ändringar (2026-04-06)

- **OG-bild** — `/api/og` implementerad; full-bleed thumbnail 1200×630 med gradient-overlay och rank/ER-text. OG-taggar på delningssidor (`[week]/[rank]/page.tsx`) pekar på denna route. **⚠️ Känd issue:** texten i overlaybilden är för liten vid LinkedIn-förhandsvisning (~300px bredd) — behöver justeras.
- **Benchmark-labels** — fixade felaktiga etiketter i kalkylatorns percentilvisning

### Äldre ändringar (2026-04-04)

- **Hall of Fame redesign** — ljus bakgrund (gr-hof-page), flat kortgrid utan veckogrupperingar, 7 sorteringsalternativ, 3 rader initialt + "Visa fler" (3 rader åt gången), filler-divs mot ensamma kort
- **Konto-sidor** — `/konto/[handle]` lanserad; visar videor äldre än föregående ISO-vecka
- **HoF profilknappar** — liten länkikon bredvid kontonamn i Konton-tabellen + HoF-preview på startsidan
- **Delningssidor** — ny design: mörk navy, Barlow, sp2-* CSS; rank-nav, kopiera-länk-knapp
- **Kortbaksida** — rank "01" + ER på samma rad; "Visa videon" (magenta) + "Visa profil" (ghost) sida vid sida; share-ikonen borttagen
- **Startsidestruktur** — ny ordning: Hero → Topplista → Kalkylator → Karusell → HoF → Om engagemang
- **Freshness-label** — "Uppdaterad X dagar sedan" på egen rad under sektionsrubriken
- **Cache-Control headers** — lagts till på weeks, videos, topplistan, tidigare-raketer, benchmark
- **CSS-rensning** — ~1 500 rader dead CSS borttaget; globals.css 5 848 → ~4 400 rader
- **NavBar wordmark** — `<a href="/">` (inte Link) för full page reload

### Äldre ändringar (2026-03-31)
- **Kortdesign** — hard split layout (thumbnail + mint strip #EDF8FB), rank+handle inline, ER som hero på baksidan
- **Typsnitt** — konsoliderat till Barlow + Barlow Condensed
- **Veckans raketer** — top 3, 1-kolumn mobil, 3 kolumner desktop
- **Strip-karusell** — 6 repetitioner + keyframe -16.67%
- **Veckoväljare** — ←/→ pil-navigation i header-raden
- **`/kalkylatorn`** — premiumsida med profil- och videoanalys
- **Cache-logik** — kalkylatorn cachar resultat i 48 timmar (kollar `videos`-tabellen och `calculator_tests`)
- **Footer** — personlig tagline med LinkedIn-länk

### Äldre ändringar (2026-03-26)
- **Ny startsida** — hero med URL-input + manifest, strip-karusell, promo-grid, info-kolumner, FAB
- **Kalkylator auto-fetch** — `?v={id}&h={handle}` triggar automatisk statistikhämtning
- **Avatarer** — `avatar_url` i accounts; visas i hero social proof
- **Hall of Fame** — `/hall-of-fame` lanserad; top 3 per vecka i kortformat, sticky rubriker, top 10 konton
- **NavBar sticky** — krymper vid scroll
- **Thumbnails** — Supabase Storage bucket "thumbnails"
