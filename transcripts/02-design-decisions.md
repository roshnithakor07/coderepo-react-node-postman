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

The auth panel supports four types: none, bearer token, basic auth, and API key (in header or query param). Implementation detail: all four types are stored as a single `auth` subdocument on the `SavedRequest` model. At proxy time, `buildAuthHeaders()` and `buildAuthQueryParam()` read the `type` field and construct the appropriate headers or query params. Adding a new auth type only requires extending these two functions — no schema migration needed. Auth field values (`token`, `username`, `password`, `apiKeyValue`) go through the same `{{variable}}` substitution as the URL, headers, and params before the request is sent, so a bearer token stored as `{{apiKey}}` resolves against the active environment at send time, matching the placeholder text in the Auth tab's UI.

## Request History: Auto-Log, No User Action

History is logged automatically on every proxy call — success and failure both. The design decision was to log inside the proxy service rather than the proxy controller, so logging cannot be accidentally skipped if the controller changes. Each history entry stores the full request (method, URL, headers, body) and full response (status, headers, body, response time, size) so a history entry can be reloaded into the builder with full fidelity.

## Code Snippet Generation: Server-Side

The snippet generator runs on the backend (`/api/v1/snippets`) rather than in the frontend. This keeps the environment variable substitution logic in one place — `substituteVariables()`, `substituteAuth()`, and the `buildAuthHeaders`/`buildAuthHeaderParam`/`buildAuthQueryParam` helpers live in `backend/src/shared/utils/request-transform.js` and are imported by both the proxy service and the snippet service, so the snippet reflects the exact values, including resolved auth fields and body, that would actually be sent. These started out as separate copies in each service; consolidating them into one shared module was a direct fix for two bugs that copy had introduced — an API key with an empty value showed up in generated snippets even though the proxy correctly omitted it, and the snippet body never ran through variable substitution at all.

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

- **Alex Rivera** — primary demo account with 3 collections (API Sandbox, Sandbox REST API, Auth Playground), 19 saved requests covering all HTTP methods and all auth types, 3 environments (Development active, Production, Staging), and 5 history entries
- **Jordan Kim** — secondary account with a minimal setup (1 collection, 1 environment) to demonstrate account isolation
- **API Sandbox collection** — requests against the bundled local sandbox (`backend/src/features/sandbox`) using `{{baseUrl}}` from the active environment, including status code tests (201, 404) and delayed responses. The sandbox is a local stand-in for a public HTTP testing service like httpbin.org, so the app has no runtime dependency on the internet — see "Local Sandbox Instead of a Third-Party API" below.
- **Auth Playground collection** — dedicated requests for each auth type, pre-configured with the correct settings so reviewers can test auth without any setup

Every seeded request uses `{{baseUrl}}` so switching the active environment from Development to Production changes the target server with no other edits needed.

## Local Sandbox Instead of a Third-Party API

The seed data originally pointed example requests at `httpbin.org` and `jsonplaceholder.typicode.com`. That made the bundled demo — and the app's own installability — depend on outbound internet access and on two services staying up and unchanged. `backend/src/features/sandbox` replaces both: a small, unauthenticated Express router mounted at `/api/v1/sandbox` that echoes request method/headers/query/body (`/get`, `/post`, `/put`, `/patch`, `/delete`), returns a chosen status code or custom response headers, delays a response for the timing demo, checks bearer and basic auth, and serves a fixed in-memory `posts`/`comments`/`users` resource for the REST CRUD demo. It is intentionally unauthenticated and outside the account-scoped `/api/v1` surface (mounted before the `requireAuth` gate in `app.js`) because it plays the role of "some external API," not a product capability of the Postman clone — the request builder reaches it the exact same way it would reach any real external API, through the proxy's outbound `axios` call. The Development environment's `baseUrl` now points at `http://localhost:8000/api/v1/sandbox` instead of `https://httpbin.org`, and the seeded request URLs use `{{baseUrl}}` throughout, so the entire demo — collections, environments, auth flows, and history — works from a clean checkout with zero network access. The request builder itself is unaffected: nothing stops a user from pointing it at a real external API, that is the point of the tool.

## Response Viewer: JSON Tree, Color Mapping, and In-Response Search

Branch `feature/response-viewer-polish` added four things to the Pretty tab: JSON syntax highlighting, collapsible objects/arrays, Ctrl+F search with match count, and a "save response as .json" download. All hand-written — no dependency was added.

**Color mapping.** The task asked for highlighting "using existing color tokens," so rather than invent a new JSON-specific palette I mapped onto tokens already in `:root` that already carried roughly the right connotation: keys → `--info` (the same blue `.headers-table` already uses for header names, so a key now reads visually the same way a header name does), strings → `--success`, numbers → `--warning`, booleans → `--patch`, `null` → `--text-tertiary`, punctuation (braces/brackets/colons/commas) → `--text-secondary`. No new hex value was added to `:root`.

**Collapsing.** `JsonView.jsx` builds a real tree from the parsed JSON value (not a regex-fold over text) and tracks collapsed node paths in a `Set`. A non-JSON body (HTML, XML, plain text) still falls back to the original flat `<pre>` — `isJson()` (already in `shared/utils/format.js`) gates which one renders.

**Search architecture — two decisions worth recording:**

1. *Counting matches from the committed DOM, not during render.* The first implementation numbered matches with a ref mutated as a side effect of rendering (`matchCountRef.current++` inside the function that produces each `<mark>`). React 18 StrictMode (already enabled in `main.jsx`) double-invokes component render functions in development specifically to catch impure renders like this — `JsonView`'s render function gets called twice per commit, independently of its parent, so the shared counter silently doubled (12 matches reported for 6 actually on screen) while the DOM itself stayed correct. Fixed by making `highlightText()` a pure function of `(text, query)` with no counting side effect, and instead reading `containerRef.current.querySelectorAll("mark.search-match")` in a `useEffect` after commit — that list is guaranteed to match what's actually on screen, and DOM order is already the correct top-to-bottom navigation order for free.
2. *Search force-expands collapsed nodes.* A match inside a collapsed branch was originally invisible to search entirely (JsonView doesn't render children of a collapsed node, so `highlightText` was never even called on them). `JsonView` now accepts a `forceExpanded` prop; `ResponseViewer` passes `searchOpen && !!searchQuery`. This overrides display only — the user's own collapsed-state `Set` is untouched underneath, so closing the search bar returns every node to exactly how the user left it.

**Save-as-file scope.** The download button saves the raw response body text as `.json` (via `Blob` + object URL + a synthetic `<a download>`, no library) whenever a non-error response has a body; it's hidden entirely on error responses and disabled when there's no body, matching how "Clear response" is already scoped to the same conditions.

**Default expansion — a precise rule, not a heuristic.** After the virtualization rewrite made rendering cost independent of DOM size, "how much to expand by default" stopped being a performance question and became a pure UX one, so it's driven by a size threshold on the *data*, not the render cost: the root always starts expanded; a response under 500 total nodes (counted, not estimated) fully expands, matching Postman's own behavior on small responses; a larger response expands only the root plus first-level object properties, leaving big arrays/objects (like `/photos`' 5000-item root array) collapsed. Auto-expanding every item of a large array was deliberately rejected even though virtualization would make it cheap — doing so would erase the entire distinction "small vs. large" is meant to communicate to the user, turning every response into a wall of expanded text regardless of size.

**Search navigation's scroll bug — a lesson about `offsetTop`.** The first working version of the round-3 virtualization used `element.offsetTop` to convert a target row index into a scroll position. `offsetTop` is relative to the element's nearest CSS-*positioned* ancestor (its `offsetParent`), not necessarily its actual scroll container — here, `.response-body-wrap` (the real scroll container) has no `position` set, so `offsetTop` silently resolved against an unrelated ancestor further up the tree, and every scroll-to-match call moved the container to the wrong place while the match counter itself (unaffected, pure state) kept updating correctly — a bug that looks like "nothing happens" but is actually "the wrong thing happens, off-screen." Replaced with a `getBoundingClientRect()`-difference calculation between the container and the tree root, which is pure viewport geometry and correct regardless of what positioning (or lack of it) any ancestor happens to have. General takeaway kept here for future features: prefer `getBoundingClientRect()` math over `offsetTop`/`offsetLeft` whenever the scroll container isn't guaranteed to be the `offsetParent`.

## History API — proposed design for lightweight list + paginated detail (PENDING APPROVAL, NOT YET IMPLEMENTED)

`GET /api/v1/history` currently returns up to 100 full documents per account, including full `requestBody`/`responseBody`/`requestHeaders`/`responseHeaders` — measured at 26 MB for 35 accumulated test entries. Proposed change, not yet built, pending the user's confirmation since it changes an existing API's response shape:

- **List endpoint becomes summary-only**: `.select("method url status responseTime responseSize createdAt")`, no bodies/headers ever leave the database for a list call.
- **Pagination**: offset-based (`skip`/`limit`, default `limit=50`), chosen over a cursor for simplicity at this app's scale — flagged as a deliberate tradeoff, not a default assumed without noting it.
- **New `GET /api/v1/history/:id`** for full detail, reusing `history.repository.js`'s existing-but-unused `findById`.
- **Response envelope change**: list response becomes `{data: {items, hasMore}}` instead of `{data: HistoryEntry[]}` — an explicit API-shape change called out per the task's own instruction to flag any backend/API-shape change before implementing.
- **Body truncation on write**: `historyService.record()` (called from `proxy.service.js`) would truncate any `requestBody`/`responseBody` over ~1 MB before saving, setting a new `requestBodyTruncated`/`responseBodyTruncated` schema flag.
- **`createdAt` index**: already exists (`{accountId: 1, createdAt: -1}` in `history.model.js`) — no change needed.
- **Frontend consequence**: `App.jsx#handleSelectHistory` must become async and call the new detail endpoint before populating the builder, since it currently reads `requestHeaders`/`requestBody` straight off list entries that would no longer carry those fields.
- **Open question with no existing attachment point**: the app currently has no UI that displays a historical *response* at all (`handleSelectHistory` only reloads the request into the builder), so where a "body was truncated" note would surface in the UI is unresolved — noted for the user to decide rather than guessed at.