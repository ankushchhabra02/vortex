# 🌀 Vortex - Free RAG Chat Application

> A production-ready RAG (Retrieval-Augmented Generation) chat application built with Next.js, Supabase, and completely **FREE** AI models.

## ✨ Features

- 🔐 **User Authentication** - Secure sign-up/login with Supabase Auth
- 📚 **Knowledge Bases** - Create multiple knowledge bases per user
- 📄 **Document Ingestion** - Upload PDFs and ingest web URLs
- 🔍 **Vector Search** - Semantic search using free Transformers.js embeddings
- 💬 **Streaming Chat** - Real-time responses using OpenRouter's free models
- 💾 **Conversation History** - Save and retrieve past conversations
- 🔒 **Security First** - Input validation, SSRF protection, RLS policies
- 🎨 **Modern UI** - Clean, responsive interface with dark mode support

## 💰 Completely FREE Stack

| Component | Solution | Cost |
|-----------|----------|------|
| **Database** | Supabase (500MB) | FREE |
| **Vector Storage** | Supabase pgvector | FREE |
| **Embeddings** | Transformers.js (local) | FREE |
| **LLM** | OpenRouter free models | FREE |
| **Hosting** | Vercel | FREE |
| **Total Monthly Cost** | | **$0** |

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ installed
- A Supabase account ([sign up free](https://supabase.com))
- An OpenRouter API key ([get free key](https://openrouter.ai))

### 1. Clone the Repository

```bash
git clone https://github.com/ankushchhabradelta4infotech-ai/vortex.git
cd vortex
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Supabase

#### Create a Supabase Project

1. Go to [https://supabase.com](https://supabase.com)
2. Click "New Project"
3. Choose a name and region
4. Wait ~2 minutes for setup

#### Run Database Migration

1. In Supabase Dashboard, go to **SQL Editor**
2. Click "New Query"
3. Copy the entire contents of `supabase/migrations/001_initial_schema.sql`
4. Paste and click "Run"

#### Get API Keys

1. Go to **Settings** → **API**
2. Copy these values:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role key** → `SUPABASE_SERVICE_ROLE_KEY`

### 4. Get OpenRouter API Key

1. Go to [https://openrouter.ai](https://openrouter.ai)
2. Sign up / Log in
3. Go to **Keys** section
4. Create new key
5. Copy the key → `OPENROUTER_API_KEY`

### 5. Configure Environment Variables

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# OpenRouter (uses FREE models)
OPENROUTER_API_KEY=sk-or-v1-your-key-here

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 6. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) 🎉

### 7. Create Your Account

1. Click "Sign Up"
2. Enter email and password
3. Start chatting!

## 📖 How to Use

### 1. Create a Knowledge Base

After logging in, you'll automatically get a default knowledge base. You can create more from the sidebar.

### 2. Add Documents

**Upload PDF:**
1. Click file upload icon
2. Select a PDF file (max 10MB)
3. Wait for processing

**Ingest URL:**
1. Click URL input
2. Paste any HTTPS URL
3. Click ingest

### 3. Chat with Your Knowledge Base

1. Type your question
2. Vortex will search your documents
3. Get accurate answers with source citations

### 4. View Conversation History

- All conversations are automatically saved
- Access past chats from the sidebar
- Continue previous conversations

## 🏗️ Architecture

```
┌─────────────────────────────────────┐
│      Frontend (Next.js + React)    │
│  - Chat Interface                   │
│  - Document Management              │
│  - Authentication UI                │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│      API Routes (Next.js)           │
│  - /api/chat                        │
│  - /api/ingest                      │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│      RAG Service                    │
│  - Transformers.js (Embeddings)     │
│  - Text Chunking                    │
│  - Vector Search                    │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│   Supabase (Database + Auth)        │
│  - PostgreSQL + pgvector            │
│  - Row Level Security               │
│  - User Management                  │
└─────────────────────────────────────┘
```

## 🗄️ Database Schema

- `knowledge_bases` - User's knowledge collections
- `documents` - Uploaded/ingested content
- `document_chunks` - Text chunks with embeddings (384-dim)
- `conversations` - Chat threads
- `messages` - Individual chat messages

All tables have Row Level Security (RLS) for multi-user isolation.

## 🔒 Security Features

✅ URL validation (SSRF protection)
✅ File type validation
✅ File size limits (10MB)
✅ Input sanitization
✅ Authentication required
✅ Row Level Security (RLS)
✅ Prompt injection protection
✅ Rate limiting ready

## 🚢 Deployment

### Deploy to Vercel

1. Push code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Click "Import Project"
4. Select your repository
5. Add environment variables:
   ```
   NEXT_PUBLIC_SUPABASE_URL
   NEXT_PUBLIC_SUPABASE_ANON_KEY
   SUPABASE_SERVICE_ROLE_KEY
   OPENROUTER_API_KEY
   NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
   ```
6. Deploy!

## 🛠️ Tech Stack

### Frontend
- **Next.js 15** - React framework
- **React 19** - UI library
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Lucide Icons** - Icons

### Backend
- **Next.js API Routes** - Server endpoints
- **Supabase** - Database + Auth
- **pgvector** - Vector similarity search
- **LangChain** - Document processing

### AI/ML
- **Transformers.js** - FREE local embeddings (Xenova/all-MiniLM-L6-v2)
- **OpenRouter** - FREE LLM access (meta-llama/llama-3.2-3b-instruct:free)

## 📁 Project Structure

```
vortex/
├── src/
│   ├── app/
│   │   ├── api/           # API routes
│   │   │   ├── chat/      # Chat endpoint
│   │   │   └── ingest/    # Document ingestion
│   │   ├── auth/          # Auth pages
│   │   │   ├── login/
│   │   │   └── signup/
│   │   ├── layout.tsx     # Root layout
│   │   └── page.tsx       # Home page
│   ├── components/        # React components
│   │   ├── chat-interface.tsx
│   │   └── ingest-panel.tsx
│   └── lib/               # Utilities
│       ├── supabase/      # Supabase clients
│       ├── embeddings.ts  # FREE embeddings
│       └── rag-service-supabase.ts
├── supabase/
│   └── migrations/        # Database schema
├── .env.example
└── README.md
```

## 🐛 Troubleshooting

### "Unauthorized" errors
- Check your Supabase keys are correct
- Verify you're logged in
- Check browser console for auth errors

### Embeddings not generating
- Check Node.js version (18+)
- Clear `.next` cache: `rm -rf .next`
- Restart dev server

### Chat not responding
- Verify OpenRouter API key
- Check model name is correct
- Look for errors in terminal

### Database connection fails
- Verify Supabase project is active
- Check URL and keys are correct
- Ensure migration was run successfully

## 🤝 Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📄 License

MIT License - feel free to use for personal or commercial projects

## 🔗 Links

- [Supabase Documentation](https://supabase.com/docs)
- [OpenRouter Models](https://openrouter.ai/models)
- [Transformers.js](https://huggingface.co/docs/transformers.js)
- [Next.js Documentation](https://nextjs.org/docs)

## ⭐ Star this repo if you found it helpful!

---

Built with ❤️ using completely FREE and open-source technologies
