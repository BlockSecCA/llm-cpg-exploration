# Results

Two-pass analysis against `~/public/vulnerable-app` using Joern (CPG) and GitNexus (code knowledge graph).
See `questions.md` for the plan, tool mapping, and CWE rationale.

## Pass 1: Structural extraction

### S1 — Route registration patterns

**Question:** Where are routes registered? Centralized or scattered?

**GitNexus:** "Routes" cluster has 227 symbols with 56% cohesion. Members include handler function names (`addWalletBalance`, `promotionVideo`, `errorHandler`, `searchProducts`, etc.) and their files (`routes/*.ts`, `server.ts`). Semantic query for "route registration" returned mostly frontend Angular components, not server-side registrations. Cluster view identified that route handlers exist and where they live, but nothing about HTTP methods, paths, or middleware arguments.

**Joern CPGQL:**
```scala
// Count all app.verb() calls
cpg.call.name("get|post|put|delete|use|patch")
  .where(_.code("^app\\.(get|post|put|delete|use|patch).*")).l.size
// → 455 total (166 in server.ts, rest in data/static/codefixes/ — challenge fix snippets, not real routes)

// Breakdown by HTTP method (server.ts only)
cpg.call.name("get|post|put|delete|use|patch")
  .where(_.code("^app\\.(get|post|put|delete|use|patch).*"))
  .where(_.file.name("server\\.ts"))
  .map(c => c.name).groupBy(identity).map { case (k, v) => (k, v.size) }.l
// → GET: 51, POST: 40, PUT: 12, DELETE: 5, PATCH: 1, USE: 57

// Full route listing with paths and middleware
cpg.call.name("get|post|put|delete|patch")
  .where(_.code("^app\\.(get|post|put|delete|patch).*"))
  .where(_.file.name("server\\.ts"))
  .map(c => (c.name, c.code.take(150), c.lineNumber.getOrElse(-1)))
  .l.sortBy(_._3)
```

**Result:** Centralized — all 109 route registrations in `server.ts` (lines 213-713), plus 57 `app.use()` middleware registrations. Three route groups visible:
- `/api/*` — REST CRUD with `security.*` middleware (lines 357-448)
- `/rest/*` — custom REST endpoints, mixed auth (lines 589-637)
- Top-level — `/redirect`, `/profile`, `/promotion`, `/snippets/*`, etc. (lines 651-665)

Note: 289 additional `app.verb()` matches in `data/static/codefixes/` are challenge fix snippets, not live routes. Must filter to `server.ts` for real registrations.

**Tool verdict:** GitNexus — orientation only. Found the right cluster and files but operates at symbol level: knows handler functions exist, can't see how they're registered. Joern — answered fully. Expression-level access to every `app.verb()` call with path, middleware arguments, and line numbers.

**Extracted fact:** All routes registered centrally in `server.ts`. 109 route handlers (51 GET, 40 POST, 12 PUT, 5 DELETE, 1 PATCH). Three groups: `/api/*`, `/rest/*`, top-level. Pass 2 can query this file exclusively for route analysis.

---

### S2 — Middleware inventory

**Question:** What middleware functions are used in route registration?

**GitNexus:** Skipped — marked "Can't answer" in plan. Middleware lives in call arguments to route registration expressions, not as standalone symbols.

**Joern CPGQL:**
```scala
// Per-route middleware: all non-path, non-receiver arguments from app.verb() calls
cpg.call.name("get|post|put|delete|patch")
  .where(_.code("^app\\.(get|post|put|delete|patch).*"))
  .where(_.file.name("server\\.ts"))
  .flatMap(c => c.argument.filterNot(_.argumentIndex == 0)
    .filterNot(_.argumentIndex == 1)
    .map(a => a.code.take(80)))
  .groupBy(identity).map { case (k, v) => (k, v.size) }.l.sortBy(-_._2)

// Global middleware: all app.use() calls
cpg.call.name("use")
  .where(_.code("^app\\.use.*"))
  .where(_.file.name("server\\.ts"))
  .map(c => (c.code.take(120), c.lineNumber.getOrElse(-1)))
  .l.sortBy(_._2)
```

**Result:**

Per-route middleware (by usage count, reused across routes):
| Middleware | Count | Purpose |
|-----------|-------|---------|
| `security.appendUserId()` | 17 | Injects user ID from JWT |
| `security.denyAll()` | 12 | Blocks all access (admin-only endpoints) |
| `security.isAuthorized()` | 11 | JWT auth check |
| `rateLimit({...})` | 3 | Rate limiting (inline config) |
| `ensureFileIsPassed` | 3 | File upload guard |
| `uploadToMemory.single('file')` | 3 | Multer memory upload |
| `metrics.observeFileUploadMetricsMiddleware()` | 3 | Upload metrics |
| `security.updateAuthenticatedUsers()` | 2 | Tracks logged-in users |
| `security.isAccounting()` | 2 | Accounting role check |

Global middleware (57 `app.use()` calls), notable entries:
- **Security headers:** `compression`, `cors`, `helmet.noSniff`, `helmet.frameguard`, `featurePolicy`
- **Body parsing:** `bodyParser.urlencoded`, `bodyParser.text`, custom JSON parser, `cookieParser`
- **Auth scoping:** `app.use('/rest/basket', security.isAuthorized(), security.appendUserId())`, `app.use('/api/BasketItems', security.isAuthorized())`, etc.
- **Rate limiting:** `app.use('/rest/user/reset-password', rateLimit({...}))` — path-scoped
- **Logging:** `morgan('combined', ...)`
- **Error handling:** `verify.errorHandlingChallenge()`, `errorhandler()` (lines 670-671)
- **Challenge verification:** `verify.jwtChallenges()`, `verify.databaseRelatedChallenges()`, `verify.accessControlChallenges()`, `verify.serverSideChallenges()`

**Tool verdict:** GitNexus — can't answer (expression-level data). Joern — answered fully. Every middleware extracted with usage count and location.

**Extracted fact:** Security middleware namespace is `security.*` with 5 functions: `isAuthorized` (11), `appendUserId` (17), `denyAll` (12), `updateAuthenticatedUsers` (2), `isAccounting` (2). Auth is also applied via `app.use()` scoping on paths. `verify.*` namespace handles challenge-specific checks. Rate limiting is inline `rateLimit()`, not a named middleware.

---

### S3 — Auth/security middleware identification

**Question:** Which middleware functions look like auth/security?

**GitNexus:**

Semantic query for "security auth authorize isAuthorized middleware" returned noisy results — frontend 2FA components, `dataExport` flows, challenge codefixes mixed in with relevant hits.

`context()` lookups on `isAuthorized`, `appendUserId`, `denyAll` each correctly located them in `lib/insecurity.ts` with their callers (server.ts + codefix files).

Cypher query for all functions in `lib/insecurity.ts` with community labels — **this was the most useful result.** Found 19 functions in the security module:

| Function | Community | Role |
|----------|-----------|------|
| `isAuthorized` | (not returned — but found via context) | Auth middleware |
| `denyAll` | (not returned — but found via context) | Access blocking |
| `appendUserId` | Routes | JWT user injection |
| `updateAuthenticatedUsers` | Routes | Auth tracking |
| `isAccounting` | Routes | Role check |
| `isDeluxe` | Routes | Role check |
| `isCustomer` | Routes | Role check |
| `authorize` | Codefixes | Auth (not used as middleware) |
| `verify` | Routes | JWT verification |
| `decode` | Routes | JWT decode |
| `hash` | Codefixes | Password hashing |
| `hmac` | Routes | HMAC signing |
| `sanitizeHtml` | Models | Input sanitization |
| `sanitizeLegacy` | Models | Input sanitization |
| `sanitizeSecure` | Models | Input sanitization |
| `deluxeToken` | Routes | Token generation |
| `isRedirectAllowed` | Routes | Redirect validation |
| `discountFromCoupon` | Routes | Coupon logic |
| `hasValidFormat` | Routes | Format validation |
| `cutOffPoisonNullByte` | Routes | Security filter |
| `generateCoupon` | Cluster_3 | Coupon generation |

**Joern CPGQL:**

Already answered in S2 — the 5 functions from `security.*` namespace actually used as route middleware:
- `security.isAuthorized()` — 11 routes
- `security.appendUserId()` — 17 routes
- `security.denyAll()` — 12 routes
- `security.updateAuthenticatedUsers()` — 2 routes
- `security.isAccounting()` — 2 routes

**Result:** The security module is `lib/insecurity.ts` with 19 functions. 5 are used as route middleware (from S2). The other 14 are security-relevant functions used elsewhere — JWT operations (`verify`, `decode`), role checks (`isDeluxe`, `isCustomer`), sanitization, crypto. These aren't middleware but matter for D3 (fan-in analysis).

**Tool verdict:** Both contributed different things. GitNexus found the **complete security module** (19 functions, community membership) — broader discovery. Joern identified **which 5 are used as middleware** — precise role. GitNexus couldn't distinguish middleware usage from other call patterns; Joern couldn't discover the full module without being told the file name. Complementary result.

**Extracted fact:** Auth middleware: `isAuthorized`, `appendUserId`, `denyAll`, `updateAuthenticatedUsers`, `isAccounting` — all in `lib/insecurity.ts`, imported as `security` in `server.ts`. Full security module has 14 additional functions relevant for D3 fan-in analysis. Note: the file is named `insecurity.ts` — intentionally insecure implementations (this is a vulnerable-by-design app).

---

### S4 — ORM/DB operation locations

**Question:** What DB operations exist and where?

**GitNexus:**

Semantic query found DB-related functions: `data/datacreator.ts` (createChallenges, createUsers, createHints, etc.), route handlers in `routes/address.ts`, `routes/payment.ts`, `routes/delivery.ts`, `routes/memory.ts`. Identified files that touch the database but not specific ORM method calls.

"Data" community (32 members): datacreator functions, static data loaders, `addMemory`, `addReview`, `downloadToFile`. Gives architectural grouping of data-layer code.

"Models" community (8 members): `sanitizeHtml/Legacy/Secure`, model `set` hooks, `relationsInit`, `makeKeyNonUpdatable`. Reveals the model layer has sanitization and field protection logic.

**Joern CPGQL:**
```scala
cpg.call.name("findOne|findAll|findByPk|findAndCountAll|create|update|destroy|increment|decrement|bulkCreate|upsert")
  .map(c => (c.name, c.file.name.headOption.getOrElse("?"), c.lineNumber.getOrElse(-1)))
  .l.groupBy(_._2)
  .map { case (file, calls) => (file, calls.map(_._1).groupBy(identity)
    .map { case (k, v) => s"$k(${v.size})" }.mkString(", ")) }
  .l.sortBy(_._1)
```

**Result:**

Joern found Sequelize calls in 50 files. Filtering to server-side route/lib files (excluding `data/static/codefixes/`, `frontend/`, `three.js`):

| File | Operations |
|------|-----------|
| `routes/verify.ts` | findAndCountAll(19) |
| `routes/order.ts` | findOne(4), update(2), destroy(1), increment(1), decrement(1) |
| `routes/deluxe.ts` | findOne(3), update(1), decrement(1) |
| `routes/2fa.ts` | findByPk(3) |
| `routes/likeProductReviews.ts` | findOne(2), update(2) |
| `routes/basketItems.ts` | findOne(2) |
| `routes/wallet.ts` | findOne(2), increment(1) |
| `routes/profileImageUrlUpload.ts` | findByPk(2) |
| `routes/continueCode.ts` | findAll(2) |
| `routes/dataErasure.ts` | findOne(1), findByPk(1), create(1) |
| `routes/changePassword.ts` | findByPk(1), update(1) |
| `routes/chatbot.ts` | findByPk(1), update(1) |
| `routes/coupon.ts` | findByPk(1), update(1) |
| `routes/resetPassword.ts` | findOne(1), findByPk(1) |
| `routes/securityQuestion.ts` | findOne(1), findByPk(1) |
| `routes/updateUserProfile.ts` | findByPk(1), update(1) |
| `routes/profileImageFileUpload.ts` | findByPk(1), update(1) |
| `routes/address.ts` | findAll(1), findOne(1), destroy(1) |
| `routes/payment.ts` | findAll(1), findOne(1), destroy(1) |
| `routes/delivery.ts` | findAll(1), findOne(1) |
| `routes/memory.ts` | findAll(1), create(1) |
| `routes/imageCaptcha.ts` | findAll(1), create(1) |
| `routes/search.ts` | findAll(1) |
| `routes/dataExport.ts` | findAll(1) |
| `routes/recycles.ts` | findAll(1) |
| `routes/authenticatedUsers.ts` | findAll(1) |
| `routes/basket.ts` | findOne(1) |
| `routes/captcha.ts` | findOne(1) |
| `routes/saveLoginIp.ts` | findByPk(1) |
| `routes/userProfile.ts` | findByPk(1) |
| `routes/orderHistory.ts` | update(1) |
| `routes/updateProductReviews.ts` | update(1) |
| `data/datacreator.ts` | create(19), destroy(2), update(1) |
| `lib/challengeUtils.ts` | update(2) |
| `lib/insecurity.ts` | update(3) |
| `lib/botUtils.ts` | findAll(1) |
| `lib/utils.ts` | update(1) |
| `server.ts` | create(1) |

Note: `create`, `update`, `destroy` are generic names — some matches may be non-Sequelize (e.g., `lib/insecurity.ts:update` might be JWT-related). Joern can't distinguish Sequelize calls from identically-named methods on other objects without receiver type analysis.

**Tool verdict:** GitNexus identified the architectural grouping — "Data" and "Models" communities, which files are DB-related. Useful for orientation but can't enumerate specific method calls or distinguish reads from writes. Joern found every Sequelize method call with file and count — directly consumable by Pass 2. GitNexus adds the community context (model sanitization hooks, field protection in "Models" cluster) that Joern's call-level view doesn't surface.

**Extracted fact:** 33 server-side files contain Sequelize operations. Write operations (`create`, `update`, `destroy`, `increment`, `decrement`) in ~20 route files — these are the D2 targets. Read-heavy files: `verify.ts` (19 findAndCountAll), `order.ts` (4 findOne). `data/datacreator.ts` is data seeding (22 operations), not runtime. Model layer has sanitization hooks (`sanitizeHtml/Legacy/Secure`) and field protection (`makeKeyNonUpdatable`).

---

### S5 — Validation layer presence

**Question:** Is there a centralized validation layer?

**GitNexus:** Semantic query for "validation express-validator joi zod yup ajv celebrate" returned no validation-related symbols. Hits were sanitization functions in `lib/insecurity.ts`, `PasswordStrengthComponent` (frontend-only), and test files. No server-side validation library or middleware detected.

**Joern CPGQL:**
```scala
cpg.call.name("check|body|query|param|validationResult|validate|checkSchema")
  .where(_.file.name(".*(?<!node_modules).*"))
  .map(c => (c.name, c.code.take(100), c.file.name.headOption.getOrElse("?")))
  .l.take(20)
```

**Result:** No validation library calls found. `check` calls are OTP verification (`otplib.authenticator.check` in `routes/2fa.ts`) and codefix UI (`codeFixesService.check` in frontend). `query` calls are raw `models.sequelize.query()` — direct SQL, not validation. Zero `express-validator`, `joi`, `zod`, `yup`, `ajv`, or `celebrate` usage.

**Tool verdict:** Both tools reached the same conclusion through different paths. GitNexus confirmed no validation-related symbols exist. Joern confirmed no validation library calls exist. Same answer, same speed. For absence-of-evidence, both are equally effective.

**Extracted fact:** No server-side input validation library. Zero validation middleware in route registrations (confirmed in S2). Only sanitization exists in `lib/insecurity.ts` (sanitizeHtml/Legacy/Secure) — applied at model layer, not as input validation. Frontend has `PasswordStrengthComponent` — client-side only, not server-enforced.

---

### S6 — Error handling architecture

**Question:** How are errors handled?

**GitNexus:** `context(errorHandler)` found it in `routes/errorHandler.ts:12`. Outgoing calls: `chatbot.ts:status` (likely misattributed — `res.status()`), `lib/utils.ts:version`. No incoming callers detected — GitNexus doesn't see it being wired up in `server.ts` because it's passed as a middleware argument, not called directly.

**Joern CPGQL:**
```scala
// Error response status codes
cpg.call.name("status").where(_.code(".*status\\((4|5)\\d\\d\\).*"))
  .map(c => (c.code.take(80), c.file.name.headOption.getOrElse("?"), c.lineNumber.getOrElse(-1)))
  .l.groupBy(_._2).map { case (file, calls) => (file, calls.size) }
  .l.sortBy(-_._2)

// Global error handler source
// Found via get_source("errorHandler")
```

**Result:**

Global error handler in `routes/errorHandler.ts` — 4-argument Express middleware (`error, req, res, next`). Registered at line 671 in `server.ts` as `app.use(errorhandler())`. Behavior:
- JSON requests: `res.status(500).json({ error: JSON.parse(JSON.stringify(error)) })` — **leaks raw error objects**
- HTML requests: renders `views/errorPage.pug` with error passed to template — **leaks error details via template**
- Exposes Express version via `utils.version('express')` in the error page title

`res.status(4xx/5xx)` calls across 30+ server-side route files (top: `fileUpload.ts` 9, `deluxe.ts` 7, `restoreProgress.ts` 6, `chatbot.ts` 6). Error handling is distributed — each route handler does its own status codes, no centralized error normalization.

**Tool verdict:** GitNexus found the error handler function and file but couldn't see how it's wired into the app (middleware argument, not a direct call). Joern provided the full picture: handler source, registration pattern, distributed error status codes across files. Joern's `get_source` was the most efficient path to the answer.

**Extracted fact:** Global error handler at `routes/errorHandler.ts`, registered via `app.use(errorhandler())` at line 671. Leaks raw error objects in JSON responses and error details via Pug template. Exposes Express version. Error handling is distributed — 30+ files set their own status codes with no normalization layer. Relevant for CWE-209 (error information leakage) if added to Pass 2.

---

### S7 — File upload handling

**Question:** What file upload handling exists? Is content validated?

**GitNexus:** `context(handleZipFileUpload)` — found in `routes/fileUpload.ts:26`. Outgoing calls: `endsWith`, `isChallengeEnabled`, `solveIf`. Participates in 8 process traces (HandleZipFileUpload → HasDockerEnv/NotSolved/etc.). No incoming callers detected — wired via middleware argument in server.ts, invisible to GitNexus.

`context(profileImageFileUpload)` — found in `routes/profileImageFileUpload.ts:14`. Callers: `server.ts`. Outgoing: `startsWith`. No process participation.

GitNexus identified the handler functions, their files, callees, and process flows. But couldn't see the multer configuration, the middleware chain on the upload routes, or the validation (or lack thereof).

**Joern CPGQL:**
```scala
// Multer upload middleware usage
cpg.call.name("single|array|fields|none")
  .where(_.code(".*(upload|multer).*"))
  .map(c => (c.code.take(100), c.file.name.headOption.getOrElse("?"), c.lineNumber.getOrElse(-1))).l

// Upload route registrations
cpg.call.name("get|post")
  .where(_.code("^app\\.(get|post).*"))
  .where(_.file.name("server\\.ts"))
  .where(_.code(".*(upload|Upload|file|File|image|Image).*"))
  .map(c => (c.code.take(160), c.lineNumber.getOrElse(-1))).l

// Handler source via get_source
```

**Result:**

4 upload routes, 2 multer instances:

| Route | Multer | Middleware chain | Handler |
|-------|--------|-----------------|---------|
| `POST /file-upload` | `uploadToMemory.single('file')` | `ensureFileIsPassed`, metrics, `checkUploadSize`, `checkFileType` | `handleZipFileUpload` / `handleXmlUpload` / `handleYamlUpload` |
| `POST /profile/image/file` | `uploadToMemory.single('file')` | `ensureFileIsPassed`, metrics | `profileImageFileUpload()` |
| `POST /profile/image/url` | `uploadToMemory.single('file')` | (none) | `profileImageUrlUpload()` |
| `POST /rest/memories` | `uploadToDisk.single('image')` | `ensureFileIsPassed`, `security.appendUserId()`, metrics | `addMemory()` |

Validation analysis (from `get_source`):
- **`checkFileType`**: Checks extension (`pdf`, `xml`, `zip`, `yml`, `yaml`) but **always calls `next()`** — it's a challenge solver, not a blocker. No file is ever rejected based on type.
- **`checkUploadSize`**: Checks `file.size > 100000` but **always calls `next()`** — also a challenge solver, not enforcement.
- **`ensureFileIsPassed`**: The only real validation — returns 400 if no file. But doesn't check type or content.
- **No magic byte validation, no content-type check, no extension allowlist that actually blocks.**

**Tool verdict:** GitNexus identified the handler functions and their process flows (HandleZipFileUpload → ... traces). Useful for understanding what upload handlers do downstream. Joern provided the complete picture: multer config, middleware chains per route, and critically, the source of "validation" functions showing they don't actually validate. The `get_source` capability was essential — without reading the function bodies, the middleware chain *looks* like it validates.

**Extracted fact:** 4 upload routes, no real file type validation. `checkFileType` and `checkUploadSize` are challenge solvers that always pass through. `ensureFileIsPassed` only checks file presence. No content-type validation anywhere. Two multer modes: `uploadToMemory` (3 routes) and `uploadToDisk` (1 route — memories with image). D5 answer is already clear: upload handlers do NOT validate content type.

---

### S8 — Rate limiting coverage

**Question:** Is rate limiting applied? Where?

**GitNexus:** Skipped — marked "Unlikely" in plan. Rate limit config is a call expression (`rateLimit({...})`), not a named symbol.

**Joern CPGQL:**
```scala
// All rateLimit() calls
cpg.call.name("rateLimit")
  .map(c => (c.code.take(150), c.file.name.headOption.getOrElse("?"), c.lineNumber.getOrElse(-1))).l

// Routes with rate limiting
cpg.call.name("use|post")
  .where(_.code("^app\\.(use|post).*"))
  .where(_.file.name("server\\.ts"))
  .where(_.code(".*rateLimit.*"))
  .map(c => (c.code.take(160), c.lineNumber.getOrElse(-1))).l
```

**Result:**

4 rate-limited endpoints in `server.ts`, all with `windowMs: 5min, max: 100`:

| Route | Config | Notes |
|-------|--------|-------|
| `app.use('/rest/user/reset-password')` | 5min / 100 req, custom `keyGenerator` using `X-Forwarded-For` | Path-scoped via `app.use` — **key generator uses spoofable header** |
| `app.post('/rest/2fa/verify')` | 5min / 100 req, `validate: false` | Per-route inline |
| `app.post('/rest/2fa/setup')` | 5min / 100 req, `validate: false` | Per-route inline |
| `app.post('/rest/2fa/disable')` | 5min / 100 req, `validate: false` | Per-route inline |

**Not rate-limited** (notable absences):
- `POST /rest/user/login` — no rate limiting on login
- `POST /api/Users` — no rate limiting on registration
- `POST /api/Feedbacks` — no rate limiting on feedback submission
- `POST /rest/chatbot/respond` — no rate limiting on chatbot
- All file upload endpoints — no rate limiting
- All other 100+ routes — no rate limiting

Also: 100 requests per 5 minutes is a very permissive limit. And the reset-password rate limiter uses `X-Forwarded-For` header for key generation — trivially bypassable.

**Tool verdict:** GitNexus — can't answer (expression-level config). Joern — answered fully with config details, coverage gaps, and security observations.

**Extracted fact:** Rate limiting on 4 of 109 routes (3.7%). Only reset-password and 2FA endpoints. Login, registration, and all other sensitive endpoints unprotected. The reset-password rate limiter's key generator is spoofable via `X-Forwarded-For`. D9 can use this directly — the gap list is already clear.

---

### S9 — Real-time communication entry points

**Question:** What WebSocket/real-time handlers exist? Any auth?

**GitNexus:** `context(registerWebsocketEvents)` — found in `lib/startup/registerWebsocketEvents.ts:18`. Caller: `server.ts:start`. Outgoing calls: `on`, `emit`, `contains`, `isRedirectAllowed`, `solveIf`. Participates in 6 process traces (Start → NotSolved/AreCoupled/Previous). Good architectural view — shows the WebSocket system is part of the startup flow and connects to challenge solving and redirect validation.

**Joern CPGQL:**
```scala
// Socket.io connection handler
cpg.call.name("on").where(_.code(".*(connection|connect|io\\.on).*"))
  .map(c => (c.code.take(150), c.file.name.headOption.getOrElse("?"), c.lineNumber.getOrElse(-1))).l

// Full source via get_source("registerWebsocketEvents")
```

**Result:**

Single WebSocket entry point in `lib/startup/registerWebsocketEvents.ts`:
- `io = new Server(server, { cors: { origin: 'http://localhost:4200' } })` — CORS hardcoded to localhost
- `io.on('connection', (socket) => { ... })` — no auth on connection

Events registered:
| Event | Direction | Purpose |
|-------|-----------|---------|
| `server started` | server → client | Emitted to first connected socket |
| `challenge solved` | server → client | Replays pending challenge notifications |
| `notification received` | client → server | Clears notification by flag |
| `verifyLocalXssChallenge` | client → server | Challenge solver — checks for XSS payload in data |

**No authentication on WebSocket connections.** No JWT check, no session validation, no middleware. Any client can connect and receive challenge notifications or submit challenge verifications.

**Tool verdict:** GitNexus provided the architectural context — where WebSocket fits in the startup flow, what it connects to (challenge system, redirect validation). Joern provided the implementation detail — no auth, specific events, CORS config, what each handler does. Both contributed: GitNexus for "what role does this play," Joern for "how is it implemented."

**Extracted fact:** One WebSocket entry point, no auth. Events: challenge notification replay and XSS challenge verification. Registered during startup via `registerWebsocketEvents`, called from `server.ts:start`. CORS limited to localhost:4200 (dev config). No rate limiting on socket events.

---

### Pass 1 summary

| Fact | Value | Source | Answered by |
|------|-------|--------|-------------|
| Route registration file(s) | `server.ts` (centralized) | S1 | Joern (GitNexus: orientation only) |
| Route count | 109 handlers (51 GET, 40 POST, 12 PUT, 5 DELETE, 1 PATCH) + 57 `app.use()` | S1 | Joern |
| Auth middleware functions | `isAuthorized`, `appendUserId`, `denyAll`, `updateAuthenticatedUsers`, `isAccounting` — all in `lib/insecurity.ts` | S3 | Both (GitNexus: full module discovery; Joern: middleware usage counts) |
| DB operation files | 33 server-side files, writes in ~20 route files | S4 | Both (GitNexus: community grouping; Joern: per-file call inventory) |
| Validation layer | None. Zero validation libraries. | S5 | Both (same conclusion) |
| Error handler location | `routes/errorHandler.ts` — leaks raw errors, exposes Express version | S6 | Joern (GitNexus: found function, missed wiring) |
| File upload validation | 4 upload routes, no real type validation — `checkFileType` always passes through | S7 | Both (GitNexus: handler identification; Joern: implementation detail) |
| Rate limiting scope | 4 of 109 routes (3.7%) — reset-password + 2FA only | S8 | Joern (expression-level config) |
| WebSocket auth | None. No auth on socket connections. | S9 | Both (GitNexus: architectural role; Joern: implementation detail) |

---

## Pass 2: Design analysis

### D1 — Routes without auth middleware (CWE-269)

**Question:** Which routes have no auth middleware?

**Depends on:** S1 (route registrations), S3 (auth middleware names)

**GitNexus:** Can't answer — requires expression-level argument matching (negative sub-traversal on call arguments).

**Joern CPGQL:**
```scala
// Routes without security.* middleware in app.verb() call
cpg.call.name("get|post|put|delete|patch")
  .where(_.code("^app\\.(get|post|put|delete|patch).*"))
  .where(_.file.name("server\\.ts"))
  .filter(c => !c.code.matches(
    "(?s).*security\\.(isAuthorized|appendUserId|denyAll|updateAuthenticatedUsers|isAccounting).*"))
  .map(c => (c.name, c.code.take(160), c.lineNumber.getOrElse(-1)))
  .l.sortBy(_._3)

// Path-scoped auth via app.use()
cpg.call.name("use").where(_.code("^app\\.use.*")).where(_.file.name("server\\.ts"))
  .filter(c => c.code.matches(
    "(?s).*security\\.(isAuthorized|appendUserId|denyAll|updateAuthenticatedUsers|isAccounting).*"))
  .map(c => (c.code.take(120), c.lineNumber.getOrElse(-1))).l
```

**Result:**

63 routes have no `security.*` middleware in their direct `app.verb()` registration.

16 path-scoped `app.use()` calls apply auth to sub-paths:
- `/rest/basket*` → `isAuthorized` + `appendUserId` (covers `retrieveBasket`, `placeOrder`, `applyCoupon`)
- `/rest/user/authentication-details` → `isAuthorized`
- `/b2b/v2*` → `isAuthorized` (covers `b2bOrder`)
- `/api/BasketItems*` → `isAuthorized`
- `/api/Feedbacks/:id` → `isAuthorized`
- `/api/Challenges/:id`, `/api/Complaints/:id`, `/api/SecurityQuestions/:id`, `/api/SecurityAnswers/:id` → `denyAll`
- `/api/Quantitys/:id` → `isAccounting`
- `/api/PrivacyRequests*` → `isAuthorized` / `denyAll`

After subtracting path-scoped coverage, **~58 routes are truly unprotected.** Notable security-sensitive ones:

| Route | Risk |
|-------|------|
| `GET /rest/user/change-password` | Password change via GET, no auth |
| `GET /rest/admin/application-version` | Admin endpoint, no auth |
| `GET /rest/admin/application-configuration` | Admin endpoint, no auth |
| `GET /rest/order-history` | Order history without auth |
| `GET /rest/deluxe-membership` | Membership status without auth |
| `GET /rest/memories` | User memories without auth |
| `POST /rest/chatbot/respond` | Chatbot without auth |
| `POST /profile` | Profile update without auth |
| `GET /rest/saveLoginIp` | Saves login IP without auth |
| `POST /file-upload` | File upload without auth |
| `POST /profile/image/file` | Profile image upload without auth |
| `POST /profile/image/url` | Profile image URL upload without auth |
| `GET /metrics` | Prometheus metrics exposed without auth |
| `GET /redirect` | Open redirect endpoint |
| `PUT /rest/products/:id/reviews` | Create product reviews without auth |
| `GET /rest/web3/*` | Web3 endpoints without auth |

Legitimately public: login, registration, security.txt, search, captcha, language list, country mapping, delivery methods, password reset, security question lookup.

**Tool verdict:** Joern only. Negative sub-traversal on call arguments + path-scoped cross-reference — purely expression-level.

**v3 comparison:** v3 found 64 unprotected / 44 protected routes. Our result: ~58 unprotected / ~51 protected (after path-scoped deduction). Difference likely from v3 counting methodology. Core finding identical.

**Verdict:** Pass 1 sufficient — S1 provided all route registrations, S3 provided the auth middleware names. The negative filter worked without reading source code. Consistent with v3.

---

### D2 — DB writes without auth (CWE-269)

**Question:** Which DB write operations are in unprotected routes?

**Depends on:** D1 (unprotected routes), S4 (DB operations)

**GitNexus:** Can't answer — set intersection of expression-level facts.

**Joern CPGQL:**
```scala
// DB write operations in route files
cpg.call.name("create|update|destroy|increment|decrement|bulkCreate|upsert")
  .where(_.file.name(".*routes/.*"))
  .filter(c => !c.file.name.headOption.getOrElse("").contains("codefixes"))
  .map(c => (c.name, c.file.name.headOption.getOrElse("?"), c.lineNumber.getOrElse(-1)))
  .l.groupBy(_._2)
  .map { case (file, calls) => (file, calls.map(x => x._1).groupBy(identity)
    .map { case (k, v) => s"$k(${v.size})" }.mkString(", ")) }
  .l.sortBy(_._1)
// → 16 route files with write operations

// Cross-referenced with D1 unprotected routes and path-scoped app.use() auth
```

**Result:**

16 route files contain DB write operations. Cross-referencing with D1 (unprotected routes) and path-scoped `app.use()` auth:

| Route file | Writes | Route registration | Auth status |
|-----------|--------|-------------------|-------------|
| `changePassword.ts` | update(1) | `GET /rest/user/change-password` (line 590) | **UNPROTECTED** |
| `updateUserProfile.ts` | update(1) | `POST /profile` (line 659) | **UNPROTECTED** |
| `profileImageFileUpload.ts` | update(1) | `POST /profile/image/file` (line 305) | **UNPROTECTED** |
| `chatbot.ts` | update(1) | `POST /rest/chatbot/respond` (line 625) | **UNPROTECTED** |
| `dataErasure.ts` | create(1) | `app.use('/dataerasure', dataErasure)` (line 648) | **UNPROTECTED** |
| `likeProductReviews.ts` | update(2) | `POST /rest/products/reviews` (line 630) | Protected (`isAuthorized`) |
| `updateProductReviews.ts` | update(1) | `PATCH /rest/products/reviews` (line 629) | Protected (`isAuthorized`) |
| `memory.ts` | create(1) | `POST /rest/memories` (line 307) | Protected (`appendUserId`) |
| `order.ts` | destroy, update, increment, decrement | `POST /rest/basket/:id/checkout` (line 597) | Protected (path-scoped `/rest/basket`) |
| `wallet.ts` | increment(1) | `PUT /rest/wallet/balance` (line 620) | Protected (`appendUserId`) |
| `deluxe.ts` | update, decrement | `POST /rest/deluxe-membership` (line 622) | Protected (`appendUserId`) |
| `address.ts` | destroy(1) | `DELETE /api/Addresss/:id` (line 445) | Protected (`appendUserId`) |
| `payment.ts` | destroy(1) | `DELETE /api/Cards/:id` (line 435) | Protected (`appendUserId`) |
| `coupon.ts` | update(1) | `PUT /rest/basket/:id/coupon/:coupon` (line 598) | Protected (path-scoped `/rest/basket`) |
| `imageCaptcha.ts` | create(1) | `GET /rest/image-captcha` (line 609) | Unprotected but low-risk (captcha generation) |
| `orderHistory.ts` | update(1) | `PUT /rest/order-history/:id/delivery-status` (line 618) | Protected (`isAccounting`) |

**5 route files with DB writes are unprotected:**
1. `changePassword.ts` — password change via GET with DB update, no auth
2. `updateUserProfile.ts` — profile update with DB write, no auth
3. `profileImageFileUpload.ts` — profile image update with DB write, no auth
4. `chatbot.ts` — chatbot state update, no auth
5. `dataErasure.ts` — data erasure request creates DB record, no auth

**Tool verdict:** Joern only. Set intersection of call-level data (route registrations × DB write calls × auth middleware presence).

**v3 comparison:** v3 found 18 DB writes in 12 unprotected route files. Our result: 5 unprotected route files with ~6 write operations. Difference: we accounted for path-scoped `app.use()` auth that v3 may not have deducted. Our result is more precise.

**Verdict:** Pass 1 sufficient. S1 provided routes, S3 provided auth names, S4 provided DB operations. Cross-reference worked mechanically.

---

### D3 — Security function fan-in (CWE-269)

**Question:** Which security functions have excessive fan-in?

**Depends on:** S3 (security function names)

**GitNexus:**

`impact(hash, upstream)` — CRITICAL risk. 26 direct callers (d=1), 20 affected processes, 3 modules (Codefixes, Routes, Models). Key d=1 callers: `models/user.ts:set` (password hashing in model hook), `routes/login.ts:login`, `routes/order.ts:placeOrder`, `routes/changePassword.ts:changePassword`, `routes/dataExport.ts:dataExport`, `routes/b2bOrder.ts:uniqueOrderNumber`, `routes/2fa.ts:setup/disable`, `data/datacreator.ts:createOrders`. Also 9 codefix variants at low confidence (0.3).

`impact(isAuthorized, upstream)` — MEDIUM risk. 5 direct callers, 0 processes affected. Only `server.ts` + 4 codefix files. Misleading count — Joern shows `isAuthorized` is used 11 times in `server.ts` (across different routes), but GitNexus counts file-level, not call-level.

**Joern CPGQL:**
```scala
val secFuncs = List("isAuthorized", "denyAll", "appendUserId",
  "updateAuthenticatedUsers", "isAccounting", "hash", "hmac",
  "verify", "decode", "authorize", "isDeluxe", "isCustomer",
  "sanitizeHtml", "sanitizeLegacy", "sanitizeSecure", "deluxeToken",
  "isRedirectAllowed", "cutOffPoisonNullByte")
secFuncs.map(f => (f, cpg.call.name(f).file.name.toSet.size))
  .sortBy(-_._2).l
```

**Result:**

Fan-in by unique calling files (all 18 security functions from S3):

| Function | Calling files | Role | Risk |
|----------|:---:|------|------|
| `hash` | 9 | Password hashing (MD5 — intentionally weak) | **Highest fan-in.** Single point of failure — if compromised, all password operations affected. |
| `verify` | 8 | JWT verification | High fan-in — used across auth checks |
| `denyAll` | 6 | Access blocking | Moderate — used in server.ts for admin endpoints |
| `decode` | 6 | JWT decode | Moderate — coupled to verify |
| `isDeluxe` | 6 | Deluxe role check | Moderate |
| `isAuthorized` | 5 | JWT auth middleware | Moderate — 11 route uses but concentrated in server.ts |
| `appendUserId` | 5 | JWT user injection | Moderate — 17 route uses, concentrated in server.ts |
| `isAccounting` | 5 | Accounting role check | Moderate |
| `authorize` | 5 | Auth (not used as middleware) | Moderate |
| `sanitizeSecure` | 5 | Input sanitization | Moderate |
| `sanitizeHtml` | 3 | HTML sanitization | Low |
| `deluxeToken` | 3 | Token generation | Low |
| `hmac` | 2 | HMAC signing | Low |
| `isRedirectAllowed` | 2 | Redirect validation | Low |
| `updateAuthenticatedUsers` | 1 | Auth tracking | Low (single caller) |
| `isCustomer` | 1 | Customer role check | Low |
| `sanitizeLegacy` | 1 | Legacy sanitization | Low |
| `cutOffPoisonNullByte` | 1 | Security filter | Low |

**Top concentration risks:**
1. `hash` (9 files) — password hashing across login, registration, order, data export, 2FA. Compromise = all authentication bypassed.
2. `verify` (8 files) — JWT verification. Compromise = all token-based auth bypassed.
3. Both live in `lib/insecurity.ts` — a single file is the security kernel for the entire app.

**Tool verdict:** Both contributed well. GitNexus gave the richer picture for `hash` — 20 affected process flows (Login→, PlaceOrder→, DataExport→, B2bOrder→), 3 affected modules, risk rating. This is exactly the "blast radius" analysis GitNexus is built for. Joern gave precise file-level fan-in counts for all 18 functions in one query. GitNexus undercounts `isAuthorized` (file-level granularity masks 11 call sites in one file). Joern can't show process/module impact.

**v3 comparison:** v3 found `authenticatedUsers` at 30 files, `hash` at 9 files. Our `hash` matches exactly (9 files). `authenticatedUsers` differs — v3 may have counted a different function name or included imports. Core finding identical: `hash` and JWT functions are the highest-risk concentration points.

**Verdict:** Pass 1 sufficient. S3 provided the function list. Both tools contributed — GitNexus for blast radius context, Joern for precise counts. **This is the strongest complementary result so far.**

**Verdict:** (pending)

---

### D4 — Missing encryption on sensitive data (CWE-311)

**Question:** Do sensitive data flows skip encryption?

**Depends on:** S4 (DB operations), stack profile

**GitNexus:** Can't answer — data flow and taint analysis is expression-level. GitNexus operates at symbol granularity and cannot trace how values flow through function calls or check for absence of encryption in a data path.

**Joern CPGQL:**
```scala
// Identify sensitive identifiers across server-side code
cpg.identifier.name("(?i).*(password|passwd|secret|token|key|credit|card|ssn).*")
  .map(i => (i.name, i.file.name.headOption.getOrElse("?"), i.lineNumber.getOrElse(-1)))
  .l.filter(!_._2.contains("codefixes")).filter(!_._2.contains("frontend"))
  .groupBy(_._2).map { case (file, ids) => (file, ids.map(_._1).distinct.sorted.mkString(", ")) }
  .l.sortBy(_._1)
// → 41 server-side files with sensitive identifiers

// Taint: password identifiers → DB write operations
cpg.identifier.name("(?i)(password|newPassword|currentPassword|repeatPassword|clearTextPassword)")
  → taint to → cpg.call.name("update|create|save")
// → Flows found (142K chars of taint paths)

// DB writes involving sensitive data directly
cpg.call.name("update|create|save")
  .where(_.code("(?i).*(password|passwd|secret|token|card).*"))
  .filter(c => !c.file.name.headOption.getOrElse("").contains("codefixes"))
  .filter(c => !c.file.name.headOption.getOrElse("").contains("frontend"))

// Hash function implementation
// get_source("hash") → crypto.createHash('md5').update(data).digest('hex')

// HMAC function implementation
// get_source("hmac") → crypto.createHmac('sha256', 'pa4qacea4VK9t9nGv7yZtwmj').update(data).digest('hex')

// Sensitive data in HTTP responses
cpg.call.name("json|send").where(_.code("(?i).*(token|password|secret|key|hash).*"))
  .filter(excludes).map(c => (c.code.take(200), c.file, c.lineNumber)).l
```

**Result:**

5 categories of missing or inadequate encryption:

| Finding | Location | Detail | Severity |
|---------|----------|--------|----------|
| **Password hashing uses unsalted MD5** | `lib/insecurity.ts:hash()` | `crypto.createHash('md5').update(data).digest('hex')` — no salt, no key stretching. Trivially crackable with rainbow tables. Should use bcrypt/scrypt/argon2. | **Critical** |
| **Passwords transmitted in URL** | `GET /rest/user/change-password` (`server.ts:590`) | `?current=X&new=Y&repeat=Z` — passwords in query strings are logged by morgan (HTTP logger), browser history, proxy logs, referrer headers. CWE-598. | **High** |
| **Card numbers stored unencrypted** | `data/datacreator.ts:213`, `models/card.ts` | `CardModel.create({ cardNum: Number(card.cardNum) })` — full PAN stored as plaintext integer in DB. Display is masked (last 4 digits in `routes/payment.ts`), but at-rest storage has no encryption. PCI DSS violation. | **High** |
| **TOTP secrets stored as plaintext** | `models/user.ts`, `routes/2fa.ts` | `userModel.update({ totpSecret: secret })` — 2FA shared secret in cleartext in DB. DB compromise = all 2FA bypassed. | **Medium** |
| **HMAC uses hardcoded key** | `lib/insecurity.ts:hmac()` | `crypto.createHmac('sha256', 'pa4qacea4VK9t9nGv7yZtwmj')` — HMAC key hardcoded in source code. Used for security answer hashing. CWE-798. | **High** |

**Mitigations present but inadequate:**
- User model `set password` hook calls `security.hash()` — passwords ARE hashed before DB storage, just with MD5 (not a password hashing algorithm).
- Security answer model `set answer` hook calls `security.hmac()` — answers ARE HMAC'd, but with a hardcoded key in source.
- Card numbers ARE masked on display (last 4 digits) in `routes/payment.ts`, but stored unencrypted.
- User listing endpoint (`routes/authenticatedUsers.ts`) masks passwords and TOTP secrets with asterisks before sending in response.

**Tool verdict:** Joern only. Required expression-level analysis: tracing data from identifiers through function calls to sinks, reading function implementations (`get_source`), and checking for presence/absence of encryption in the path. GitNexus can't see data flow or function implementations — purely symbol-level.

**v3 comparison:** Not tested in v3.

**Verdict:** Pass 1 sufficient. S4 identified DB operation locations. Stack profile identified `jsonwebtoken` 0.4.0 (known weak). Joern traced the actual flows: password → MD5 hash → DB, card number → plaintext → DB, TOTP secret → plaintext → DB. The `get_source` capability was critical — without reading `hash()`, `hmac()`, and model hooks, you can't distinguish "hashed but weak" from "not hashed at all."

---

### D5 — Unrestricted file upload (CWE-434)

**Question:** Do file upload handlers validate content type?

**Depends on:** S7 (upload handling)

**GitNexus:** `context()` on all 4 upload handler functions with callee inspection:

| Handler | Callees | Validation in call chain? |
|---------|---------|--------------------------|
| `handleZipFileUpload` (routes/fileUpload.ts) | `endsWith`, `isChallengeEnabled`, `solveIf` | **No.** `endsWith` checks extension for challenge solving, not blocking. |
| `profileImageFileUpload` (routes/profileImageFileUpload.ts) | `status`, `startsWith` | **No.** `startsWith` is a string check, not file validation. |
| `profileImageUrlUpload` (routes/profileImageUrlUpload.ts) | `getErrorMessage` | **No.** Only error formatting. |
| `addMemory` (routes/memory.ts) | `create`, `status` | **No.** Direct DB create, no validation. |

GitNexus can confirm that no upload handler calls any validation function downstream. The absence of validation callees is informative — but it's circumstantial evidence (you know what they DO call, and none of it is validation). GitNexus can't see the middleware chain from `server.ts` or the implementation of `checkFileType`/`checkUploadSize`.

`handleZipFileUpload` participates in 8 process traces (HandleZipFileUpload → HasDockerEnv/NotSolved/AreCoupled/etc.) — all 5-step flows ending in challenge-solving, not file validation.

**Joern CPGQL:**
```scala
// Already executed in S7 — upload middleware chain and handler source analysis
// checkFileType source: always calls next() regardless of file type
// checkUploadSize source: always calls next() regardless of file size
// ensureFileIsPassed: returns 400 only if no file attached
// No multer fileFilter configured on either uploadToMemory or uploadToDisk
```

**Result:**

All 4 upload routes lack content type validation (confirmed in S7):

| Route | Middleware chain | Content validation | Type validation |
|-------|-----------------|-------------------|-----------------|
| `POST /file-upload` | `ensureFileIsPassed`, metrics, `checkUploadSize`, `checkFileType` | **None.** `checkFileType` checks extension but always calls `next()` — challenge solver, not blocker. | **None.** |
| `POST /profile/image/file` | `ensureFileIsPassed`, metrics | **None.** No type checking at all. | **None.** |
| `POST /profile/image/url` | (none) | **None.** Accepts URL, downloads it. | **None.** No URL validation. |
| `POST /rest/memories` | `ensureFileIsPassed`, `security.appendUserId()`, metrics | **None.** | **None.** |

**Missing controls (none of these exist):**
- Magic byte / file signature validation
- Content-Type header verification
- Extension allowlist that blocks
- Multer `fileFilter` callback
- File size enforcement that blocks (checkUploadSize always passes)
- Antivirus scanning

**Tool verdict:** Both contributed. GitNexus confirmed no validation functions in any handler's downstream call chain — the callee lists contain only challenge-solving logic, string utils, and DB operations. Joern provided the critical detail: `checkFileType` and `checkUploadSize` *look* like validation (named as such, positioned as middleware) but always call `next()`. Without `get_source`, these would appear to be real validators.

**v3 comparison:** Not tested in v3.

**Verdict:** Pass 1 sufficient — S7 already identified the upload handlers, middleware chains, and fake validators. D5 is essentially a formalization of S7's finding. GitNexus added the downstream callee view confirming no validation anywhere in the call chain. **The key insight is Joern's `get_source`: middleware named `checkFileType` is a false positive for validation — it's a challenge solver that never blocks.**

---

### D6 — Trust boundary violation (CWE-501)

**Question:** Does untrusted input flow into trusted data structures?

**Depends on:** S1 (entry points)

**GitNexus:** Can't answer — requires taint analysis tracing data from `req.body/query/params` into session objects, auth context, or role assignments. Expression-level analysis only.

**Joern CPGQL:**
```scala
// Taint: req.body/query/params → role/privilege updates
cpg.call.code(".*req\\.(body|query|params).*")
  → taint to → cpg.call.name("update").where(_.code("(?i).*(role|admin|deluxe|privilege).*"))
// → Flow found: req.body.UserId → UserModel.findOne → user.update({role: deluxe})

// All DB operations using req.body/query/params directly
cpg.call.name("findOne|findByPk|findAll|update|create|destroy")
  .where(_.code(".*req\\.(body|query|params).*"))
  .filter(excludes)
// → 22 DB operations use untrusted input directly

// User registration - mass assignment check
// server.ts:402-415 — POST /api/Users passes req.body through to Sequelize
```

**Result:**

4 categories of trust boundary violations:

| Finding | Location | Flow | Severity |
|---------|----------|------|----------|
| **Chatbot query → username** | `routes/chatbot.ts:141` | `userModel.update({ username: req.body.query })` — chatbot text input directly overwrites user identity field | **High** |
| **User-controlled UserId → role elevation** | `routes/deluxe.ts:19-43` | `req.body.UserId` → `UserModel.findOne({where: {id: req.body.UserId}})` → `user.update({role: deluxe})` — attacker supplies any UserId to elevate another user | **Critical** |
| **Mass assignment in registration** | `server.ts:402-415` | `POST /api/Users` passes full `req.body` to Sequelize — no field allowlist, attacker can set `role: 'admin'` | **Critical** |
| **IDOR via req.body.UserId** | 14+ route files | `req.body.UserId` used directly in DB queries without verifying it matches the authenticated user's ID. Files: `address.ts`, `payment.ts`, `wallet.ts`, `deluxe.ts`, `order.ts`, `dataExport.ts` | **High** |

Additional trust boundary issues:
- `routes/recycles.ts:12` — `JSON.parse(req.params.id)` parsed as JSON for DB query — injection vector
- `routes/updateProductReviews.ts:17` — `req.body.id` used directly in MongoDB `update()` — IDOR
- `routes/orderHistory.ts:36` — `req.params.id` in MongoDB `update()` with `$set` — IDOR
- `routes/updateUserProfile.ts:36` — `req.body.username` → `user.update()` — no field allowlist (though user is authenticated and scoped)

**22 DB operations across 14 route files use `req.body/query/params` directly** — no input validation, no type checking, no allowlisting. The `appendUserId` middleware (S3) was designed to inject a trusted UserId, but many routes use `req.body.UserId` instead of the middleware-injected value.

**Tool verdict:** Joern only. Taint analysis traced `req.body.UserId` through `findOne` to `update({role: deluxe})`. Expression-level code inspection (`get_source`) revealed the chatbot → username overwrite. GitNexus can't see data flow through function arguments.

**v3 comparison:** Not tested in v3.

**Verdict:** Pass 1 sufficient. S1 provided route registrations, S2 identified which routes use `appendUserId` middleware. D6 cross-references: routes that DON'T use `appendUserId` but DO use `req.body.UserId` are the trust boundary violations — they trust client-supplied identity instead of server-derived identity. The `appendUserId` middleware pattern is the intended trust boundary; its absence is the violation.

---

### D7 — Missing server-side validation (CWE-602)

**Question:** Do server-side route handlers have their own validation?

**Depends on:** S5 (validation layer)

**GitNexus:** Can't answer — requires expression-level call chain analysis within handlers to detect validation patterns (typeof, regex, schema checks). Symbol-level view can't distinguish "handler calls a function" from "handler validates input then calls a function."

**Joern CPGQL:**
```scala
// Type checking on req.body/query/params
cpg.call.name("typeof|instanceof|isNaN|parseInt|parseFloat|Number|isFinite")
  .where(_.code(".*req\\.(body|query|params).*")).filter(excludes)
// → 1 result: Number(req.params.id) in routes/showProductReviews.ts:31

// Regex validation on input
cpg.call.name("test|match").where(_.code(".*req\\.(body|query|params).*")).filter(excludes)
// → 0 results

// Existence/emptiness checks on input
cpg.call.name("send|json|status")
  .where(_.code(".*(!req\\.(body|query|params)|undefined|empty|missing|required).*")).filter(excludes)
// → 4 results: all password emptiness checks
```

**Result:**

Across 33 server-side route files with 109 route handlers:

| Validation type | Count | Where |
|----------------|:-----:|-------|
| Type coercion (`Number()`, `parseInt()`, etc.) | **1** | `Number(req.params.id)` in `showProductReviews.ts:31` |
| Regex validation (`.test()`, `.match()` on input) | **0** | — |
| Schema validation (express-validator, joi, zod, etc.) | **0** | Confirmed in S5 |
| Existence/emptiness checks | **4** | Password emptiness in `changePassword.ts`, `resetPassword.ts`, `server.ts` (registration), `login.ts` |
| Content-type validation (file uploads) | **0** | Confirmed in S7/D5 |
| Length/bounds checking | **0** | — |
| Format validation (email regex, etc.) | **0** | — |

**Total: 5 validation checks across 109 route handlers (4.6%).**

All 5 are password-related emptiness checks — the minimum "is it blank?" guard. No route validates input type, format, length, or content. The 22 DB operations using `req.body` directly (from D6) have zero validation between input and database.

Model-layer sanitization exists (`sanitizeHtml`, `sanitizeLegacy`, `sanitizeSecure` in Sequelize hooks) but this is output encoding, not input validation — it protects against XSS in stored data, not against malformed or malicious input reaching business logic.

**Tool verdict:** Joern only. Required searching for validation call patterns (`typeof`, `match`, `test`, `parseInt`) within route handler code and counting occurrences — expression-level analysis.

**v3 comparison:** v3 found "zero validation libraries, 2 ad-hoc checks across 33 route files." Our result is consistent: 0 libraries, 5 ad-hoc checks (slightly higher count — we looked for more patterns). Core finding identical: no meaningful input validation.

**Verdict:** Pass 1 sufficient. S5 confirmed no validation library. D7 quantified the gap: 5 checks / 109 handlers = 4.6% coverage, all password-emptiness only. No type, format, length, or schema validation anywhere. Combined with D6 (22 DB ops with untrusted input), this is the validation gap that enables trust boundary violations.

---

### D8 — Privilege isolation (CWE-653)

**Question:** Can unauthenticated entry points reach privileged operations?

**Depends on:** D1 (unprotected routes), S4 (DB operations)

**GitNexus:** `impact(downstream)` on unprotected handlers — **this is exactly what GitNexus's blast radius is built for.**

| Unprotected handler | Risk | Direct callees (d=1) | Transitive reach (d=3) | Processes affected |
|---------------------|------|---------------------|----------------------|-------------------|
| `changePassword` | CRITICAL | `hash`, `solveIf`, `status` | `verify`, `notify`, `calculateCheatScore` (13 symbols) | 20 |
| `handleZipFileUpload` | CRITICAL | `endsWith`, `isChallengeEnabled`, `solveIf`, `status` | `verify`, `notify`, `calculateCheatScore`, `isDocker` (18 symbols) | 20 |

Both reach security functions (`hash`, `verify`) and system functions (`notify`, `calculateCheatScore`) within 3 hops. GitNexus provides the structural reachability graph with confidence scores and affected process counts.

**Joern CPGQL:**
```scala
// Which unprotected route handlers call security-sensitive functions?
val secCalls = List("hash", "verify", "decode", "authorize", "hmac", "deluxeToken")
val unprotectedFiles = List("changePassword", "resetPassword", "chatbot",
  "dataErasure", "updateUserProfile", "profileImageFileUpload",
  "profileImageUrlUpload", "fileUpload", "saveLoginIp")
unprotectedFiles.map(f => {
  val calls = cpg.call.name(secCalls.mkString("|"))
    .where(_.file.name(s".*routes/$f.*")).map(_.name).l.distinct
  (f, calls.mkString(", "))
}).filter(_._2.nonEmpty).l
```

**Result:**

4 unprotected route handlers directly call security-critical functions:

| Unprotected handler | Security functions called | Risk |
|---------------------|--------------------------|------|
| `changePassword` | `hash` | Password hashing — can probe hash algorithm behavior without auth |
| `resetPassword` | `hmac` | Security answer verification — can brute-force answers without auth |
| `chatbot` | `authorize`, `verify` | JWT operations — can trigger token generation/validation without auth |
| `updateUserProfile` | `authorize` | JWT token generation — can get new tokens without auth |

Combined with D2 (5 unprotected routes with DB writes) and D6 (22 DB operations with untrusted input), the privilege isolation picture:

**Unauthenticated users can:**
1. Change any user's password (`changePassword` — no auth, takes current password as GET param)
2. Reset any user's password (`resetPassword` — no auth, needs security answer)
3. Generate JWT tokens (`chatbot`, `updateUserProfile` — call `authorize`)
4. Write to database (`changePassword`, `updateUserProfile`, `chatbot`, `dataErasure`, `profileImageFileUpload` — all have DB writes per D2)
5. Upload arbitrary files (`fileUpload`, `profileImageFileUpload`, `profileImageUrlUpload` — no auth per D1, no validation per D5)

**Tool verdict:** Both contributed strongly. GitNexus provided transitive reachability with process counts (20 affected processes from `changePassword`) and depth-stratified impact — the architectural blast radius view. Joern provided precise security function call identification — which specific security functions each unprotected handler invokes. **GitNexus answers "how far does the damage reach?" while Joern answers "what exactly can they do?"**

**v3 comparison:** Not tested in v3 (D2 is related but D8 goes deeper — transitive reachability).

**Verdict:** Pass 1 sufficient. D1 identified unprotected routes, S3 identified security functions. D8 cross-references: which unprotected routes can reach privileged operations. **This is the second strongest complementary result** (after D3) — GitNexus's downstream impact analysis is purpose-built for this question.

---

### D9 — Rate limiting gaps (CWE-799)

**Question:** Which sensitive endpoints lack rate limiting?

**Depends on:** S8 (rate limit locations), S1 (routes)

**GitNexus:** Can't answer — rate limit application is expression-level (inline `rateLimit()` call arguments in route registrations). GitNexus can't see call arguments.

**Joern CPGQL:**
```scala
// Sensitive endpoints without rateLimit in their registration
cpg.call.name("get|post|put|delete|patch")
  .where(_.code("^app\\.(get|post|put|delete|patch).*"))
  .where(_.file.name("server\\.ts"))
  .filter(c => c.code.matches("(?i).*(login|user|password|register|upload|file|captcha|chatbot|feedback|coupon).*"))
  .filter(c => !c.code.contains("rateLimit"))
// → 41 sensitive endpoints without rate limiting
```

**Result:**

S8 established: 4 of 109 routes (3.7%) have rate limiting — password reset + 2FA only.

Critical sensitive endpoints without rate limiting:

| Endpoint | Risk | Attack enabled |
|----------|------|---------------|
| `POST /rest/user/login` | **Critical** | Credential brute-force — no throttling on login attempts |
| `POST /api/Users` | **High** | Mass account creation / registration spam |
| `GET /rest/user/change-password` | **Critical** | Password brute-force (also: password in GET query params per D4) |
| `POST /file-upload` | **High** | DoS via unlimited file uploads (no auth per D1, no validation per D5) |
| `POST /profile/image/file` | **High** | DoS via image upload spam |
| `POST /profile/image/url` | **High** | SSRF amplification — unlimited URL fetches |
| `POST /rest/chatbot/respond` | **Medium** | Chatbot abuse / resource exhaustion |
| `POST /api/Feedbacks` | **Medium** | Feedback spam (captcha present but bypassable — `captchaBypassChallenge`) |
| `GET /rest/captcha` / `GET /rest/image-captcha` | **Medium** | Captcha farming |
| `POST /rest/user/data-export` | **Medium** | Resource exhaustion via repeated exports |
| `GET /rest/user/authentication-details` | **Medium** | User enumeration (returns all users) |

**Rate-limited (from S8):** Only `POST /rest/user/reset-password` (5min/100), `POST /rest/2fa/verify` (5min/100), `POST /rest/2fa/setup` (5min/100), `POST /rest/2fa/disable` (5min/100). And the reset-password rate limiter uses spoofable `X-Forwarded-For` for key generation.

**Tool verdict:** Joern only (from S8). Rate limit detection requires seeing `rateLimit()` call expressions in route registrations. D9 is a formalization of S8's finding cross-referenced with endpoint sensitivity categories.

**v3 comparison:** Not tested in v3.

**Verdict:** Pass 1 sufficient. S8 identified the 4 rate-limited routes, S1 provided all route registrations. D9 cross-references: sensitive endpoints minus rate-limited endpoints = gap list. The most critical gap is login — credential brute-force is the #1 use case for rate limiting, and it's missing.

---

### D10 — Workflow enforcement (CWE-841)

**Question:** Can workflow steps be skipped?

**Depends on:** S1 (routes), S4 (DB operations)

**GitNexus:** `context(placeOrder)` showed 6 process traces (PlaceOrder → NotSolved/AreCoupled/Previous/IsTrivial/TotalCheatScore/Version), all 5-step flows. These reveal the downstream execution paths but all end in challenge-solving — they model what `placeOrder` does, not what prerequisites it checks. GitNexus can't see conditional guards or step verification logic within handlers.

**Joern CPGQL:**
```scala
// What does placeOrder verify before processing?
cpg.method.name(".*placeOrder.*").where(_.file.name(".*routes/order.*"))
  .ast.isCall.name("findOne|findByPk")
// → Basket exists, product quantity, delivery method, wallet — but NOT address or payment card

// What does upgradeToDeluxe verify?
cpg.method.name(".*upgradeToDeluxe.*").where(_.file.name(".*routes/deluxe.*"))
  .ast.isCall.name("findOne|findByPk")
// → User is customer, wallet exists, payment card exists — better, but uses req.body.UserId (IDOR)

// Full handler source via get_source
```

**Result:**

**Purchase workflow** (intended flow: basket → address → payment → delivery → coupon → checkout):

| Step | Server-side verification | Can skip? |
|------|------------------------|-----------|
| Add to basket | Creates basket item | — |
| Set address | Creates address record | **Yes** — checkout doesn't verify address exists |
| Set payment | Creates card record | **Yes** — checkout doesn't verify payment card exists |
| Select delivery | Creates delivery selection | **No** — `placeOrder` calls `DeliveryModel.findOne({id: req.body.orderDetails.deliveryMethodId})` |
| Apply coupon | Validates coupon string | **Yes** — coupon is optional; also, `applyCoupon` takes any basket ID with no ownership check |
| Checkout | Creates order PDF | N/A — this is the final step |

**No server-side workflow state tracking.** The Angular frontend stores state in `sessionStorage` (paymentId, addressId, deliveryMethodId) and sends it at checkout. The server treats each API call independently — no session-level "user has completed step N" tracking.

**Coupon ownership gap:** `applyCoupon()` takes `params.id` (basket ID) — no check that the basket belongs to the authenticated user. Any authenticated user can apply coupons to any basket.

**Workflows with proper enforcement:**
- **2FA setup**: Verifies password, checks `setupToken` type (`totp_setup_secret`), validates initial TOTP token — proper step-by-step verification.
- **Password reset**: Verifies email + HMAC'd security answer before allowing password change — proper prerequisite checking.

**Workflows without enforcement:**
- **Purchase flow**: No server-side state machine. Client orchestrates the flow, server accepts individual calls.
- **Deluxe upgrade**: Verifies payment card exists but uses `req.body.UserId` (IDOR from D6) — any user can upgrade any other user.

**Tool verdict:** Both contributed partially. GitNexus showed process traces (PlaceOrder → 5 steps) but these model call chains, not prerequisite verification — the process traces show what `placeOrder` calls downstream, not what guards must pass before it runs. Joern showed the actual `findOne` calls within the handler — what prerequisites are checked and which are missing. `get_source` was essential for understanding the conditional logic.

**v3 comparison:** Not tested in v3.

**Verdict:** Pass 1 partially sufficient. S1 provided the route registrations, S4 provided DB operations. But D10 required understanding handler-internal logic (what checks happen before the main operation) — this needed `get_source` + manual reasoning about workflow semantics. The CPG can detect the presence/absence of verification calls, but "is this the right verification for this step?" requires domain knowledge about the purchase workflow. **This is the hardest query — closest to needing human reasoning.**

---

### D11 — Attack surface metrics (CWE-1125)

**Question:** How large is the attack surface?

**Depends on:** S1, D1, S4

**GitNexus:** Architectural overview from repo context and cluster stats:

| Metric | Value | Source |
|--------|-------|--------|
| Total files | 974 | `gitnexus://repo/vulnerable-app/context` |
| Total symbols | 2,500 | `gitnexus://repo/vulnerable-app/context` |
| Execution flows (processes) | 139 | `gitnexus://repo/vulnerable-app/context` |
| Functional modules | 34 | `gitnexus://repo/vulnerable-app/clusters` |
| Routes cluster size | 227 symbols, 56% cohesion | cluster stats |
| Security-related modules | 3 (Routes, Models, Codefixes) | from D3 `hash` blast radius |

GitNexus provides the architectural scale — how large the system is in terms of functional units and interconnections. But it can't quantify the attack surface in security terms (unprotected routes, validation gaps, etc.) — those are expression-level facts.

**Joern CPGQL:** Aggregation of all Pass 1 and Pass 2 findings.

**Result:**

Attack surface quantification from this analysis:

| Metric | Value | Source | Risk |
|--------|:-----:|--------|------|
| **Total route handlers** | 109 | S1 | — |
| **Total middleware registrations** | 57 | S1 | — |
| **Unprotected routes** | ~58 (53%) | D1 | **Critical** — majority of routes have no auth |
| **DB writes without auth** | 5 files, ~6 operations | D2 | **Critical** — password change, profile update, data erasure |
| **Rate-limited routes** | 4 (3.7%) | S8/D9 | **Critical** — login not rate-limited |
| **Input validation checks** | 5 (4.6%) | D7 | **Critical** — near-zero validation |
| **Trust boundary violations** | 22 DB operations | D6 | **High** — untrusted input to DB directly |
| **Upload routes without type validation** | 4 (100%) | S7/D5 | **High** — no content validation |
| **Encryption gaps** | MD5 passwords, plaintext cards, plaintext TOTP | D4 | **High** — inadequate crypto |
| **WebSocket entry points** | 1, no auth | S9 | **Medium** — no connection auth |
| **Security SPOFs** | hash(9 files), verify(8 files) | D3 | **High** — single file is security kernel |
| **Error information leakage** | Global handler leaks raw errors + Express version | S6 | **Medium** |

**Composite attack surface score:**
- **Entry points**: 109 routes + 1 WebSocket + 57 middleware = 167 server-side entry points
- **Unprotected attack surface**: 58 routes + 1 WebSocket = 59 unauthenticated entry points (35% of total)
- **Unvalidated data paths**: 22 DB operations accept untrusted input with zero validation
- **Security-critical functions concentrated in one file**: `lib/insecurity.ts` (19 functions, intentionally weak implementations)

**Tool verdict:** Both contributed at different levels. GitNexus provided architectural scale metrics (2,500 symbols, 139 processes, 34 modules) — the structural size of the attack surface. Joern provided security-specific metrics (unprotected routes, validation gaps, crypto weaknesses) — the exploitable portion. D11 is primarily an aggregation of findings from S1-S9 and D1-D10.

**v3 comparison:** Not tested in v3 as aggregate metric. v3 had individual findings but no composite surface area view.

**Verdict:** Pass 1 sufficient — D11 is a summarization of all prior queries. No new analysis needed. The two-pass approach produces a complete attack surface picture: architectural scope from GitNexus, security specifics from Joern.

---

## Pass 2 summary

| Query | CWE | Finding | Answered by | Pass 1 sufficient? | v3 match? |
|-------|-----|---------|-------------|--------------------|-----------|
| D1 | 269 | ~58 unprotected routes (53%) | Joern | Yes | Yes (64 vs ~58 — we deducted path-scoped auth) |
| D2 | 269 | 5 files with DB writes + no auth | Joern | Yes | Consistent (v3: 18 writes in 12 files — different methodology) |
| D3 | 269 | hash(9 files), verify(8 files) — single-file security kernel | Both | Yes | Yes (hash=9 matches exactly) |
| D4 | 311 | MD5 passwords, plaintext cards, plaintext TOTP, hardcoded HMAC key | Joern | Yes | n/a |
| D5 | 434 | 4 upload routes, zero content validation — `checkFileType` is fake | Both | Yes (S7 already answered) | n/a |
| D6 | 501 | 22 DB ops with untrusted input; chatbot→username; mass assignment | Joern | Yes | n/a |
| D7 | 602 | 5 validation checks / 109 handlers (4.6%) — all password-emptiness | Joern | Yes | Yes (0 libraries, near-zero ad-hoc) |
| D8 | 653 | 4 unprotected handlers call security functions; 5 write to DB | Both | Yes | n/a |
| D9 | 799 | 4/109 rate-limited (3.7%) — login not rate-limited | Joern | Yes (S8 already answered) | n/a |
| D10 | 841 | Purchase flow: no server-side state machine, steps skippable | Joern (GitNexus partial) | Partial — needed handler source | n/a |
| D11 | 1125 | 59 unauthenticated entry points, 22 unvalidated data paths | Both | Yes (aggregation) | n/a |

## Observations

### Two-pass approach validation

1. **Pass 1 extracted the right facts.** All 9 structural queries produced information that Pass 2 consumed. S3 found auth middleware names without being told. S4 found DB operations. S5 confirmed no validation. S1 found all routes centralized in `server.ts`. No human read the source code to formulate Pass 1 queries.

2. **Pass 2 produced actionable findings.** All 11 design queries returned concrete, CWE-mapped results. D1 found unprotected routes. D2 found exposed DB writes. D4 found inadequate encryption. D6 found trust boundary violations that v3 didn't test for. Results match v3 where comparable and exceed it with 8 new CWE categories.

3. **The two-pass split worked.** Pass 1 outputs (auth middleware names, route registrations, DB operations, validation absence) were sufficient to formulate Pass 2 queries. The LLM (Claude) generated targeted CPGQL expressions using structural facts from Pass 1 — no source code reading needed for query formulation.

4. **New CWEs added significant value.** D4 (encryption), D5 (file upload), D6 (trust boundary), D8 (isolation), D9 (rate limiting), D10 (workflow), D11 (surface area) found issues v3 didn't look for. D6 (trust boundary violations — 22 DB operations with untrusted input, chatbot→username overwrite) was the strongest new finding.

### Tool comparison: GitNexus vs Joern

| Capability | GitNexus | Joern |
|------------|----------|-------|
| **Answered fully** | — | S1, S2, S5, S6, S8, D1, D2, D4, D6, D7, D9 |
| **Complementary** | S3, S4, S7, S9, D3, D5, D8, D11 | (same questions, different angle) |
| **Partial** | D10 | D10 |
| **Can't answer** | S2, S6, S8, D1, D2, D4, D6, D7, D9 | — |

**GitNexus strengths:**
- **Blast radius / fan-in** (D3, D8): 20 affected processes for `hash`, depth-stratified impact with confidence scores. This is what GitNexus is built for and Joern doesn't provide.
- **Module discovery** (S3): Found the full 19-function security module via community detection — broader than Joern's call-level view.
- **Architectural overview** (D11): 2,500 symbols, 139 processes, 34 modules — structural scale metrics.
- **Absence confirmation** (S5): No validation symbols in any cluster — same conclusion as Joern, equally fast.

**GitNexus limitations:**
- **Can't see call arguments** — middleware application, rate limit config, and route registration details are invisible (expression-level data).
- **Can't distinguish call semantics** — knows `handleZipFileUpload` calls `endsWith` but can't tell if it's validation or string processing.
- **Can't read function bodies** — the `checkFileType` false positive (looks like validation, always passes) is only detectable with `get_source`.
- **Can't do taint analysis** — D4, D6 trust boundary tracing is Joern only.

**Granularity gap confirmed:** GitNexus operates at symbol level (functions, files, relationships). Joern operates at expression level (individual calls, arguments, data flow). Design analysis requires expression-level precision for most questions. GitNexus adds architectural context that Joern can't provide (module structure, process traces, blast radius).

### Critical gate assessment

**Gate P1: Do generic structural queries extract enough architectural facts for Pass 2?**

**Result: PASS.** Pass 1 extracted:
- Auth middleware names (S3) → used in D1 negative filter
- Route registration patterns (S1) → used in D1, D2, D9
- DB operation locations (S4) → used in D2, D8
- Validation absence (S5) → used in D7
- Rate limiting scope (S8) → used in D9
- File upload patterns (S7) → used in D5
- Error handling (S6) → informs but not consumed by D-queries
- WebSocket entry (S9) → used in D11 surface count

All Pass 2 queries were formulated using Pass 1 outputs + stack profile. No source code was read to formulate queries (source was read to validate findings and understand implementations, but not to know what to ask).

### `get_source` dependency

5 of 11 Pass 2 queries critically depended on Joern's `get_source`:
- D4: Reading `hash()` revealed MD5 (not just "hashing exists")
- D5: Reading `checkFileType` revealed it always passes (fake validation)
- D6: Reading `chatbot.ts` revealed username overwrite from chatbot query
- D8: Reading handler source showed which security functions are called
- D10: Reading `placeOrder` revealed missing workflow verification

Without `get_source`, the CPG queries would produce structural facts ("this function is called") but not semantic understanding ("this function doesn't actually validate"). The two-pass approach works, but the second pass needs function body access for 5/11 questions.

## Verdict

**The two-pass CPG approach is validated.** It produced 11 CWE-mapped design findings across 8 OWASP A06 categories, matching v3 results where comparable and exceeding them with 8 new categories. Pass 1 correctly identified the architectural patterns that Pass 2 consumed. No human read the source code to formulate queries.

**Key insight:** The approach works because the LLM reasons over structured outputs (middleware names, route counts, DB operation locations), not source code. The CPG carries the cross-partition knowledge that enables negative queries ("routes WITHOUT auth") and set operations ("DB writes IN unprotected routes") — exactly the queries that pattern matchers and LLM-only approaches can't express.

**Limitation:** `get_source` was needed for 5/11 Pass 2 queries. This is still small and targeted (reading specific function bodies, not whole files), but it means the LLM can't be completely isolated from code. The structured summary is necessary but not always sufficient — sometimes you need to read 10 lines of implementation to understand if a structural fact is real or a false positive.

**GitNexus role:** Complementary, not primary. Strongest on D3 (blast radius), D8 (downstream reachability), and S3 (module discovery). Can't answer expression-level questions (9 of 20 total questions). Adds architectural context that improves the narrative but doesn't change the findings. If forced to choose one tool, Joern is necessary and sufficient for design analysis; GitNexus is valuable but optional.
