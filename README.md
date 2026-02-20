<p align="center">
  <h1 align="center">Vortex</h1>
  <p align="center">Open-source RAG chat application with multi-provider LLM support</p>
</p>

<p align="center">
  <a href="https://github.com/ankushchhabra02/vortex/actions/workflows/ci.yml"><img src="https://github.com/ankushchhabra02/vortex/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <img src="https://img.shields.io/github/stars/ankushchhabra02/vortex" alt="Stars">
  <img src="https://img.shields.io/github/license/ankushchhabra02/vortex" alt="License">
  <img src="https://img.shields.io/badge/deploy-vercel-blue" alt="Deploy">
  <a href="https://github.com/ankushchhabra02/vortex/issues"><img src="https://img.shields.io/github/issues/ankushchhabra02/vortex" alt="Issues"></a>
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> &middot;
  <a href="#features">Features</a> &middot;
  <a href="#architecture">Architecture</a> &middot;
  <a href="#deployment">Deployment</a> &middot;
  <a href="CONTRIBUTING.md">Contributing</a>
</p>

---

Vortex is a self-hosted RAG (Retrieval-Augmented Generation) application that lets you chat with your documents using any LLM provider. Upload PDFs, ingest URLs, and get accurate answers grounded in your own knowledge bases — with hybrid search, re-ranking, and source citations.

**Works out of the box with free models. No API key required to get started.**

## Features

### RAG Pipeline
- **Hybrid Search** — Combines vector similarity (pgvector cosine distance) with BM25 keyword matching using Reciprocal Rank Fusion (RRF) for better retrieval than vector-only search.
- **Re-ranking** — After retrieving candidates, results are re-ranked using exact phrase matching, keyword density, and position scoring to surface the most relevant chunks.
- **Source Citations** — Responses include `[n]` citation notation linking back to specific document sources, displayed as interactive badges in the chat UI.
- **Semantic Chunking** — Documents are split into 1500-character chunks with 300-character overlap using sentence-aware separators for better context preservation.

### Multi-Provider Support
- **5 LLM Providers** — OpenAI, Anthropic, Google, xAI (Grok), and OpenRouter. Switch providers and models from the settings page. Free models available via OpenRouter with zero configuration.
- **4 Embedding Providers** — Local embeddings via Xenova/Transformers.js (free, no API key), OpenAI (text-embedding-3-small/large), Google (text-embedding-004), or OpenRouter. Embedding model is locked per knowledge base to prevent dimension mismatches.

### Core Features
- **Knowledge Base Management** — Create multiple knowledge bases, each with its own embedding model. Dashboard shows document counts, conversation counts, and model badges.
- **Document Ingestion** — Upload PDFs and text files, or ingest content from any URL. Documents are chunked and embedded automatically with rollback on partial failure.
- **Streaming Chat** — Real-time streaming responses with conversation persistence and full chat history per knowledge base.
- **Settings Page** — Configure LLM provider, model, temperature, API keys, and default embedding model. API keys are encrypted at rest with AES-256-GCM.

### Security
- **Auth Middleware** — Supabase SSR cookie-based auth with session refresh on every request. Security headers (X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy).
- **Rate Limiting** — Tiered per-endpoint limits (chat: 20/min, ingest: 30/min, general: 60/min) with 429 responses and Retry-After headers.
- **Input Validation** — Zod schemas on all API route inputs with type-safe error messages.
- **KB Ownership Verification** — Every knowledge base operation verifies the requesting user owns the resource.
- **Soft Deletes** — Documents, knowledge bases, and conversations are soft-deleted with `deleted_at` timestamps, preserving data integrity.
- **SSRF Protection** — URL ingestion validates against internal/private IP ranges.

### UX
- **Error Boundary** — React error boundary with fallback UI and retry button wrapping all protected routes.
- **Confirmation Dialogs** — All destructive actions (delete KB, document, conversation) require confirmation.
- **Toast Notifications** — User-facing error feedback on all API failures.
- **Loading Skeletons** — Pulsing skeleton placeholders instead of full-page spinners.
- **Responsive Design** — Works on desktop and mobile with collapsible sidebar navigation.

## Preview

### Dashboard
![Dashboard](/public/screenshots/dashboard.png)

### Chat Interface
![Chat Interface](/public/screenshots/chat.png)

## Quick Start

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) account (free tier works)
- An [OpenRouter](https://openrouter.ai) API key (optional — free models work without one)

### Setup

```bash
# Clone and install
git clone https://github.com/ankushchhabra02/vortex.git
cd vortex
npm install

# Configure environment
cp .env.example .env.local
# Edit .env.local with your Supabase and OpenRouter credentials
```

### Database Setup

1. Create a new Supabase project
2. In the SQL Editor, run these migrations in order:
   - `supabase/migrations/001_initial_schema.sql` — Core tables, RLS policies, vector search
   - `supabase/migrations/002_multi_provider.sql` — Multi-provider support, flexible embeddings
   - `supabase/migrations/003_soft_deletes.sql` — Soft delete columns and indexes
   - `supabase/migrations/004_hybrid_search.sql` — Full-text search index and hybrid search function
   - `supabase/migrations/005_fix_search_functions.sql` — Optimized search thresholds and scoring
3. Copy your project URL, anon key, and service role key into `.env.local`

### Generate Encryption Key

The encryption key is used to encrypt API keys stored in the database:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Add the output as `ENCRYPTION_KEY` in `.env.local`.

### Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), create an account, and start building knowledge bases.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key |
| `OPENROUTER_API_KEY` | No | OpenRouter API key (free models work without it) |
| `ENCRYPTION_KEY` | Yes | 32-byte hex string for encrypting stored API keys |
| `NEXT_PUBLIC_APP_URL` | No | App URL (defaults to localhost:3000) |

## Architecture

```
Browser
  │
  ├── Dashboard (/)           ← KB cards, recent conversations
  ├── Chat (/chat/[kbId])     ← Streaming chat + citations + document sidebar
  └── Settings (/settings)    ← Provider config, API keys, embedding model
        │
        ▼
  Middleware                   ← Auth session refresh, security headers, route protection
        │
        ▼
  Next.js API Routes           ← Auth + rate limiting + Zod validation on every route
  ├── /api/chat               ← RAG context retrieval → LLM streaming with citations
  ├── /api/ingest             ← Document chunking + embedding (with rollback)
  ├── /api/settings           ← User preferences + encrypted API keys
  ├── /api/knowledge-bases    ← KB CRUD with ownership verification
  └── /api/conversations      ← Chat history CRUD (soft deletes)
        │
        ▼
  RAG Pipeline
  ├── Hybrid Search            ← Vector (pgvector) + Keyword (tsvector) via RRF
  ├── Re-ranker                ← Phrase match + keyword density + position scoring
  └── Context Builder          ← Top chunks with document titles → cited system prompt
        │
        ▼
  Provider Abstraction Layer
  ├── LLM Factory             ← OpenAI, Anthropic, Google, OpenRouter, xAI
  ├── Embedding Factory       ← Xenova (local), OpenAI, Google, OpenRouter
  └── Crypto                  ← AES-256-GCM key encryption
        │
        ▼
  Supabase
  ├── PostgreSQL + pgvector   ← Documents, chunks, embeddings, tsvector index
  ├── Auth (SSR)              ← Cookie-based authentication
  └── Row Level Security      ← Per-user data isolation
```

### How RAG Works in Vortex

1. **Ingest** — Documents are split into 1500-char chunks with 300-char overlap using sentence-aware separators. Each chunk is embedded using the KB's configured embedding model and stored in pgvector.
2. **Hybrid Search** — The user query is embedded and searched via both vector similarity (cosine distance) and BM25 keyword matching (PostgreSQL tsvector). Results are fused using Reciprocal Rank Fusion (RRF) with 70% vector / 30% keyword weighting.
3. **Re-rank** — Top candidates are re-scored using exact phrase matching, keyword density, and match position to surface the most relevant chunks.
4. **Generate** — The re-ranked chunks (with document titles) are injected into the system prompt with citation instructions. The LLM generates a grounded response with `[n]` source references.

## Database Schema

| Table | Purpose |
|-------|---------|
| `knowledge_bases` | User's KB collections with embedding model config |
| `documents` | Uploaded/ingested content metadata |
| `document_chunks` | Text chunks with vector embeddings |
| `conversations` | Chat threads linked to knowledge bases |
| `messages` | Individual chat messages |
| `user_settings` | LLM/embedding preferences per user |
| `user_providers` | Encrypted API keys per provider per user |

All tables have Row Level Security policies. Users can only access their own data.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, Turbopack) |
| UI | React 19, Tailwind CSS v4 |
| Database | Supabase (PostgreSQL + pgvector + tsvector) |
| Auth | Supabase Auth via @supabase/ssr |
| LLM | LangChain (ChatOpenAI, ChatAnthropic, ChatGoogleGenerativeAI) |
| Embeddings | Transformers.js (local), OpenAI, Google, OpenRouter |
| Document Loading | LangChain (PDF, Cheerio) |
| Validation | Zod |
| Testing | Vitest (80 tests) |

## Project Structure

```
src/
├── app/
│   ├── (protected)/              # Auth-guarded route group
│   │   ├── page.tsx              # Dashboard
│   │   ├── chat/[kbId]/page.tsx  # Chat interface
│   │   ├── settings/page.tsx     # Settings page
│   │   └── layout.tsx            # Auth check
│   ├── api/
│   │   ├── chat/                 # LLM streaming + message persistence
│   │   ├── ingest/               # Document ingestion
│   │   ├── settings/             # User settings + API key management
│   │   ├── knowledge-bases/      # KB CRUD
│   │   ├── conversations/        # Chat history + recent conversations
│   │   └── documents/            # Document deletion
│   ├── login/                    # Public login page
│   ├── signup/                   # Public signup page
│   └── auth/callback/            # Supabase auth callback
├── components/
│   ├── dashboard/                # KB cards, recent chats, create dialog
│   ├── settings/                 # Provider selector, API key manager, embedding selector
│   ├── layout/                   # Shared sidebar navigation
│   ├── chat-interface.tsx        # Chat UI with streaming
│   ├── ingest-panel.tsx          # Tabbed sidebar (Chats/Documents)
│   └── toast.tsx                 # Toast notifications
├── lib/
│   ├── providers/                # Multi-provider abstraction
│   │   ├── types.ts              # Provider types + model catalogs
│   │   ├── llm-factory.ts        # LLM provider factory
│   │   ├── embedding-factory.ts  # Embedding provider factory
│   │   └── crypto.ts             # AES-256-GCM encryption
│   ├── supabase/                 # Supabase clients + auth helpers + ownership verification
│   ├── validations.ts            # Zod schemas for all API inputs
│   ├── rate-limit.ts             # Tiered rate limiting
│   ├── embeddings.ts             # Xenova/Transformers.js embeddings
│   └── rag-service-supabase.ts   # RAG pipeline (chunk, embed, hybrid search, re-rank)
└── middleware.ts                  # Auth session refresh + security headers
```

## Deployment

### Vercel

1. Push to GitHub
2. Import the repository on [vercel.com](https://vercel.com)
3. Add all environment variables from the table above
4. Deploy

The app uses Supabase SSR middleware for auth. All environment variables must be set in Vercel's dashboard.

### Self-Hosted

Any platform that runs Node.js 18+ works. Build with `npm run build` and start with `npm start`.

## Security

- API keys encrypted at rest (AES-256-GCM with random IV per encryption)
- Auth middleware on every request (Supabase SSR session refresh + route protection)
- Security headers: X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy
- Rate limiting on all endpoints (tiered: chat 20/min, ingest 30/min, general 60/min)
- Zod input validation on all API route inputs
- KB ownership verification before any data access
- Row Level Security on all database tables
- URL validation with SSRF protection (blocks internal/private IPs)
- File type and size validation (10MB limit, PDF/TXT/MD/HTML only)
- Soft deletes filtered from all queries (no data leakage from deleted records)

## Troubleshooting

**"Unauthorized" errors** — Verify your Supabase keys are correct and you're logged in. Check the browser console for auth errors.

**Embeddings not generating** — Ensure Node.js 18+. Try clearing the cache with `rm -rf .next` and restarting.

**Chat not responding** — Check your LLM provider settings. If using a paid model, verify the API key is set and valid in Settings.

**Database errors after update** — Make sure you've run all 5 SQL migrations in order (001 through 005). Migration 002 drops and recreates the embedding column — existing embeddings will need to be re-ingested.

**Generic/irrelevant chat responses** — Ensure migration 005 has been applied. It fixes search thresholds and hybrid scoring. Also verify the KB has documents ingested (check the sidebar document list).

## Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) for details on the development workflow, code guidelines, and how to submit pull requests.

We also ask that all participants follow our [Code of Conduct](CODE_OF_CONDUCT.md).

## Security

If you discover a security vulnerability, please follow our [Security Policy](SECURITY.md). Do not open a public issue for security vulnerabilities.

## License

MIT

---

Built with Next.js, Supabase, LangChain, and Transformers.js.
