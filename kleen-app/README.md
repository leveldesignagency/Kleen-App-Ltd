# KLEEN – Professional Cleaning Services Platform

Full-stack web application and PWA for booking and managing professional cleaning services.

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Styling**: TailwindCSS
- **Database**: PostgreSQL via Prisma ORM
- **Auth**: Supabase Auth (SSR)
- **State**: Zustand (persisted job flow)
- **Deployment**: Vercel
- **PWA**: Custom service worker + manifest

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database (or Supabase project)

### Setup

```bash
cd kleen-app
cp .env.local.example .env.local
# Fill in your Supabase credentials in .env.local
npm install
npx prisma generate
npx prisma db push   # Push schema to your database
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment Variables

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |
| `DATABASE_URL` | PostgreSQL connection string |
| `NEXT_PUBLIC_SITE_URL` | Site URL (e.g. http://localhost:3000) |

## Project Structure

```
src/
├── app/
│   ├── (marketing)/       # Public website (homepage, services, about, etc.)
│   ├── dashboard/         # Authenticated customer dashboard
│   ├── job-flow/          # Multi-step job submission (full-page)
│   └── layout.tsx         # Root layout with PWA support
├── components/
│   ├── dashboard/         # Dashboard-specific components
│   ├── job-flow/          # Step 1–6 form components
│   ├── layout/            # Navbar, Footer, Sidebar
│   └── ui/                # Shared UI (buttons, inputs, cards)
├── lib/
│   ├── supabase/          # Auth client (browser, server, middleware)
│   ├── services.ts        # Service categories & catalog
│   ├── pricing.ts         # Price estimation engine
│   ├── store.ts           # Zustand store (job flow state)
│   └── prisma.ts          # Prisma client singleton
├── types/
│   └── index.ts           # TypeScript interfaces
└── middleware.ts           # Supabase session refresh
```

## Routes

| Route | Description |
|---|---|
| `/` | Homepage with hero, services, CTA |
| `/services` | Full service catalog with pricing |
| `/about` | Company info and values |
| `/contact` | Contact form |
| `/faq` | Accordion FAQ |
| `/terms` | Terms of Service |
| `/privacy` | Privacy Policy |
| `/job-flow` | Multi-step job booking (6 steps) |
| `/dashboard` | Customer dashboard overview |
| `/dashboard/jobs` | Job list with filters + QR codes |
| `/dashboard/profile` | Profile + payment settings |
| `/dashboard/disputes` | Dispute management |

## Deploying to Vercel

1. Push to GitHub
2. Import into Vercel
3. Set environment variables
4. Deploy

Prisma will auto-generate on build via `postinstall`.
