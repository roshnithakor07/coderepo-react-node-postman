# Postman Clone

A full-stack Postman-inspired API client that lets developers compose, send, organize, and analyze HTTP requests — built on the MERN stack with a dark-first design system.

![Stack](https://img.shields.io/badge/React-19-blue) ![Stack](https://img.shields.io/badge/Express-5-green) ![Stack](https://img.shields.io/badge/MongoDB-8-brightgreen) ![Stack](https://img.shields.io/badge/Bun-1.x-orange)

---

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

---

## Project structure

```
coderepo-react-node-postman/
├── backend/
│   ├── src/
│   │   ├── features/
│   │   │   ├── auth/            # Login, session, JWT
│   │   │   ├── collections/     # Collections and saved requests CRUD
│   │   │   ├── environments/    # Named environments with variable substitution
│   │   │   ├── history/         # Auto-logged request history
│   │   │   ├── proxy/           # Core HTTP request execution engine
│   │   │   └── snippets/        # Code snippet generation
│   │   ├── scripts/
│   │   │   └── seed.js          # Deterministic database seed
│   │   ├── shared/
│   │   │   ├── config/          # Environment config and MongoDB connection
│   │   │   ├── errors/          # AppError class
│   │   │   └── middleware/      # Auth guard and error handler
│   │   ├── app.js               # Express app factory
│   │   └── index.js             # Server entry point
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── features/
│   │   │   ├── auth/            # Login page and auth API client
│   │   │   ├── collections/     # Save-request modal and collection API client
│   │   │   ├── environments/    # Environments manager modal and API client
│   │   │   ├── history/         # History API client
│   │   │   ├── request-builder/ # URL bar, method, params/auth/headers/body tabs
│   │   │   ├── response-viewer/ # Status, timing, body views, snippets
│   │   │   └── workspace/       # App header and sidebar
│   │   ├── shared/
│   │   │   ├── api/             # Fetch-based API client
│   │   │   └── utils/           # Formatting helpers and theme
│   │   ├── App.jsx              # Root component
│   │   ├── main.jsx             # React entry point
│   │   └── styles.css           # Complete CSS design system
│   ├── .env.example
│   ├── index.html
│   └── vite.config.js
├── skills/validate/             # Validator skill
├── transcripts/                 # AI session transcripts
├── hackerrank.yml
├── package.json                 # Bun workspace root
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

| Service | URL |
|---|---|
| **Web App (Frontend)** | http://localhost:3000 |
| **API Server (Backend)** | http://localhost:8000 |
| **API Health Check** | http://localhost:8000/api/v1/health |

---

## MongoDB behavior

Connects to `mongodb://localhost:27017/postman_db`.

> ⚠️ Every time the app starts, it **resets the database** to the seeded baseline. Any data added during a session will be cleared on the next start. This is by design for the assessment environment.

**Seeded data counts:**

| Collection | Count |
|---|---|
| WorkspaceAccount | 2 |
| Collection | 4 |
| SavedRequest | 18 |
| Environment | 4 |
| History | 5 |

---

## Seeded demo accounts

Use these to log in — no registration needed:

| Name | Email | Password |
|---|---|---|
| Alex Rivera | alex.rivera@postman.dev | password123 |
| Jordan Kim | jordan.kim@postman.dev | password123 |

> Alex Rivera has the full set of seeded collections, environments, and history. Jordan Kim has a minimal setup.

---

## Command reference

| Command | What it does |
|---|---|
| `bun install && bash setup.sh --seed` | Install dependencies + seed MongoDB |
| `bun start` | Start frontend (port 3000) + backend (port 8000) together |
| `bun run dev:frontend` | Start frontend only with Vite HMR |
| `bun run dev:backend` | Start backend only with file watcher |
| `bun run seed` | Re-seed the database without restarting |

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

1. **API request builder** — Method selector, URL bar with `{{variable}}` placeholder support, tabbed Params / Auth / Headers / Body panels. Press `Ctrl+Enter` to send.
2. **HTTP response analysis** — Status code badge (color-coded by class), response time, response size, Pretty / Raw / Headers views.
3. **Request collections** — Folder tree, create and rename collections, save any request with one click, reload saved requests into the builder.
4. **Environment management** — Named environments (Development, Production, Staging) with key-value variables. Activate via the header dropdown. Variables like `{{baseUrl}}` are resolved at send time.
5. **Authentication support** — Per-request Bearer token, HTTP Basic (auto base64-encoded), API key in header or query param. Auto-injected into outgoing requests.
6. **Request history** — Every sent request is auto-logged to MongoDB. Browse in the History sidebar tab and click any entry to reload it into the builder.
7. **Code snippet generation** — Generate curl, fetch, axios, or Python snippets for the current request with live environment variable substitution. One-click copy.
8. **Resizable panels** — Drag the splitter between the request builder and response viewer to adjust the layout.