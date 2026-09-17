# Feature Design Notes — Postman Clone

These notes capture key design decisions made during development.

## Why MongoDB over SQLite or PostgreSQL

The REQUIREMENTS.md is explicit: "persists data in MongoDB." The reference calendar repo uses Mongoose throughout. I followed this exactly — no SQL, no migrations, no relational schema. MongoDB's document model maps naturally to the nested structure of a saved request: headers, params, body, and auth config all live in one document. Reading a saved request never needs a JOIN.

## Auth Architecture Decision

The calendar app uses a two-token system. The Postman clone's auth is simpler — one account, one workspace session. I collapsed this to a single JWT that encodes `sub` (accountId), `type`, issuer, and audience. The frontend stores it in `localStorage` under `postman-session-token`. On 401, a custom DOM event (`postman-session-expired`) fires and the App root listener clears all state and redirects to login. This keeps auth logic out of every API client.

## Proxy on the Backend, Not the Frontend

The most important architectural decision: the HTTP proxy runs server-side using `axios`, not client-side using `fetch`. Reasons:

1. **CORS** — any target API can block browser requests. The backend proxy has no CORS restrictions.
2. **Auth header injection** — bearer tokens, basic auth base64 encoding, and API key placement all happen server-side, keeping logic in one place.
3. **History logging** — every request is auto-logged to MongoDB in the same transaction as the proxy call. If the proxy ran client-side, the frontend would have to make a second API call to log it.
4. **Environment variable substitution** — `{{variable}}` replacement happens server-side against the active environment fetched from the database.

The reference calendar app has no proxy feature, so I modelled this after real Postman's architecture.

## Environment Variable Substitution Design

I chose `{{variable}}` syntax to match real Postman exactly. Substitution runs at send time, not at save time. This means:

- A saved request stores the raw `{{baseUrl}}/users` string
- When sent, the proxy service fetches the active environment's variables and replaces all `{{key}}` occurrences before making the outbound HTTP call
- If no environment is active, the raw string is sent as-is (no substitution error)

This design lets one saved request work correctly across Development, Staging, and Production environments by just switching the active environment.

## Collections and Saved Requests: Two Models

I debated whether to embed saved requests inside the collection document or use a separate `SavedRequest` collection. A separate collection won for these reasons:

1. Collections with many requests would hit MongoDB's 16MB document size limit
2. Requests are frequently queried independently (by history reload, by collection listing)
3. The reference calendar app uses the same pattern for events and attendees

Each `SavedRequest` has a `collectionId` foreign key and an `accountId` for security — every query filters by both.

## Authentication Support: Four Types

The auth panel supports four types: none, bearer token, basic auth, and API key (in header or query param). Implementation detail: all four types are stored as a single `auth` subdocument on the `SavedRequest` model. At proxy time, `buildAuthHeaders()` and `buildAuthQueryParam()` read the `type` field and construct the appropriate headers or query params. Adding a new auth type only requires extending these two functions — no schema migration needed.

## Request History: Auto-Log, No User Action

History is logged automatically on every proxy call — success and failure both. The design decision was to log inside the proxy service rather than the proxy controller, so logging cannot be accidentally skipped if the controller changes. Each history entry stores the full request (method, URL, headers, body) and full response (status, headers, body, response time, size) so a history entry can be reloaded into the builder with full fidelity.

## Code Snippet Generation: Server-Side

The snippet generator runs on the backend (`/api/v1/snippets`) rather than in the frontend. This keeps the environment variable substitution logic in one place — the same `substituteVariables()` function used by the proxy is called before generating the snippet, so the snippet reflects the actual values that would be sent.

Four languages are supported: `curl`, `fetch` (modern browser/Node.js), `axios` (most common Node.js HTTP client), and `python` (requests library). These cover the vast majority of real-world API client use cases.

## CSS Design System: No Component Library

The guidelines prohibit adding new dependencies beyond the reference app's package.json. No Tailwind, no Radix, no MUI. The entire design system is built with CSS custom properties (design tokens) covering surfaces, borders, text hierarchy, method colors, and status colors — separately defined for dark and light themes. Key decisions:

- **Inter font** for UI text (system-quality, used by Notion, Linear, Vercel)
- **JetBrains Mono** for all monospace content: URLs, request bodies, response bodies, header values, method badges, status codes
- **Method badges** as pill-shaped spans with per-method color tints (GET green, POST blue, PUT yellow, DELETE red) matching real Postman's visual language
- **Status badges** in monospace with colored backgrounds matching HTTP status class (2xx green, 3xx yellow, 4xx orange, 5xx red)
- **Focus rings** use `box-shadow: 0 0 0 3px var(--brand-dim)` instead of `outline` for a polished look consistent across browsers

## Resizable Panels: Flex-Basis Splitter

The request builder and response viewer are separated by a draggable splitter. Implementation uses `flex: 0 0 ${pct}%` on the top pane and `flex: 1 1 ${100-pct}%` on the bottom pane, with a `mousemove` listener on `window` during drag. This approach was chosen over `height: ${pct}%` because percentage height only works when the parent has an explicit height — flex-basis works reliably in a flex column container regardless of parent height.

## Seed Data Design

The seed creates realistic, immediately usable data:

- **Alex Rivera** — primary demo account with 3 collections (HTTPBin, JSONPlaceholder, Auth Playground), 18 saved requests covering all HTTP methods and all auth types, 3 environments (Development active, Production, Staging), and 5 history entries
- **Jordan Kim** — secondary account with a minimal setup (1 collection, 1 environment) to demonstrate account isolation
- **HTTPBin collection** — requests that return real data from httpbin.org using `{{baseUrl}}` from the active environment, including status code tests (201, 404) and delayed responses
- **Auth Playground collection** — dedicated requests for each auth type, pre-configured with the correct settings so reviewers can test auth without any setup

Every seeded request uses `{{baseUrl}}` so switching the active environment from Development to Production changes the target server with no other edits needed.