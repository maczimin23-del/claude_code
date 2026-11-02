# Jam Bakery — ordering platform

Real production codebase (Next.js + Prisma), not a prototype. Built to replace
the Instagram-DM-based ordering flow for a multi-branch café/bakery with:

- **Same-day pickup & delivery ordering**, with real daily stock tracking
  (items automatically disappear/sell out when the kitchen's actual stock
  runs out) and a per-time-slot limit on simultaneous pickup orders so the
  counter never gets overwhelmed (the exact failure mode Starbucks' own
  Mobile Order & Pay has publicly hit at its busiest stores).
- **A separate "cake on order" flow** with its own daily production
  capacity (in weight-units, not a flat slot count — a bigger, more
  elaborately decorated cake consumes more of the day's capacity), an
  automatic nearest-available-date search, and unpaid holds that expire and
  free the capacity back up.
- **A back office at `/admin`**, on its own authenticated route with no link
  from the public pages, for managing stock, order status and cake-capacity
  overrides (e.g. a reduced or increased capacity around a holiday).

## Stack

Next.js 16 (App Router, Server Actions) · TypeScript · Tailwind CSS v4 ·
Prisma ORM (SQLite locally, any Postgres in production — Supabase, Vercel
Postgres, Neon all work unchanged).

## Local development

```bash
npm install
cp .env.example .env        # fill in SESSION_SECRET, ADMIN_PASSWORD
npm run db:push             # creates prisma/dev.db from the schema
npm run db:seed             # seeds branches + menu
npm run dev
```

Open http://localhost:3000 for the storefront, http://localhost:3000/cake
for cake orders, http://localhost:3000/admin for the back office (password =
`ADMIN_PASSWORD` from `.env`).

## Deploying

1. **Database.** Create a free Postgres instance — easiest is
   [Vercel Postgres](https://vercel.com/docs/storage/vercel-postgres) or
   [Supabase](https://supabase.com) (Project Settings → Database →
   Connection string, "URI" mode). Copy the connection string.
2. **Switch the Prisma provider.** In `prisma/schema.prisma`, change:
   ```prisma
   datasource db {
     provider = "postgresql"   // was "sqlite"
     url      = env("DATABASE_URL")
   }
   ```
3. **Push the repo to GitHub** (already done if you're reading this from
   the repo) and import it in [Vercel](https://vercel.com/new).
4. **Environment variables** — set these in the Vercel project settings:
   - `DATABASE_URL` — the Postgres connection string from step 1
   - `ADMIN_PASSWORD` — the back-office password
   - `SESSION_SECRET` — a long random string (`openssl rand -hex 32`)
   - `SHOP_WHATSAPP` — the real WhatsApp number, digits only with country
     code (e.g. `7705xxxxxxx`)
5. **Build command**: Vercel runs `next build` automatically; add a
   `postinstall` step so Prisma's client and schema are applied on deploy —
   this is already wired into `package.json`'s `build` script
   (`prisma generate && prisma db push && next build`) so a fresh Postgres
   database gets its tables created on first deploy. Re-run `npm run
   db:seed` once (e.g. via `vercel env pull && npm run db:seed` locally
   pointed at the production `DATABASE_URL`) to load starting data.
6. **Custom domain**: add it under the Vercel project's Domains tab, point
   the DNS as instructed there.

## Swapping in real photography

Menu images live in `public/images/menu/*.svg` — placeholder illustrations
(the platform this was prototyped on blocks loading photos from outside
hosts, so these are drawn, not shot). To use real photos: drop JPG/PNG files
into `public/images/menu/`, then update each `imagePath` in
`prisma/seed.ts` (or edit it directly in the database) to point at the new
file. `next/image` already handles the rest — no code changes needed.

## Project layout

```
app/
  page.tsx            storefront (pickup/delivery)
  cake/page.tsx        cake-on-order flow
  admin/page.tsx        back-office login
  admin/dashboard/      protected back office (see proxy.ts)
  actions/              Server Actions — order.ts, cake.ts, admin.ts
components/            client components (cart, menu, admin widgets)
lib/
  config.ts             all business rules in one place (slot size, lead
                         time, capacity, decor pricing) — change these,
                         not scattered magic numbers
  cake.ts                capacity math for the cake flow
  data.ts                read queries for the storefront/admin
  session.ts, proxy.ts   admin auth (signed cookie, Edge-safe)
prisma/
  schema.prisma          data model
  seed.ts                starting data (branches, menu)
```

## What's intentionally out of scope for v1

- Real payments (orders hand off to WhatsApp for confirmation/deposit, same
  as the current manual process — wiring Kaspi Pay or a card gateway is a
  follow-up once there's order volume to justify it).
- Multi-admin accounts/roles (one shared back-office password for now).
- Cake reference photos are stored inline as base64 in Postgres for
  simplicity; past a few hundred orders, move these to Vercel Blob or
  Supabase Storage instead.
