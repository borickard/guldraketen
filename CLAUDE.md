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
    page.tsx                          – startsida (hero + strip-karusell + promo + topplista)
    layout.tsx                        – Google Fonts (Barlow, Barlow Condensed)
    globals.css                       – all CSS (bakgrund #EBE7E2)
    components/
      NavBar.tsx                      – sticky nav som krymper vid scroll
    hall-of-fame/
      page.tsx                        – Hall of Fame (Raketer vänster + Konton höger, split grid)
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
      stats/route.ts                  – { video_count, account_count } för hero social proof
      tidigare-raketer/route.ts       – top 3 per vecka, grupperat (Hall of Fame)
      topplistan/route.ts             – ackumulerade poäng per konto (Hall of Fame)
      benchmark/route.ts              – percentildata för kalkylatorns jämförelse
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
- Kort: flip-animation — framsida (thumbnail + mint info-strip), baksida (statistik + "Visa videon")
  - Framsida: thumbnail överst (object-position: top), mint strip (#EDF8FB) med rank+handle på samma rad, ER och label nedan
  - Baksida: ER som hero-stat överst, divider, 2×2 metrics-grid, följarantal, "Visa videon"-knapp
  - rankColor: guld/silver/brons för topp 3, mörk (#07253A) för rank 4+
- Veckoväljare: höger i header-raden med ←/→ pilar för att bläddra en vecka i taget
- Trend (↑/↓) och NY-badge borttagna från korten

---

## Webbplats

### Startsida (`/`)
Strukturen uppifrån och ned:
1. **NavBar** — sticky, krymper vid scroll (se ovan)
2. **Strip-karusell** — 185px hög rad med TikTok-thumbnails, scrollar automatiskt, tonas ut i kanterna. Fast höjd även före laddning.
3. **Hero** — stor H1, manifest (2 rader Space Mono + brödtext), URL-input-form som skickar till `/kalkylator?v={id}&h={handle}`, social proof (avatarer + räknare), scroll-CTA
4. **Promo-grid** — två kolumner: "Veckans bästa på TikTok" (mörk, top 3) + "Bäst engagemang över tid" (ljus, Hall of Fame top 3)
5. **Info-kolumner** — tre kort: Hur räknar vi / Veckans topplista / Testa ditt innehåll
6. **Topplista** — id="topplistan", veckoväljare, expanderbara rader med videokort
7. **FAB** — fixed bottom-right, kalkylator-länk, expanderar till pill på hover (desktop)
8. **Footer** — TODO: personlig text

### Kalkylator (`/kalkylator`)
- **Video only** — accepterar enbart TikTok-videolänkar, inte profiler
- URL-param `?v={videoId}&h={handle}` — delas med andra, videon laddas och statistik hämtas direkt
- Auto-fetch triggas en gång vid mount om `?v=` finns i URL
- Thumbnail hämtas via TikTok oEmbed; klick öppnar lightbox med iframe-embed
- Kollar DB först med cache-logik: använd cachat om videon var ≥14 dagar gammal vid scrape OCH scrapad inom 7 dagar
- Annars startar Apify-körning, pollar var 3:e sekund i upp till 120s
- Varje hämtning loggas till `calculator_tests`-tabellen
- Benchmark-visualisering: percentilutrop + progress bar, baseras på användarens valda vikter
- Anpassningsbara vikter (±-knappar, 0–20), formelförhandsvisning, återställningsknapp
- Apify 403 hard limit → visar användarvänligt felmeddelande

### Premiumkalkylator (`/kalkylatorn`)
- **Video + profil** — samma som `/kalkylator` men accepterar även TikTok-profilsidor och @handle
- Inte länkad i nav eller från startsidan — delas direkt med utvalda användare
- Profilanalys kör `clockworks~tiktok-profile-scraper`, pollar var 5:e sekund i upp till 5 min

### Hall of Fame (`/hall-of-fame`)
- Split-grid layout (`gr-content-grid`): Raketer vänster (2fr), Konton höger (1fr), 40px gap
- **Raketer**: veckogrupper med mörk rubrikrad (veckonamn) + 3 videokort i en rad
  - Korten återanvänder `.gr-vc`/`.gr-thumb` från topplistan, med `aspect-ratio: 9/16`
  - Rank-badge (#1/#2/#3) i guld/silver/brons-färg överst på kortet
  - Sektionsrubrik "Raketer" + sorterpills är sticky (top: 34px)
  - Veckokorten omsluts av `.gr-hof-weeks-wrap` med `padding: 24px` för korrekt marginaler
- **Konton**: sticky poängtabell (top 10), sticky (top: 34px, align-self: start)
  - Medaljer som SVG-färgprickar (`MedalDot`)
  - Poäng: 1:a=15p, 2:a=10p, 3:e=5p
- Data från `/api/tidigare-raketer` (Raketer) och `/api/topplistan` (Konton)
- Exkluderar innevarande + föregående vecka (kräver min 5 konton per vecka)

### Delningssidor (`/[week]/[rank]`)
- URL-format: `/2026-W10/guld`, `/2026-W10/silver`, `/2026-W10/brons`, `/2026-W10/top4` etc.
- Server-renderade med OG-metadata för LinkedIn-delning
- Inbäddad TikTok-spelare

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

### Snabba fixes
- **Mobil nav** — hamburgarmenyns länkar saknar funktion, behöver wiras upp
- **Skeleton loading** — ersätt "Laddar..."-texten i listan med skeleton-rader i rätt höjd

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
All `.gr-`-CSS ligger i `globals.css`. CSS custom properties (`--gr-bg`, `--gr-dark`, `--gr-gold` etc.) definieras i `:root`. Dynamisk styling (per-rad-färger, isDark, rankColor) sitter kvar som inline styles i `page.tsx` eftersom de beror på runtime-state.
- `/* HERO & LANDING */` — hero, strip-karusell, promo-grid, info-grid, FAB
- `/* ── Hall of Fame ── */` — HoF-specifika klasser inkl. `.gr-hof-weeks-wrap`, `.gr-hof-card-row`

### Delad kolumnlayout (`gr-content-grid`)
Används av Hall of Fame:
- Mobil: 1 kolumn
- Desktop (≥840px): `2fr 1fr`, gap `40px`
- `.gr-content-main` — vänster/bred kolumn
- `.gr-content-aside` — höger/smal kolumn; `border-left` och `padding: 32px 24px` som default

### Sticky i CSS Grid
För att `position: sticky` ska fungera på ett grid-item måste det ha `align-self: start`. Det räcker inte med `align-items: start` på containern.

### Backtick-problem i route.ts
`.select()` i Supabase-queries ska använda en vanlig strängvariabel, inte template literals.

---

## Senaste ändringar (2026-03-31)

- **Kortdesign** — hard split layout (thumbnail + mint strip #EDF8FB), rank+handle inline, ER som hero på baksidan, följarantal på baksidan, `object-position: top` på thumbnails
- **Typsnitt** — konsoliderat till Barlow + Barlow Condensed (DM Mono, DM Sans, Space Mono borttagna)
- **Veckans raketer** — visar top 3, 1-kolumn på mobil, 3 kolumner desktop
- **Strip-karusell** — 6 repetitioner + keyframe -16.67% för att täcka extra breda skärmar
- **Veckoväljare** — flyttad till höger i headern med ←/→ pil-navigation
- **`/kalkylatorn`** — ny premiumsida med profil- och videoanalys (ej länkad i nav)
- **`/kalkylator`** — renodlad till video only; startsideformuläret detsamma
- **Cache-logik** — skip re-scrape om videon var ≥14 dagar vid scrape OCH scrapad senaste 7 dagarna
- **Apify-felmeddelande** — 403 hard limit visas som användarvänlig text
- **Footer** — personlig tagline med LinkedIn-länk till Rickard Berggren
- **Nav-ordning** — Kalkylator före Hall of Fame; Hall of Fame-ankarlänk fixad (`id="hall-of-fame"`)

### Äldre ändringar (2026-03-26)
- **Ny startsida** — hero med URL-input + manifest, strip-karusell, promo-grid, info-kolumner, FAB
- **Kalkylator auto-fetch** — `?v={id}&h={handle}` triggar automatisk statistikhämtning vid sidladdning
- **Avatarer** — `avatar_url` i accounts; visas i hero social proof
- **Hall of Fame redesign** — top 3 per vecka i kortformat, sticky rubriker, top 10 konton
- **NavBar sticky** — krymper vid scroll
- **Hall of Fame** — `/hall-of-fame` lanserad
- **Thumbnails** — Supabase Storage bucket "thumbnails"
