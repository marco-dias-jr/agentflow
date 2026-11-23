# AgentFlow — AI Agent Orchestration & Hybrid RAG Platform

AgentFlow is a full-stack AI engineering platform built with **Clean Architecture** for creating, configuring, executing, and auditing autonomous AI agents with **Hybrid RAG**, deterministic **Tool Calling**, multi-tenant authentication, and step-by-step **Execution Traces**.

---

## Key Features

### Multi-Provider LLM Orchestration & Deterministic Tool Calling
- **Provider-Agnostic Runtime:** Dynamically switch between **Google Gemini**, **Groq**, and local **Ollama** models via environment configuration without vendor lock-in.
- **Agent Lifecycle Management:** Create, edit, and delete agents with custom system prompts, model selection, enabled tools, and linked knowledge documents.
- **Step-by-Step Execution Trace:** Every prompt execution records a full audit trail (`user_message`, `llm_request`, `tool_call`, `tool_result`, `assistant_response`) including per-step latency (`durationMs`).
- **Built-in Tools:**
  - `calculator`: Safe mathematical expression evaluation.
  - `knowledge_search`: Agent-scoped hybrid semantic + lexical retrieval with verifiable citations.

### Hybrid RAG Pipeline & Cost Deduplication (FinOps)
- **End-to-End Ingestion:** Supports `.txt`, `.md`, `.csv`, `.json`, and text-based `.pdf` files with text extraction, overlapping chunking, and vector embeddings.
- **Account-Level Deduplication:** Computes a SHA-256 content hash per user account to prevent duplicate chunking and redundant embedding API costs.
- **Cross-Agent Document Reuse:** Attach existing account documents to multiple agents during creation or editing (`N:N` relationship) without re-uploading.
- **Hybrid Retrieval & Verifiable Citations:** Combines vector cosine similarity (`pgvector`) with PostgreSQL Full-Text Search ranking, returning grounded snippets formatted with verifiable source citations (`[Document Title, Chunk #N]`).

### Security & Multi-Tenant Architecture
- **Clean Architecture:** Strict separation across `Domain`, `Application`, `Infrastructure`, and `Presentation` layers.
- **Authentication & Account Registration:** Public registration with full name, email, and Brazilian CPF check-digit validation (`mod 11`).
- **Cryptographic Password Storage:** Unique per-user random cryptographic salt + `scrypt` key derivation with optional pepper and constant-time comparison (`crypto.timingSafeEqual`).
- **Hardened Session Management:** Opaque session tokens stored as HMAC-SHA256 hashes in PostgreSQL and delivered via `HttpOnly`, `SameSite` cookies.
- **Email Password Recovery:** 6-digit one-time verification codes stored as hashes with 10-minute expiration, 5-attempt brute-force lockout, and automatic session revocation upon reset.
- **Defense in Depth:** Parameterized SQL queries, Zod schema validation, in-memory rate limiting, strict CORS, and security headers (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`).

---

## Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Backend API** | TypeScript, NestJS, Express, Zod |
| **Frontend Web** | Next.js 16 (App Router, Turbopack), React, Tailwind CSS v4 |
| **Database & Vector Store** | PostgreSQL (NeonDB), `pg`, `pgvector`, Full-Text Search |
| **LLM & Embedding Providers** | Google Gemini, Groq, Ollama |
| **Testing** | Vitest |

---

## Project Structure

```text
agentflow/
├── apps/
│   ├── api/                        # NestJS Backend (Clean Architecture)
│   │   └── src/
│   │       ├── domain/             # Entities, Value Objects (CPF), Repository Interfaces
│   │       ├── application/        # Use Cases (Auth, Agents, Executions, RAG) & Ports
│   │       ├── infrastructure/     # PostgreSQL/pgvector, LLM/Embedding Adapters, Security
│   │       └── presentation/       # REST Controllers, DTOs (Zod), AuthGuard, Cookies
│   └── web/                        # Next.js 16 Frontend
│       └── src/
│           ├── app/                # Main Agent Workspace & Trace Inspector
│           ├── components/         # AuthGate (Sign In, Register, Password Recovery)
│           └── lib/                # Typed API Client
├── tests/                          # Vitest Unit Test Suite
├── .env.example                    # Environment Configuration Template
└── package.json                    # Monorepo Scripts
```

---

## Getting Started

### 1. Prerequisites
- Node.js `>= 20`
- A PostgreSQL instance (e.g., [NeonDB](https://neon.tech)) with `pgvector` support
- At least one LLM provider configured (**Google Gemini**, **Groq**, or local **Ollama**)

### 2. Environment Setup
Copy `.env.example` to `.env` in the repository root and configure your values:

```bash
cp .env.example .env
```

```env
# API Server & Frontend Origin
PORT=3001
CORS_ORIGIN=http://localhost:3000

# Security Secrets
SESSION_SECRET=replace-with-a-long-random-secret
PASSWORD_PEPPER=replace-with-an-optional-pepper

# Active LLM Provider: gemini | groq | ollama
LLM_PROVIDER=gemini

# Google AI / Gemini
GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-2.5-flash

# Groq (optional)
GROQ_API_KEY=
GROQ_MODEL=llama-3.3-70b-versatile

# Ollama (optional local mode)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5:3b

# PostgreSQL Database (NeonDB)
DATABASE_URL=postgresql://user:password@host.neon.tech/neondb?sslmode=verify-full

# Email Delivery (optional; defaults to console output in local dev)
RESEND_API_KEY=
EMAIL_FROM=AgentFlow <onboarding@resend.dev>
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Run Locally (Development)
Start the NestJS API (Terminal 1):
```bash
cd apps/api
npm run start:dev
```

Start the Next.js Frontend (Terminal 2):
```bash
cd apps/web
npm run dev
```

Open `http://localhost:3000`, register an account, upload knowledge documents, create an agent, and inspect execution traces in real time.

---

## Running Tests & Builds

```bash
# Backend typecheck & unit tests
cd apps/api
npm run typecheck && npm test

# Frontend typecheck & production build
cd apps/web
npm run typecheck && npm run build
```

---

## Deployment Architecture (Render + Vercel + NeonDB)
- **Database (`NeonDB`):** Managed serverless PostgreSQL with `pgvector` enabled and automatic schema initialization on API startup.
- **Backend (`Render`):** Deploy `apps/api` as a Node Web Service with `NODE_ENV=production`, `CORS_ORIGIN` set to your Vercel domain, and `SESSION_SECRET` / `DATABASE_URL` configured.
- **Frontend (`Vercel`):** Deploy `apps/web` with `NEXT_PUBLIC_API_URL` pointing to your Render API URL.

---

## License
MIT