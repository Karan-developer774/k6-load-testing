# Antigravity Production-Grade Dynamic API Load Testing Platform

An enterprise-ready, dynamic API Load Testing Platform powered by **Grafana k6** and a high-performance **Fastify v5** backend, featuring a **React 19 + Tailwind CSS + Recharts** real-time monitoring dashboard.

Test virtually any HTTP/HTTPS API with manual load configurations (e.g., $N$ concurrent users for $N$ seconds), dynamic multi-stage ramp-up/down curves, and real-time SLA thresholds without writing or modifying any JavaScript or k6 scripts.

---

## ⚡ Key Capabilities & Architecture

- **Dynamic API Builder**: Supports `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS`, custom headers, query parameters, URL path variables, and payload formats (JSON, XML, form-data, urlencoded, raw).
- **Comprehensive Authentication Vault**: Bearer tokens, Basic auth, API keys, custom auth headers, and OAuth 2.0 client credentials. Sensitive secrets are encrypted at rest with **AES-256-GCM** and redacted from logs.
- **6 Native k6 Load Strategies**:
  1. `constant-vus`: Fixed concurrent users with configurable ramp-up and ramp-down.
  2. `ramping-vus`: Multi-stage traffic curves (e.g., $0 \to 100 \to 500 \to 0$ VUs).
  3. `constant-arrival-rate`: Guaranteed iterations/second independent of response latency.
  4. `ramping-arrival-rate`: Gradually increasing request arrival rates.
  5. `shared-iterations`: Fixed total iterations shared across a pool of VUs.
  6. `per-vu-iterations`: Fixed iterations per virtual user.
- **Interactive Visual Load Curve Preview**: Visualizes the load ramp-up/plateau/cool-down in real-time as users adjust sliders and stage parameters.
- **Sub-Second Streaming Telemetry**: Fastify native Server-Sent Events (SSE) stream 1-second aggregated metrics (Active VUs, RPS, P50/P90/P95/P99 latency, error rate, checks) without event-loop bottlenecks.
- **Production SSRF & Security Guard**: Enforces domain allowlists, resolves DNS, blocks bogon/loopback/private IP ranges (`127.0.0.1`, `10.x`, `172.16.x`, `192.168.x`) and cloud metadata endpoints (`169.254.169.254`).
- **Dual Execution Engine**:
  - **Local Native Runner**: Directly executes host `k6.exe` in an isolated child process with designated temp working directories.
  - **Docker Runner**: Containerized execution with cgroups CPU/memory quotas.
- **Historical Reports & Run Comparison**: Side-by-side performance diffs, SLA threshold evaluations, and downloadable CSV/JSON exports.
- **Built-in Mock Target API**: Zero-dependency mock API (`/api/v1/mock/users`, `/api/v1/mock/slow`, etc.) built right into the backend for testing.

---

## 🚀 Quick Start (Local Development)

The platform is designed to run seamlessly on your current machine out of the box using Node.js and the native `k6.exe`.

### 1. Start the Platform
In the root directory, run:

```bash
# Start backend (port 3001) and frontend (port 3000) concurrently:
npm run dev
```

Or run each service individually:

```bash
# Terminal 1: Backend Fastify API
npm run dev:backend

# Terminal 2: Frontend Dashboard
npm run dev:frontend
```

### 2. Access the Applications
- **Frontend Dashboard**: [http://localhost:3000](http://localhost:3000)
- **Fastify Backend API**: [http://localhost:3001](http://localhost:3001)
- **Interactive Swagger OpenAPI Docs**: [http://localhost:3001/docs](http://localhost:3001/docs)
- **Built-in Mock Target API**: [http://localhost:3001/api/v1/mock/users](http://localhost:3001/api/v1/mock/users)

---

## 🐳 Production Deployment (Docker Compose)

For production deployment with PostgreSQL, Redis, isolated k6 containers, and Nginx reverse proxy:

```bash
docker compose up -d --build
```

---

## 🧪 Automated Integration Verification

To run the automated end-to-end integration test (spawns real `k6.exe`, sends thousands of requests, streams live telemetry, and verifies SQLite persistence):

```bash
npx tsx tests/integration/test-k6-execution.ts
```

---

## 🔒 Security & Safety Defaults

| Feature | Default Setting | Environment Override |
| :--- | :--- | :--- |
| **SSRF Private IP Block** | Enabled (blocks `127.0.0.1`, `10.x`, etc.) | `ALLOW_LOCAL_TARGETS=true` for local dev |
| **Cloud Metadata Block** | Always blocked (`169.254.169.254`) | Cannot be bypassed |
| **Max Concurrent Tests** | 2 concurrent tests | `MAX_CONCURRENT_TESTS=5` |
| **Max Virtual Users** | 5,000 VUs | `MAX_VUS_CAP=10000` |
| **Max Duration** | 3,600 seconds (1 hour) | `MAX_DURATION_SECONDS=7200` |
| **Secret Encryption** | AES-256-GCM | `ENCRYPTION_KEY=<32-byte-hex>` |

---

## 📁 Monorepo Structure

```
k6-load-testing/
├── apps/
│   ├── backend/                      # Fastify v5 API & k6 Process Orchestrator
│   │   ├── src/
│   │   │   ├── config/               # Typed environment configuration
│   │   │   ├── db/                   # Prisma client singleton
│   │   │   ├── security/             # SSRF validator, AES-256 vault, log redactor
│   │   │   ├── services/             # K6Runner, MetricsAggregator, ExecutionService
│   │   │   ├── routes/               # API, Test, Execution, Report & Mock routes
│   │   │   └── app.ts                # Fastify instance builder
│   │   └── prisma/                   # SQLite (local) & PostgreSQL schemas
│   │
│   └── frontend/                     # React 19 Dashboard
│       ├── src/
│       │   ├── components/           # Navbar, MetricCard, VisualLoadCurve
│       │   ├── pages/                # Dashboard, TestBuilder, LiveMonitor, ReportView, History
│       │   └── services/             # REST client and SSE subscriber
│       └── package.json
│
├── packages/
│   ├── shared-types/                 # Universal TypeScript DTOs & Models
│   └── k6-engine/                    # Dynamic ES6 k6 script generation engine
│
├── infrastructure/                   # Dockerfiles and Nginx configuration
├── docker-compose.yml                # Multi-container production stack
└── package.json                      # Workspaces root
```
