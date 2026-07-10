# NextGen Facade AI

AI-powered facade material intelligence platform. Search, compare, and explore facade materials — ACP, glass, stone, HPL, louvers, and more — with AI-driven insights.

## Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16, React 19, Tailwind CSS 4 |
| Backend API | Next.js Route Handlers (`app/api/`) |
| Database | Supabase (PostgreSQL) |
| AI | OpenAI |

## Project Structure

```
nextgen-facade-ai/
├── frontend/                  # Next.js full-stack application
│   ├── app/
│   │   ├── page.tsx           # Landing page
│   │   ├── api/               # Backend API routes
│   │   ├── search/            # Material search
│   │   ├── compare/           # Side-by-side comparison
│   │   ├── datasheets/        # Technical datasheets
│   │   └── knowledge/         # Knowledge base articles
│   ├── components/
│   │   ├── landing/           # Landing page sections
│   │   ├── layout/            # Header, footer, layout shell
│   │   └── ui/                # Shared UI primitives
│   ├── lib/
│   │   ├── supabase.ts        # Supabase client (browser + server)
│   │   ├── env.ts             # Environment variable validation
│   │   └── api-response.ts    # Standardized API responses
│   ├── services/              # Data access layer
│   ├── types/                 # TypeScript types
│   ├── hooks/                 # React hooks
│   └── supabase/
│       ├── migrations/        # Database schema
│       └── seed.sql           # Sample data
├── package.json               # Root workspace scripts
└── README.md
```

## Getting Started

### Prerequisites

- Node.js 20+
- A [Supabase](https://supabase.com) project (optional — app works with mock data)

### 1. Install dependencies

```bash
cd frontend
npm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

Fill in your values:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
OPENAI_API_KEY=sk-...          # optional, for AI comparison
APIFY_API_TOKEN=               # optional, for web scraping
N8N_WEBHOOK_URL=               # optional, for automation
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Set up Supabase (optional)

Run the migration in Supabase Dashboard → SQL Editor:

```
frontend/supabase/migrations/001_initial_schema.sql
```

This creates `materials`, `datasheets`, and `knowledge_articles` tables with seed data.

### 4. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check and service status |
| GET | `/api/materials` | List materials (`?category`, `?page`, `?limit`) |
| GET | `/api/materials?id=` | Get material by ID or slug |
| GET | `/api/materials/[id]` | Get material by ID |
| GET | `/api/search?q=` | Search materials |
| GET | `/api/compare?ids=` | Compare materials |
| GET | `/api/datasheets` | List datasheets |
| GET | `/api/knowledge` | List knowledge articles |
| POST | `/api/ai/analyze` | AI-powered material analysis |

All endpoints return a consistent JSON envelope:

```json
{ "success": true, "data": { ... } }
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
