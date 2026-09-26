# Reqway

A full-stack Postman-inspired API client that lets developers compose, send, organize, and analyze HTTP requests — built on the MERN stack with a dark-first design system.

---

## Technology stack

| Layer              | Technology                                                                                                                                                                   |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frontend framework | React 19 + Vite 8                                                                                                                                                            |
| Backend framework  | Express 5 (Node.js)                                                                                                                                                          |
| Database           | MongoDB + Mongoose 8                                                                                                                                                         |
| Package manager    | Bun                                                                                                                                                                          |
| Runtime            | Bun (backend), Vite dev server (frontend)                                                                                                                                    |
| Authentication     | JSON Web Tokens (jsonwebtoken)                                                                                                                                               |
| HTTP proxy         | Axios (server-side request execution) — kept because the proxy relies on its status-agnostic responses, 30 s timeout, decompression and query serialization (`axios.getUri`) |
| Validation         | Zod                                                                                                                                                                          |
| Styling            | Custom CSS design system (no component library)                                                                                                                              |

---

## Project structure

```
coderepo-react-node-postman/
├── backend/
│   ├── src/
│   │   ├── features/
│   │   │   ├── auth/            # Login, session, JWT
│   │   │   ├── collections/     # Collections and saved requests (unique names, clone placement)
│   │   │   ├── environments/    # Named environments with variable substitution
│   │   │   ├── history/         # Auto-logged request history (paginated list + detail)
│   │   │   ├── proxy/           # Core HTTP request execution engine
│   │   │   ├── sandbox/         # Local, offline HTTP test target (stands in for a public API like httpbin.org)
│   │   │   └── snippets/        # Code snippet generation
│   │   ├── scripts/
│   │   │   └── seed.js          # Deterministic database seed
│   │   ├── shared/
│   │   │   ├── config/          # Environment config and MongoDB connection
│   │   │   ├── errors/          # AppError class
│   │   │   ├── middleware/      # Auth guard and error handler
│   │   │   └── utils/           # Variable substitution, auth headers, partial-update schemas
│   │   ├── app.js               # Express app factory
│   │   ├── app.test.js          # End-to-end API tests (disposable MongoDB database)
│   │   └── index.js             # Server entry point
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── features/
│   │   │   ├── auth/            # Login page and auth API client
│   │   │   ├── collections/     # Save dialog, collection API client, saved-request helpers
│   │   │   ├── environments/    # Environments manager modal and API client
│   │   │   ├── history/         # History API client
│   │   │   ├── request-builder/ # URL bar, method, params/auth/headers/body tabs, key-value editor
│   │   │   ├── response-viewer/ # Status, timing, JSON tree, search, raw/headers, snippets
│   │   │   └── workspace/       # App header and sidebar
│   │   ├── shared/
│   │   │   ├── api/             # Fetch-based API client
│   │   │   ├── components/      # Action menu, confirm dialog, toasts, icons
│   │   │   └── utils/           # Formatting helpers
│   │   ├── App.jsx              # Root component
│   │   ├── main.jsx             # React entry point
│   │   └── styles.css           # Complete CSS design system
│   ├── .env.example
│   ├── index.html
│   └── vite.config.js
├── .vscode/launch.json          # Debug configs: full app, backend only
├── skills/validate/             # Validator skill (not exported)
├── transcripts/                 # AI session transcripts and design decisions
├── AGENTS.md                    # Agent instructions
├── GUIDELINES.md                # Acceptance guidelines (not exported)
├── hackerrank.yml               # HackerRank install and run configuration
├── package.json                 # Bun workspace root
├── bun.lock
└── setup.sh                     # MongoDB check and seed runner
```

---

## Prerequisites

Install these before running the project. Follow each step carefully.

### 1. Install Node.js (v18 or later)

**Ubuntu / Debian / WSL:**

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version   # should print v20.x.x
```

**macOS:**

```bash
brew install node
node --version
```

**Windows:** Download from https://nodejs.org and install.

---

### 2. Install Bun (package manager)

**Linux / macOS / WSL:**

```bash
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc        # or restart your terminal
bun --version           # should print 1.x.x
```

**Alternative (via npm):**

```bash
npm install -g bun
bun --version
```

---

### 3. Install MongoDB

**Ubuntu / Debian / WSL:**

```bash
# Import MongoDB public key
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | \
  sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor

# Add MongoDB repo
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] \
  https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | \
  sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list

# Install
sudo apt-get update
sudo apt-get install -y mongodb-org

# Start MongoDB
sudo systemctl start mongod
sudo systemctl enable mongod   # auto-start on boot

# Verify it is running
mongod --version
```

**macOS:**

```bash
brew tap mongodb/brew
brew install mongodb-community
brew services start mongodb-community
```

**Windows:** Download from https://www.mongodb.com/try/download/community and install as a service.

---

### 4. Verify everything is ready

Run these 3 commands — all should return a version number:

```bash
node --version    # v20.x.x
bun --version     # 1.x.x
mongod --version  # db version v7.x.x
```

---

## Installation and setup

```bash
# 1. Clone the repository
git clone https://github.com/roshnithakor07/coderepo-react-node-postman.git
cd coderepo-react-node-postman

# 2. Make sure MongoDB is running
sudo systemctl start mongod        # Linux / WSL
# brew services start mongodb-community   # macOS

# 3. Install all dependencies and seed the database
bun install && bash setup.sh --seed

# 4. Start the app
bun start
```

---

## Access the app

Once `bun start` is running, open your browser:

| Service                  | URL                                 |
| ------------------------ | ----------------------------------- |
| **Web App (Frontend)**   | http://localhost:3000               |
| **API Server (Backend)** | http://localhost:8000               |
| **API Health Check**     | http://localhost:8000/api/v1/health |

---

## MongoDB behavior

Connects to `mongodb://localhost:27017/postman_db`.

> ⚠️ Every time the app starts, it **resets the database** to the seeded baseline. Any data added during a session will be cleared on the next start. This is by design for the assessment environment.

**Seeded data counts:**

| Collection       | Count |
| ---------------- | ----- |
| WorkspaceAccount | 2     |
| Collection       | 4     |
| SavedRequest     | 20    |
| Environment      | 4     |
| History          | 5     |

---

## Seeded demo accounts

Use these to log in — no registration needed:

| Name        | Email                   | Password    |
| ----------- | ----------------------- | ----------- |
| Alex Rivera | alex.rivera@postman.dev | password123 |
| Jordan Kim  | jordan.kim@postman.dev  | password123 |

> Alex Rivera has the full set of seeded collections, environments, and history. Jordan Kim has a minimal setup.

> `JWT_SECRET` in `backend/.env.example` is a **demo value** for local development; use your own secret for anything real.

---

## Command reference

| Command                               | What it does                                                                                                           |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `bun install && bash setup.sh --seed` | Install dependencies + seed MongoDB                                                                                    |
| `bun start`                           | Start frontend (port 3000) + backend (port 8000) together                                                              |
| `bun run dev:frontend`                | Start frontend only with Vite HMR                                                                                      |
| `bun run dev:backend`                 | Start backend only with file watcher                                                                                   |
| `bun run seed`                        | Re-seed the database without restarting                                                                                |
| `bun test`                            | Run all tests — backend API tests and frontend unit tests (needs MongoDB running; API tests use a disposable database) |
| `cd frontend && bun run build`        | Production build of the frontend                                                                                       |

---

## Troubleshooting

**`bun: command not found`**

```bash
source ~/.bashrc    # reload shell
# or restart your terminal
```

**`MongoDB connection failed`**

```bash
sudo systemctl start mongod      # Linux/WSL
brew services start mongodb-community  # macOS
```

**`Port 3000 or 8000 already in use`**

```bash
# Kill whatever is using the port
sudo lsof -ti:3000 | xargs kill -9
sudo lsof -ti:8000 | xargs kill -9
# Then start again
bun start
```

**`bun install fails`**

```bash
# Try clearing cache
bun pm cache rm
bun install
```

---

## Features

1. **API request builder** — Method selector, URL bar with `{{variable}}` highlighting and live two-way sync with the Params tab, tabbed Params / Auth / Headers / Body panels. Key-value tables add a row as you type, have an optional description column, hover/focus-revealed delete, and a **bulk edit** mode (`key:value` per line, `//` to disable) that round-trips without data loss.
2. **HTTP response analysis** — Status badge, response time and size. Pretty view is a collapsible **JSON tree** (virtualized, smooth on very large responses) with **Expand all / Collapse all** and **in-response search** (match count, next/previous with wrap-around). Raw and Headers views; save the response as a file.
3. **Request collections** — Create, rename, and delete collections. Save a request, and **Save** again to update it in place (unsaved-changes indicator; **Save as new…** for a copy). Each saved request's ⋯ menu: **Clone** (placed directly below the original, then opened for renaming), **Copy** (the URL, with `{{variables}}` unresolved), **Rename**, **Delete**. Request names are **unique within a collection** (case-insensitive).
4. **Environment management** — Named environments with key-value variables, activated from the header dropdown; `{{variables}}` are resolved at send time.
5. **Authentication support** — Per-request Bearer token, HTTP Basic, or API key (header or query), injected into outgoing requests.
6. **Request history** — Every sent request is logged. Browse with **Load more** pagination, click an entry to reload it, delete single entries (hover ×) or clear all.
7. **Code snippet generation** — curl, fetch, axios, or Python for the current request, with environment variables substituted. One-click copy.
8. **Resizable layout** — Drag the request/response divider (from the request tabs bar down to the response header) and resize the sidebar.
9. **Keyboard shortcuts** — `Ctrl/⌘+Enter` sends from the URL bar; `Ctrl/⌘+F` searches the response, `Enter` / `Shift+Enter` move between matches, `Esc` closes. ⋯ menus open with `Enter` or `↓`, move with `↑`/`↓`, select with `Enter`, close with `Esc`; inline renames confirm with `Enter` and cancel with `Esc`.

---

## Architecture & decisions

- **Backend:** Express 5 on Bun, one folder per feature (`routes → controller → service → repository → Mongoose model`). Controllers validate with Zod, services hold business rules (e.g. unique request names, clone placement), repositories own all database access. Errors go through one handler that returns concise JSON errors with proper status codes (400/401/404/409), never stack traces.
- **Frontend:** React 19 + Vite, one folder per feature with its own API client; shared components (action menu, dialogs, toasts) and a single CSS design system of tokens. No component, state, or icon libraries.
- **Data:** MongoDB via Mongoose; every start re-seeds a deterministic baseline.

The reasoning behind the notable choices is recorded in **[transcripts/02-design-decisions.md](transcripts/02-design-decisions.md)**. For example: the dependency freeze, the virtualized JSON tree, partial updates that never reset unsent fields, the history API's summary list, blocking duplicate request names, and the keyboard-accessible menu.
