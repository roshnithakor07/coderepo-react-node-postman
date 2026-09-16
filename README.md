# Postman Clone

A full-stack Postman-inspired API client that lets developers compose, send, organize, and analyze HTTP requests. Built on the MERN stack with a dark-first design system that matches the reference calendar application in structure and quality.

## Technology stack

| Layer | Technology |
|---|---|
| Frontend framework | React 19 + Vite 8 |
| Backend framework | Express 5 (Node.js) |
| Database | MongoDB + Mongoose 8 |
| Package manager | Bun |
| Runtime | Bun (backend), Vite dev server (frontend) |
| Authentication | JSON Web Tokens (jsonwebtoken) |
| HTTP proxy | Axios (server-side request execution) |
| Validation | Zod |
| Styling | Custom CSS design system (no component library) |

## Project structure

```
coderepo-react-node-postman/
├── backend/
│   ├── src/
│   │   ├── features/
│   │   │   ├── auth/           # Login, session, JWT
│   │   │   ├── collections/    # Collections and saved requests CRUD
│   │   │   ├── environments/   # Named environments with variable substitution
│   │   │   ├── history/        # Auto-logged request history
│   │   │   ├── proxy/          # Core HTTP request execution engine
│   │   │   └── snippets/       # Code snippet generation
│   │   ├── scripts/
│   │   │   └── seed.js         # Deterministic database seed
│   │   ├── shared/
│   │   │   ├── config/         # Environment config and MongoDB connection
│   │   │   ├── errors/         # AppError class
│   │   │   └── middleware/     # Auth guard and error handler
│   │   ├── app.js              # Express app factory
│   │   └── index.js            # Server entry point
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── features/
│   │   │   ├── auth/           # Login page and auth API client
│   │   │   ├── collections/    # Save-request modal and collection API client
│   │   │   ├── environments/   # Environments manager modal and API client
│   │   │   ├── history/        # History API client
│   │   │   ├── request-builder/ # URL bar, method, params/auth/headers/body tabs
│   │   │   ├── response-viewer/ # Status, timing, body views, snippets
│   │   │   └── workspace/      # App header and sidebar
│   │   ├── shared/
│   │   │   ├── api/            # Fetch-based API client
│   │   │   └── utils/          # Formatting helpers and theme
│   │   ├── App.jsx             # Root component
│   │   ├── main.jsx            # React entry point
│   │   └── styles.css          # Complete CSS design system
│   ├── .env.example
│   ├── index.html
│   └── vite.config.js
├── skills/validate/            # Validator skill
├── transcripts/                # AI session transcripts
├── hackerrank.yml
├── package.json                # Bun workspace root
└── setup.sh                    # MongoDB check and seed runner
```

## Prerequisites

- [Bun](https://bun.sh) 1.x or later
- MongoDB 6.x or later running on `localhost:27017`

## MongoDB behavior

Connects to `mongodb://localhost:27017/postman_db`. Every full start resets the database to the seeded baseline. Seeded collections: WorkspaceAccount (2), Collection (4), SavedRequest (18), Environment (4), History (5).

## Run instructions

```bash
# Install all workspace dependencies and seed MongoDB
bun install && bash setup.sh --seed

# Start frontend (port 3000) and backend (port 8000)
bun start
```
Once started, open your browser at:

- **App:** http://localhost:3000
- **API:** http://localhost:8000/api/v1/health

## Command reference

| Command | Purpose |
|---|---|
| `bun install && bash setup.sh --seed` | Full install and seed |
| `bun start` | Start both servers |
| `bun run dev:backend` | Backend only with file watcher |
| `bun run dev:frontend` | Frontend only with Vite HMR |
| `bun run seed` | Re-seed the database |

## Seeded access

| Name | Email | Password |
|---|---|---|
| Alex Rivera | alex.rivera@postman.dev | password123 |
| Jordan Kim | jordan.kim@postman.dev | password123 |

## Features

1. **API request builder** — Method selector, URL bar with `{{variable}}` placeholder support, tabbed Params / Auth / Headers / Body panels.
2. **HTTP response analysis** — Status code badge (color-coded by class), response time, response size, Pretty / Raw / Headers views.
3. **Request collections** — Folder tree, create and rename collections, save requests, load saved requests into the builder.
4. **Environment management** — Named environments with key-value variables; activate via dropdown; variables resolved at send time.
5. **Authentication support** — Bearer token, HTTP Basic, API key in header or query param; auto-injected into requests.
6. **Request history** — Every sent request auto-logged to MongoDB; click any entry to reload.
7. **Code snippet generation** — curl, fetch, axios, Python snippets with live variable substitution.
8. **Resizable panels** — Drag the splitter between builder and viewer.
