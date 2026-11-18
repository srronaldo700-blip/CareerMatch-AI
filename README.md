# CareerMatch AI — Agentic Job Discovery, Hybrid Search & Explainable Ranking

CareerMatch AI is a full-stack job discovery, hybrid semantic + keyword retrieval, explainable ranking, and controlled tool-calling assistant platform designed for 2027 Computer Engineering fresher and intern candidates.

## Problem Statement

Most entry-level job boards rely on brittle keyword matching or opaque relevance scores, while generic LLM career chatbots fabricate job postings and give ungrounded advice. Candidates need a transparent system that parses their resume without inventing qualifications, enforces hard eligibility filters, explains every matched and missing required skill, and uses an auditable tool-calling agent backed by real application state.

## Core Features

- **Authentication & Persistent Candidate Profiles**: Google Sign-In via Firebase Auth with server-side Bearer ID token verification and Firestore persistence.
- **Resume Upload & Confirmation Pipeline**: Upload `.pdf`, `.docx`, or `.txt` resumes (up to 5 MB). Extracts text server-side, parses structured fields via `gemini-4-hydrogen` JSON schema + Zod validation, marks missing data as `Unknown` (never invented), and requires candidate confirmation before saving.
- **Job Ingestion & Deduplication**: Seeded with 18 explicitly labeled synthetic 2027 fresher/intern SWE, Backend, and AI/ML roles (including an expired role to test active-status filtering). Supports manual entry, JSON batch, and CSV ingestion with deterministic `externalKey` deduplication and active/expired toggling.
- **Hybrid Semantic + Keyword Retrieval**: Combines `gemini-embedding-2` cosine similarity with BM25-weighted keyword scoring while enforcing hard eligibility filters (`isActive`, `workMode`, `experienceLevel`, `employmentType`, `location`, and saved preference exclusions) before ranking.
- **Explainable Ranking**: Transparent configurable weights (Required Skills 30%, Semantic 22%, Keyword 14%, Preferred Skills 10%, Role Alignment 8%, Experience 8%, Location & Work Mode 8%). Displays matched/missing required skills, signal breakdown, and a plain-English explanation. Relevance scores represent rule-based fit, not hiring probability.
- **Controlled Agentic Assistant**: Single-agent loop (`gemini-4-hydrogen` with `FunctionDeclaration` tools: `search_jobs`, `get_job_details`, `update_preferences`, `save_job`, `compare_jobs`, `explain_match`) guarded by Zod argument validation, max 5 iterations, 10s per-tool timeouts, prompt-injection sanitization, and persistent tool execution logs.
- **Live Evaluation Lab**: Runs 6 labeled fresher/intern queries comparing Hybrid vs. Keyword-Only baseline (`Precision@5`, `Recall@5`, `NDCG@5`, latency, hard-filter compliance) alongside live Zod, prompt-injection, hallucinated-ID, duplicate-ingestion, and resume-schema probes.

## Technology Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS v4 (`Plus Jakarta Sans`, `DM Sans`, `JetBrains Mono`).
- **Backend**: Node.js + Express modular monolith (`server.ts`), Zod schema validation, `multer`, `pdf-parse`, `mammoth`.
- **Database & Auth**: Firebase Auth (Google Sign-In) + Cloud Firestore with hardened security rules (`firestore.rules`) and schema blueprint (`firebase-blueprint.json`).
- **AI & Embeddings**: Server-side `@google/genai` SDK (`gemini-4-hydrogen` for structured extraction & tool calling; `gemini-embedding-2` for dense vector embeddings).

## REST API Endpoints

- `GET /api/health` — Service health, indexed job count, and active ranking weights.
- `POST /api/auth/sync` — Synchronize authenticated candidate account.
- `GET /api/profile`, `PUT /api/profile` — Fetch and confirm structured candidate profile.
- `POST /api/resumes/upload` — Multipart PDF/DOCX/TXT upload, text extraction, and structured parse draft.
- `GET /api/preferences`, `PUT /api/preferences`, `DELETE /api/preferences` — Persistent user-controlled preference memory.
- `GET /api/jobs`, `GET /api/jobs/:id`, `POST /api/jobs/ingest`, `PATCH /api/jobs/:id/status` — Job index management.
- `POST /api/search` — Hybrid / Semantic / Keyword search with hard eligibility filters and explainable ranking.
- `GET /api/recommendations` — Personalized ranked recommendations.
- `POST /api/jobs/compare` — Side-by-side comparison of 2–3 jobs.
- `GET /api/saved-jobs`, `POST /api/saved-jobs`, `DELETE /api/saved-jobs/:jobId` — Saved job bookmarks.
- `GET /api/agent/sessions`, `POST /api/agent/chat`, `GET /api/agent/logs` — Controlled agent chat and tool audit logs.
- `POST /api/evaluation/run` — Execute live retrieval and reliability evaluation suite.

## Local Setup

1. Install dependencies: `npm install`
2. Set `GEMINI_API_KEY` in your environment (see `.env.example`).
3. Start development server on port 3000: `npm run dev`
4. Build for production: `npm run build`

## Technical Interview Walkthrough Guide

### One-Minute Explanation
CareerMatch AI is an agentic job discovery and recommendation platform for 2027 engineering candidates. Instead of wrapping a generic chatbot, it implements a full search and ranking pipeline: candidates upload a PDF/DOCX resume, confirm their extracted profile, and search a deduplicated job index using hybrid vector + BM25 keyword retrieval gated by hard eligibility filters. Every result shows matched and missing required skills with transparent weighted signals, and a controlled 6-tool AI agent helps candidates search, compare, explain, and bookmark roles without hallucinating listings.

### Three-Minute Technical Walkthrough
1. **Modular Monolith**: Express serves REST endpoints and Vite in development, separating resume parsing, job ingestion, hybrid retrieval/ranking, agent orchestration, and live evaluation into distinct services.
2. **No-Hallucination Resume Pipeline**: `pdf-parse` and `mammoth` extract raw text; `gemini-4-hydrogen` populates a strict JSON `responseSchema` validated with Zod. Missing fields stay `Unknown`, and nothing persists until the candidate confirms.
3. **Hybrid Retrieval + Hard Filters**: Hard filters (`isActive`, `workMode`, `experienceLevel`, `location`, preference exclusions) execute before scoring so semantically similar but ineligible roles never leak through. Remaining jobs are scored by combining `gemini-embedding-2` cosine similarity with BM25-weighted token overlap.
4. **Explainable Ranking**: Deterministic weights produce a 0–100 relevance score alongside exact matched/missing skills and human-readable reasoning.
5. **Bounded Agent Loop**: The agent executes up to 5 iterations of 6 Zod-validated tools with 10s timeouts, prompt-injection stripping on untrusted text, and Firestore tool-call logging.
6. **Live Evaluation**: An in-app Evaluation Lab computes real `Precision@5`, `Recall@5`, and `NDCG@5` comparing Hybrid vs. Keyword-Only baseline plus automated reliability probes.

## Known Limitations & Future Improvements

- Embeddings are cached in Firestore and in-memory for the curated index; for 100k+ jobs, moving vector search to a dedicated ANN index (`pgvector` HNSW or Vertex AI Vector Search) would keep tail latency low.
- Demo jobs are explicitly labeled as synthetic records; connecting permitted partner job-board APIs via scheduled ingestion would provide live postings.
- Adding recruiter role-based workflows and automated CI test pipelines would further harden production operations.
