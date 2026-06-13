# GitScope AI 🔍

> AI-powered Repository Intelligence Platform — chat with any public GitHub repository using RAG.

[![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.2-brightgreen)](https://spring.io/projects/spring-boot)
[![React](https://img.shields.io/badge/React-18-blue)](https://react.dev)
[![Gemini](https://img.shields.io/badge/Gemini-AI-orange)](https://ai.google.dev)
[![ChromaDB](https://img.shields.io/badge/ChromaDB-Vector%20DB-purple)](https://www.trychroma.com)

---

## What is GitScope AI?

GitScope AI lets developers understand unfamiliar codebases instantly. Paste a GitHub URL → the system clones it, generates embeddings, stores vectors in ChromaDB, and enables natural language Q&A using Retrieval-Augmented Generation.

**Example questions you can ask:**
- _"How does authentication work?"_
- _"What is the overall architecture?"_
- _"What database entities exist?"_
- _"How are API endpoints organized?"_

---

## Tech Stack

| Layer        | Technology                                                      |
|--------------|-----------------------------------------------------------------|
| Frontend     | React 18 · TypeScript · Vite · Tailwind                         |
| Backend      | Java 21 · Spring Boot 3 · Maven                                 |
| AI (RAG Q&A) | Google Gemini 2.5 Flash (LLM generation)                        |
| AI (Embed)   | In-Process ONNX Transformers (`all-MiniLM-L6-v2` via Spring AI) |
| Vector Store | ChromaDB                                                        |
| Database     | PostgreSQL (with persistent local SHA-256 caching)              |
| Git          | JGit (shallow clone)                                            |
| Deployment   | Vercel · Render · Supabase                                      |

---

## Project Structure

```
GitScope AI/
├── backend/                  # Spring Boot application
│   ├── src/main/java/com/gitscope/
│   │   ├── config/           # CORS, Gemini, ChromaDB config
│   │   ├── controller/       # REST endpoints
│   │   ├── service/          # Business logic
│   │   ├── repository/       # JPA repositories
│   │   ├── entity/           # JPA entities
│   │   ├── dto/              # Request/response DTOs
│   │   ├── exception/        # Global exception handler
│   │   ├── github/           # JGit clone + chunking
│   │   ├── embedding/        # Gemini embedding service
│   │   ├── vectorstore/      # ChromaDB HTTP client
│   │   └── rag/              # Gemini chat + prompts
│   ├── src/main/resources/
│   │   └── application.yml
│   ├── Dockerfile
│   └── pom.xml
│
├── frontend/                 # React + Vite application
│   ├── src/
│   │   ├── api/              # Axios API functions
│   │   ├── components/       # Reusable UI components
│   │   ├── context/          # Toast context
│   │   ├── pages/            # Landing, Dashboard, Chat, Docs
│   │   └── types/            # TypeScript interfaces
│   └── package.json
│
└── docker-compose.yml        # Full local stack
```

---

## Local Development Setup

### Prerequisites

- **Java 21** (e.g. via [SDKMAN](https://sdkman.io): `sdk install java 21.0.3-tem`)
- **Maven 3.9+**
- **Node.js 20+**
- **Docker & Docker Compose**
- **Google Gemini API Key** — [Get one free](https://aistudio.google.com/app/apikey)

### Local AI Setup (In-Process JVM Embeddings)

GitScope AI features a completely **zero-setup local embedding pipeline**. 
* **Zero Cost & Setup**: The system runs the `all-MiniLM-L6-v2` transformer model directly inside the Java Virtual Machine (JVM) process via Microsoft ONNX Runtime.
* **No External Daemons**: You do not need to download or run external AI software (such as Ollama, Llama.cpp, or Docker-based model servers) for vectorizing code.
* **Auto-download**: On first boot, the ONNX model files are automatically downloaded and cached in your home directory (`~/.spring-ai/`).
* **Persistent Cache**: The backend hashes trimmed code chunks via SHA-256 and caches vectors in PostgreSQL. Re-indexing a repository avoids vector recalculation entirely.

---

### Option A — Docker Compose (Recommended)

The easiest way to run the full stack locally.

**1. Clone and configure**
```bash
git clone https://github.com/your-username/gitscope-ai.git
cd "GitScope AI"
```

**2. Set your Gemini API key**
```bash
# Windows
set GEMINI_API_KEY=your_gemini_api_key_here

# macOS/Linux
export GEMINI_API_KEY=your_gemini_api_key_here
```

**3. Start all services**
```bash
docker-compose up --build
```

**4. Start the frontend separately**
```bash
cd frontend
npm install
npm run dev
```

**5. Open the app**

- Frontend: http://localhost:5173
- Backend API: http://localhost:8080
- ChromaDB: http://localhost:8000

---

### Option B — Manual Setup

#### Backend

```bash
cd backend

# Copy and edit environment file
copy .env.example .env
# Fill in GEMINI_API_KEY, DB_URL, DB_USERNAME, DB_PASSWORD

# Start PostgreSQL and ChromaDB via Docker
docker run -d --name chromadb -p 8000:8000 chromadb/chroma:latest
docker run -d --name postgres -e POSTGRES_DB=gitscope -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:16-alpine

# Run the Spring Boot application
mvn spring-boot:run \
  -Dspring-boot.run.jvmArguments="-DGEMINI_API_KEY=your_key -DDB_PASSWORD=postgres"
```

#### Frontend

```bash
cd frontend
npm install

# Copy and edit environment file
copy .env.example .env.local
# Set VITE_API_URL=/api for local development

npm run dev
```

---

## API Endpoints

### Repository

| Method | Endpoint                          | Description                    |
|--------|-----------------------------------|--------------------------------|
| POST   | `/api/repositories/index`         | Index a GitHub repository      |
| GET    | `/api/repositories`               | List all indexed repositories  |
| GET    | `/api/repositories/{id}`          | Get repository metadata        |
| GET    | `/api/repositories/{id}/summary`  | AI-generated repository summary|
| GET    | `/api/repositories/{id}/files`    | List all indexed file paths    |

### Chat

| Method | Endpoint                         | Description                    |
|--------|----------------------------------|--------------------------------|
| POST   | `/api/chat`                      | Ask a question (RAG pipeline)  |
| GET    | `/api/chat/history/{repoId}`     | Get chat history for a repo    |

### Request/Response Examples

**Index a repository:**
```bash
curl -X POST http://localhost:8080/api/repositories/index \
  -H "Content-Type: application/json" \
  -d '{"repositoryUrl":"https://github.com/spring-projects/spring-petclinic"}'
```

**Chat with a repository:**
```bash
curl -X POST http://localhost:8080/api/chat \
  -H "Content-Type: application/json" \
  -d '{"repositoryId":1,"question":"How does authentication work?"}'
```

---

## Deployment Guide

### Frontend → Vercel

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com) → New Project → Import from GitHub
3. Set **Root Directory** to `frontend`
4. Add environment variable:
   - `VITE_API_URL` = `https://your-backend.onrender.com/api`
5. Click Deploy

### Backend → Render

1. Go to [render.com](https://render.com) → New Web Service
2. Connect your GitHub repository
3. Set **Root Directory** to `backend`
4. Set **Build Command**: `mvn clean package -DskipTests`
5. Set **Start Command**: `java -jar target/*.jar`
6. Add environment variables:
   - `GEMINI_API_KEY`
   - `DB_URL` (from Supabase)
   - `DB_USERNAME`
   - `DB_PASSWORD`
   - `CHROMA_HOST` (your ChromaDB host)
   - `CHROMA_PORT` = `8000`

### PostgreSQL → Supabase

1. Go to [supabase.com](https://supabase.com) → New Project
2. Copy the **Connection String** (URI format)
3. Set as `DB_URL` in Render environment variables

### ChromaDB → Docker (Self-hosted)

Run ChromaDB on any VPS or locally:
```bash
docker run -d \
  --name chromadb \
  -p 8000:8000 \
  -v chroma_data:/chroma/chroma \
  -e IS_PERSISTENT=TRUE \
  chromadb/chroma:latest
```

> **Note:** For production, consider deploying ChromaDB on a persistent VPS (e.g. DigitalOcean, Railway, Fly.io).

---

## Configuration Reference

| Variable         | Default                             | Description                        |
|------------------|-------------------------------------|------------------------------------|
| `GEMINI_API_KEY` | *(required)*                        | Google Gemini API key              |
| `DB_URL`         | `jdbc:postgresql://localhost:5432/gitscope` | PostgreSQL JDBC URL       |
| `DB_USERNAME`    | `postgres`                          | Database username                  |
| `DB_PASSWORD`    | `postgres`                          | Database password                  |
| `CHROMA_HOST`    | `localhost`                         | ChromaDB host                      |
| `CHROMA_PORT`    | `8000`                              | ChromaDB port                      |
| `TOP_K_RESULTS`  | `12`                                | RAG top-K chunks to retrieve       |
| `MAX_FILES`      | `500`                               | Max files to index per repository  |
| `MAX_FILE_SIZE_MB` | `20`                              | Max single file size in MB         |

---

## Supported File Types

| Extension       | Language    | Chunking Strategy              |
|-----------------|-------------|--------------------------------|
| `.java`         | Java        | By class, method               |
| `.ts` / `.tsx`  | TypeScript  | By component, hook, function   |
| `.js` / `.jsx`  | JavaScript  | By function, route handler     |
| `.json`         | JSON        | Sliding window                 |
| `.yml` / `.yaml`| YAML        | Sliding window                 |
| `.md`           | Markdown    | Sliding window                 |

---

## Ignored Directories

`node_modules` · `target` · `build` · `dist` · `coverage` · `.git` · `.idea` · `.vscode`

---

## License

MIT — free to use, modify, and deploy.
