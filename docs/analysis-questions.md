# Question Plan

Questions for the two-pass CPG approach against `~/public/vulnerable-app`.
Each question is plain English first, then what it needs, then how each tool answers it (or can't).

See `owasp-a06-cwe-mapping.md` for the full CWE analysis that produced the target list.

## Tools

Two graph engines are indexed over the same codebase:

| Tool | What it models | Granularity | Strengths |
|------|---------------|-------------|-----------|
| **Joern** | Code Property Graph (443K nodes) | Expression-level — individual calls, arguments, data flow between expressions | Taint analysis, negative sub-traversals, CPGQL for arbitrary structural queries |
| **GitNexus** | Code knowledge graph (2500 nodes, 6806 edges) | Symbol-level — functions, classes, files and their relationships | Community detection (34 modules), execution flow tracing (139 processes), impact/blast radius |

**Approach:** Try GitNexus first for questions where symbol-level analysis might suffice. Record what it returns. Fall back to Joern where expression-level detail is needed. Document the verdict per question — what worked, what didn't, and why. If GitNexus adds nothing beyond what Joern provides, we drop it from scope and explain the granularity gap.

## What we're testing

Can the two-pass approach — generic structural queries first, then targeted design queries — produce A06 findings without a human reading the source code?

The stack profile is given (Express 4, Sequelize 6, custom auth, no validation library). Pass 1 discovers the architectural patterns. Pass 2 uses those patterns to run the 9 CWE-mapped design queries.

**Success means:** Pass 2 findings match or exceed the v3 manual results, and Pass 1 correctly identified the patterns that Pass 2 needed (auth middleware names, route registration conventions, ORM methods, error handling architecture).

**Failure means:** Pass 1 misses critical structural facts, causing Pass 2 to ask the wrong questions or produce empty/misleading results.

## Critical gate

| Gate | Phase | Question | If it fails |
|------|-------|----------|-------------|
| **P1** | Pass 1 | Do generic structural queries extract enough architectural facts for Pass 2? | The two-pass approach doesn't work — you still need a human to read the code first. Falls back to manual query writing (what v3 did). |

If Pass 1 produces a structural summary that's sufficient for an LLM (or template selector) to generate correct Pass 2 queries, the approach is validated. If not, we learn where the gaps are.

## Pass 1: Structural extraction — "What does this app look like?"

These queries use only the stack profile (Express, Sequelize) and generic knowledge of the framework. They do NOT use application-specific knowledge (no `security.*`, no `server.ts`, no specific file names).

| # | Plain English | Needs | GitNexus | Joern |
|---|---------------|-------|----------|-------|
| S1 | Where are routes registered? | Express convention | **Try first.** "Routes" cluster has 227 symbols. `query` for route-related execution flows. Can identify route files and handler functions, but can't enumerate `app.get/post()` call patterns or extract path arguments. | Find `app.get/post/put/delete/use()` calls. Which files? How many? What pattern — centralized or scattered? |
| S2 | What middleware functions are used in route registration? | S1 results | **Can't answer.** Middleware lives in call arguments to route registration — expression-level, not symbol-level. | From route registration calls, extract all arguments that aren't string literals (paths) or the final handler. These are the middleware. Group and count. |
| S3 | Which middleware functions look like auth/security? | S2 results | **Try first.** `query` for auth/security concepts. Found `lib/insecurity.ts:hash`, 2FA components, `routes/2fa.ts:verify`. Finds auth-related *symbols* but not their role as middleware. | From the middleware list, identify functions with names suggesting auth: `auth`, `authorize`, `isAuthorized`, `login`, `session`, `jwt`, `token`, `verify`, `role`, `permission`, `admin`, `security`. |
| S4 | What ORM/DB operations exist and where? | Sequelize convention | **Try first.** `query` for database/ORM concepts. Found `datacreator.ts` functions and route handlers with DB code. Can identify *which files* touch the DB, but can't list specific `findOne`/`create` calls. | Find all calls to Sequelize methods: `findOne`, `findAll`, `create`, `update`, `destroy`, `increment`, `decrement`, `query`, `bulkCreate`. Which files contain them? |
| S5 | Is there a centralized validation layer? | Express convention | **Can confirm absence.** No validation-related symbols in any cluster. Same conclusion as Joern, faster. | Search for validation library imports (`express-validator`, `joi`, `zod`, `yup`, `ajv`, `celebrate`). Search for validation middleware in route registrations. Search for type-checking patterns on `req.body/query/params`. |
| S6 | How are errors handled? | Express convention | **Unlikely.** Didn't surface error handler patterns. Error handling is an expression-level convention (4-arg middleware). | Find the global error handler (4-argument Express middleware). Find all `res.status(4xx/5xx)` calls. Find `next(error)` calls. Which files? |
| S7 | What file upload handling exists? | Multer in deps | **Try first.** Found `handleZipFileUpload`, `ensureFileIsPassed`, `profileImageFileUpload` — the handler functions and their files. Can map the upload architecture. | Find `multer()` configuration, `upload.single/array/fields()` middleware usage. Is file type validation present? Expression-level detail. |
| S8 | Is rate limiting applied? | express-rate-limit in deps | **Unlikely.** Rate limit config is a call expression, not a named symbol. | Find `rateLimit()` calls. Where are they used — globally or per-route? Which routes have it, which don't? |
| S9 | What are the entry points for real-time communication? | socket.io in deps | **Try first.** `context(start)` showed `registerWebsocketEvents` as a callee. Can map the WebSocket entry point and its callees. | Find `io.on('connection')` handlers. What events are registered? Any auth on socket connections? Expression-level detail. |

**What we learn from Pass 1:** An architectural summary — not source code, but structured facts. Route count, middleware inventory, auth function names, DB operation locations, validation presence/absence, error handling pattern, upload handling, rate limiting coverage. This is what Pass 2 consumes.

**Tool expectation for Pass 1:** GitNexus may contribute to S1, S3, S4, S5, S7, S9 (architectural overview, symbol identification). Joern is required for S2, S6, S8 (expression-level detail) and to fill gaps in the others. We try GitNexus first where marked, record what it produces, then run Joern for the full picture.

## Pass 2: Design analysis — "Where are the design flaws?"

Each question maps to a CWE from the A06 structural list. Each query uses Pass 1 outputs (middleware names, route patterns, DB locations) to formulate targeted queries.

### CWE-269 — Improper Privilege Management

| # | Plain English | Needs | GitNexus | Joern |
|---|---------------|-------|----------|-------|
| D1 | Which routes have no auth middleware? | S1 (route registrations), S3 (auth middleware names) | **Can't answer.** Requires matching call arguments — expression-level. | Filter route registrations where no argument matches the auth middleware names from S3. Negative sub-traversal. |
| D2 | Which DB write operations are in unprotected routes? | D1 (unprotected routes), S4 (DB operations) | **Can't answer.** Set intersection of expression-level facts from D1+S4. | Cross-reference: DB writes in files/functions reachable from D1's unprotected route list. Set intersection. |
| D3 | Which security functions have excessive fan-in? | S3 (security function names) | **Try first.** `impact(upstream)` on security functions gives caller count with depth. This is exactly what GitNexus's blast radius does. | Count unique callers per security function across the codebase. Rank by fan-in. |

### CWE-311 — Missing Encryption of Sensitive Data

| # | Plain English | Needs | GitNexus | Joern |
|---|---------------|-------|----------|-------|
| D4 | Do any data flows from sensitive sources to network/storage sinks skip encryption? | S4 (DB operations), stack profile (crypto libs) | **Can't answer.** Data flow / taint analysis — Joern only. | Taint from variables named `password`, `secret`, `token`, `key` to storage/network sinks. Check for absence of hash/encrypt calls in the path. |

### CWE-434 — Unrestricted Upload of File with Dangerous Type

| # | Plain English | Needs | GitNexus | Joern |
|---|---------------|-------|----------|-------|
| D5 | Do file upload handlers validate content type? | S7 (upload handling) | **Partial.** Can show callees of upload handlers (what they call downstream). Can't check for absence of validation in the call chain. | From upload middleware locations, trace the call chain. Does it include file-type validation (magic bytes, content-type check, extension allowlist)? Negative sub-traversal. |

### CWE-501 — Trust Boundary Violation

| # | Plain English | Needs | GitNexus | Joern |
|---|---------------|-------|----------|-------|
| D6 | Does untrusted input flow into trusted data structures? | S1 (entry points) | **Can't answer.** Taint analysis — Joern only. | Taint from `req.body/query/params` to session objects, auth context, or role assignments. |

### CWE-602 — Client-Side Enforcement of Server-Side Security

| # | Plain English | Needs | GitNexus | Joern |
|---|---------------|-------|----------|-------|
| D7 | Do server-side route handlers have their own validation? | S5 (validation layer) | **Can't answer.** Needs expression-level call chain analysis within handlers. | For each route handler, does the call chain include any input validation before reaching business logic or DB operations? Global negative query. |

### CWE-653 — Improper Isolation/Compartmentalization

| # | Plain English | Needs | GitNexus | Joern |
|---|---------------|-------|----------|-------|
| D8 | Can unauthenticated entry points reach privileged operations? | D1 (unprotected routes), S4 (DB operations) | **Try first.** `impact(downstream)` from route handlers shows transitive reachability — what operations a handler can reach. This is structural reachability, which is what GitNexus models. | Transitive reachability from unprotected route handlers to privileged operations. Joern gives expression-level precision. |

### CWE-799 — Improper Control of Interaction Frequency

| # | Plain English | Needs | GitNexus | Joern |
|---|---------------|-------|----------|-------|
| D9 | Which sensitive endpoints lack rate limiting? | S8 (rate limit locations), S1 (routes) | **Can't answer.** Rate limit application is expression-level (call arguments). | Cross-reference rate-limited routes with auth/login/sensitive endpoints. Set difference. |

### CWE-841 — Improper Enforcement of Behavioral Workflow

| # | Plain English | Needs | GitNexus | Joern |
|---|---------------|-------|----------|-------|
| D10 | Can workflow steps be skipped? | S1 (routes), S4 (DB operations) | **Try first.** Process traces (e.g., "Login → GetCtfKey", 7 steps) show multi-step flows. Can reveal whether steps are coupled or independent. | For multi-step flows, does each step verify the prior step completed? State validation in handlers. Hardest query — may need heuristics. |

### CWE-1125 — Excessive Attack Surface

| # | Plain English | Needs | GitNexus | Joern |
|---|---------------|-------|----------|-------|
| D11 | How large is the attack surface? | S1 (routes), D1 (unprotected routes), S4 (DB operations) | **Try first.** Cluster stats (227 route symbols, 34 modules), process counts, community structure give a high-level surface area picture. | Quantitative: total routes, unprotected routes, DB operations reachable from unprotected routes. Expression-level precision. |

**Tool expectation for Pass 2:** Joern is required for D1, D2, D4, D6, D7, D9 (expression-level analysis, taint, negative sub-traversals). GitNexus may contribute to D3, D5, D8, D10, D11 (fan-in, reachability, process traces, surface metrics). We try GitNexus first where marked.

## Cross-reference with v3

The v3 evaluation ran 5 manual queries. This plan covers the same ground and more:

| v3 query | This plan |
|----------|-----------|
| Q1: Routes without auth (CWE-306) | D1 (same question, derived from S1+S3 instead of manual knowledge) |
| Q2: DB writes without auth (CWE-862) | D2 (same question, derived from D1+S4) |
| Q3: Sensitive function fan-in (CWE-269) | D3 (same question, derived from S3) |
| Q4: Error leaking (CWE-209) | S6 covers error handling extraction; D-level query could be added if S6 reveals issues |
| Q5: Missing validation layer (CWE-602) | D7 + S5 (split between structural extraction and design query) |
| — not in v3 — | D4 (encryption), D5 (file upload), D6 (trust boundary), D8 (isolation), D9 (rate limiting), D10 (workflow), D11 (surface area) |

## What "success" looks like

After running both passes:

1. **Pass 1 extracted the right facts.** S3 found the auth middleware names without being told. S4 found DB operations. S5 confirmed no validation. S6 found the error handler. No human read the source.
2. **Pass 2 produced actionable findings.** D1 found the unprotected routes. D2 found the exposed DB writes. Results match or exceed v3.
3. **The two-pass split worked.** Pass 1 outputs were sufficient to formulate Pass 2 queries. The LLM (or template) didn't need to see source code — structured facts were enough.
4. **New CWEs added value.** D5-D11 found issues v3 didn't look for: file upload validation, trust boundaries, rate limiting gaps, workflow enforcement, attack surface metrics.
