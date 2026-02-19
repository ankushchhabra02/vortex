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

Vortex is a self-hosted RAG (Retrieval-Augmented Generation) application that lets you chat with your documents using any LLM provider. Upload PDFs, ingest URLs, and get accurate answers grounded in your own knowledge bases — all with a clean, modern interface.

**Works out of the box with free models. No API key required to get started.**

## Features

- **Multi-Provider LLM Support** — OpenAI, Anthropic, xAI (Grok), and OpenRouter. Switch providers and models from the settings page. Free models available via OpenRouter with zero configuration.
- **Switchable Embedding Models** — Local embeddings via Xenova/Transformers.js (free, no API key) or OpenAI embeddings (text-embedding-3-small/large). Embedding model is locked per knowledge base to prevent dimension mismatches.
- **Knowledge Base Management** — Create multiple knowledge bases, each with its own embedding model. Dashboard shows document counts, conversation counts, and model badges.
- **Document Ingestion** — Upload PDFs and text files, or ingest content from any URL. Documents are chunked and embedded automatically.
- **Streaming Chat** — Real-time streaming responses with conversation persistence. Full chat history per knowledge base.
- **Settings Page** — Configure LLM provider, model, temperature, API keys, and default embedding model. API keys are encrypted at rest with AES-256-GCM.
- **Authentication** — Email/password auth via Supabase with server-side session checks. All data is isolated per user with Row Level Security.
- **Responsive Design** — Works on desktop and mobile with collapsible sidebar navigation.
- **GitHub Integration** — Direct link to the source repository from the header.

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
   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/migrations/002_multi_provider.sql`
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
  ├── Chat (/chat/[kbId])     ← Streaming chat + document sidebar
  └── Settings (/settings)    ← Provider config, API keys, embedding model
        │
        ▼
  Next.js API Routes
  ├── /api/chat               ← LLM streaming via provider factory
  ├── /api/ingest             ← Document chunking + embedding
  ├── /api/settings           ← User preferences + encrypted API keys
  ├── /api/knowledge-bases    ← KB CRUD with doc/conversation counts
  └── /api/conversations      ← Chat history CRUD
        │
        ▼
  Provider Abstraction Layer
  ├── LLM Factory             ← OpenAI, Anthropic, OpenRouter, xAI
  ├── Embedding Factory       ← Xenova (local) or OpenAI API
  └── Crypto                  ← AES-256-GCM key encryption
        │
        ▼
  Supabase
  ├── PostgreSQL + pgvector   ← Documents, chunks, embeddings
  ├── Auth                    ← Email/password authentication
  └── Row Level Security      ← Per-user data isolation
```

### How RAG Works in Vortex

1. **Ingest** — Documents are split into chunks (~1000 chars) and each chunk is embedded using the KB's configured embedding model. Chunks and vectors are stored in pgvector.
2. **Query** — When you ask a question, the query is embedded with the same model, then pgvector finds the most similar chunks via cosine distance.
3. **Generate** — The top matching chunks are injected into the system prompt, and the selected LLM generates a grounded response.

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
| Database | Supabase (PostgreSQL + pgvector) |
| Auth | Supabase Auth via @supabase/ssr |
| LLM | LangChain (ChatOpenAI, ChatAnthropic) |
| Embeddings | Transformers.js (local) or OpenAI API |
| Document Loading | LangChain (PDF, Cheerio) |

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
└── lib/
    ├── providers/                # Multi-provider abstraction
    │   ├── types.ts              # Provider types + model catalogs
    │   ├── llm-factory.ts        # LLM provider factory
    │   ├── embedding-factory.ts  # Embedding provider factory
    │   └── crypto.ts             # AES-256-GCM encryption
    ├── supabase/                 # Supabase clients + auth helpers
    ├── embeddings.ts             # Xenova/Transformers.js embeddings
    └── rag-service-supabase.ts   # RAG pipeline (chunk, embed, search)
```

## Deployment

### Vercel

1. Push to GitHub
2. Import the repository on [vercel.com](https://vercel.com)
3. Add all environment variables from the table above
4. Deploy

The app uses server-side auth checks (no Edge middleware), so it works on all Vercel runtimes without issues.

### Self-Hosted

Any platform that runs Node.js 18+ works. Build with `npm run build` and start with `npm start`.

## Security

- API keys encrypted at rest (AES-256-GCM)
- Server-side authentication on all protected routes
- Row Level Security on all database tables
- URL validation with SSRF protection
- File type and size validation
- Input sanitization and length limits

## Troubleshooting

**"Unauthorized" errors** — Verify your Supabase keys are correct and you're logged in. Check the browser console for auth errors.

**Embeddings not generating** — Ensure Node.js 18+. Try clearing the cache with `rm -rf .next` and restarting.

**Chat not responding** — Check your LLM provider settings. If using a paid model, verify the API key is set and valid in Settings.

**Database errors after update** — Make sure you've run both SQL migrations in order. The second migration (`002_multi_provider.sql`) drops and recreates the embedding column — existing embeddings will need to be re-ingested.

## Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) for details on the development workflow, code guidelines, and how to submit pull requests.

We also ask that all participants follow our [Code of Conduct](CODE_OF_CONDUCT.md).

## Security

If you discover a security vulnerability, please follow our [Security Policy](SECURITY.md). Do not open a public issue for security vulnerabilities.

## License

MIT

---

Built with Next.js, Supabase, LangChain, and Transformers.js.
