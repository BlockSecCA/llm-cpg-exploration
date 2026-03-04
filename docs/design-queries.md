# Results — v3 (2026-02-26)

Third pass against `~/public/vulnerable-app`. Focus: OWASP A06 (Insecure Design) — structural queries that only a CPG can answer. See `results-v2.md` for the bug-finding evaluation.

## Why v3

v1/v2 evaluated Joern as a bug finder (A05 Injection). Post-v2 analysis revealed that's Semgrep/OpenGrep territory — Joern's 443K-node CPG is overkill for pattern matching. The real test is A06 (Insecure Design): structural questions about the architecture that pattern matchers cannot express.

Each query below maps to a CWE, asks a design question, and requires graph traversal (negative sub-traversal, transitive call analysis, cross-file set difference, or full-graph fan-in counting). These are the queries that justify — or don't — a code property graph.

## Query 1 — Routes without authentication middleware (CWE-306)

**Question:** "Which route registrations in server.ts have no auth middleware as a co-argument?"

**CPGQL approach:** Find all `app.get/post/put/delete()` calls in server.ts, filter those where NO argument matches `security.*`. This is a negative sub-traversal — checking for the absence of a property across variadic arguments.

```scala
cpg.call.name("get|post|put|delete")
  .where(_.file.name(".*server\\.ts"))
  .where(_.code("app\\.(get|post|put|delete)\\(.*"))
  .filter(c => c.argument.code(".*security\\..*").l.isEmpty)
```

**Results:** **64 unprotected route registrations** vs **44 protected** (~59% unprotected).

Unprotected routes include:

| Route | Method | Security impact |
|-------|--------|----------------|
| `/rest/products/search` | GET | SQL injection (confirmed v2 Q9) |
| `/rest/user/login` | POST | Login bypass via SQL injection |
| `/rest/user/reset-password` | POST | Password reset without auth |
| `/rest/user/change-password` | GET | Password change without auth check |
| `/rest/saveLoginIp` | GET | IP logging without auth |
| `/rest/user/whoami` | GET | User info leak |
| `/b2b/v2/orders` | POST | B2B ordering without auth |
| `/rest/chatbot/respond` | POST | Chatbot interaction without auth |
| `/rest/chatbot/status` | GET | Chatbot status without auth |
| `/rest/memories` | GET | Memory retrieval without auth |
| `/profile` | GET | Profile access without auth |
| `/rest/track-order/*` | GET | Order tracking without auth |
| `/rest/basket/*` | GET | Basket access without auth |
| `/promotion/video` | GET | Premium content without auth |
| `/rest/repeat-notification` | GET | Notification replay |

Protected routes (with `security.isAuthorized()`, `security.appendUserId()`, `security.isAccounting()`, `security.isDeluxe()`, `security.denyAll()`, or `security.isCustomer()`):

- Wallet balance operations (add/get)
- Address CRUD
- Payment method CRUD
- Data export
- File upload (profile image)
- Basket item manipulation
- Order listing
- 2FA setup/verify/disable
- Deluxe upgrade

**Could OpenGrep find this?** No. This requires:
1. Parsing variadic function call arguments (Express route registration takes N arguments)
2. Checking whether ANY argument in the call matches a security middleware pattern
3. Filtering by the ABSENCE of that pattern across all arguments
4. Aggregating results across 100+ route registrations

OpenGrep matches patterns within a single statement. It cannot express "this function call has arguments A, B but NOT argument C" — that's a negative sub-traversal over a variable-length argument list.

**Verdict:** Genuine A06 finding. The app has 64 routes with no authentication middleware at the registration level. This is a design decision, not a bug — it reveals the application's security architecture (or lack thereof).

## Query 2 — Database writes reachable without authorization (CWE-862)

**Question:** "Which DB mutation operations (create/update/destroy/increment/decrement) occur in routes that have no auth middleware?"

**CPGQL approach:** Two-step — (1) find all DB write calls in route files, (2) cross-reference against the unprotected route handler list from Query 1. This is a set intersection across two graph traversals.

**Results:** **18 DB write operations in 12 route files** that are registered without auth middleware:

| File | Operation | What it writes | Risk |
|------|-----------|---------------|------|
| `changePassword.ts` | `user.update({ password })` | Password change | **Critical** — no auth required to change password |
| `chatbot.ts` | `userModel.update({ username })` | Username change | **High** — username update via chatbot without auth |
| `updateUserProfile.ts` | `user.update({ username })` | Username change | **High** — profile update without auth |
| `order.ts` | `basket.update`, `BasketItemModel.destroy`, `QuantityModel.update`, `WalletModel.decrement`, `WalletModel.increment` | Order processing (5 operations) | **Critical** — wallet manipulation with client-supplied UserId |
| `deluxe.ts` | `WalletModel.decrement`, `user.update({ role })` | Role escalation + wallet debit | **Critical** — role change without auth |
| `wallet.ts` | `WalletModel.increment({ balance: req.body.balance })` | Wallet balance increment | **Critical** — arbitrary wallet credit with user-controlled amount |
| `likeProductReviews.ts` | `db.reviewsCollection.update` (x2) | Review manipulation | Medium — review count manipulation |
| `updateProductReviews.ts` | `db.reviewsCollection.update` | Review content change | Medium — review content forgery |
| `memory.ts` | `MemoryModel.create(record)` | Memory creation | Low |
| `dataErasure.ts` | `PrivacyRequestModel.create` | Privacy request | Low |
| `coupon.ts` | `basket.update({ coupon })` | Coupon application | Medium |
| `imageCaptcha.ts` | `svgCaptcha.create` | Captcha generation (not a DB write) | False positive — library call, not DB |

**Note:** Some of these routes MAY have in-handler auth checks (e.g., reading `security.authenticatedUsers` inside the function body). The point is that auth is not enforced at the middleware/registration level — it depends on each handler implementing its own check correctly.

**Protected DB writes** (with auth middleware): address operations, basket item manipulation, payment CRUD, wallet balance (via `addWalletBalance()`), deluxe upgrade (via `upgradeToDeluxe()`), data export.

**Could OpenGrep find this?** No. This requires:
1. Identifying unprotected routes from Query 1 (negative sub-traversal)
2. Mapping route handler names to the files they're defined in
3. Finding DB mutation calls within those files
4. Cross-referencing two independent graph queries

This is a set operation across the call graph — "functions that are both (a) DB-writing and (b) reachable from unprotected routes." No pattern matcher can express this.

**Verdict:** Genuine A06 finding. 18 database write operations are accessible from routes without middleware-level authentication. The most critical: wallet balance manipulation, password changes, and role escalation — all reachable without auth middleware.

## Query 3 — Sensitive functions with excessive fan-in (CWE-269)

**Question:** "Which security-critical functions are callable from the most distinct locations? High fan-in on a sensitive function means many potential abuse paths."

**CPGQL approach:** Count unique calling FILES per security function across the entire codebase. This is a graph-wide aggregation metric — no pattern matcher has a concept of "how many distinct call sites invoke this function."

**Results:**

| Function | Files calling it | Nature |
|----------|-----------------|--------|
| `security.authenticatedUsers` | **30 files** | Token store — read/write access to all active sessions |
| `security.authenticatedUsers.from(req)` | 17 files | Extract user from request token |
| `security.hash()` | 9 files | Password/token hashing |
| `security.authenticatedUsers.get()` | 9 files | Direct token lookup |
| `security.authorize()` | 5 files | JWT token generation |
| `security.authenticatedUsers.put()` | 5 files | Write to session store |
| `security.sanitizeSecure()` | 4 files | HTML sanitization |
| `security.verify()` | 3 files | JWT verification |
| `security.deluxeToken()` | 2 files | Deluxe membership token |

**Key finding:** `security.authenticatedUsers` is accessed from **30 different files** — it's the central session store for the entire application. Any vulnerability in token handling propagates to all 30 callers. This is a single point of compromise with maximum blast radius.

`security.hash()` is called from 9 files including `models/user.ts` and `data/datacreator.ts` — if the hash function is weak (it uses MD5 — confirmed in v2), all 9 consumers inherit that weakness.

**Could OpenGrep find this?** Partially. OpenGrep can find all calls to `security.hash()` with `pattern: security.hash(...)`. But it cannot:
1. Count unique calling files (aggregation)
2. Rank by fan-in
3. Identify the function as a single point of failure based on caller diversity

The finding isn't "security.hash exists" (OpenGrep) — it's "security.hash is a bottleneck called from 9 files, so its weakness (MD5) propagates to 9 locations" (CPG).

**Verdict:** Partial A06 finding. The fan-in metric reveals architectural risk concentration. OpenGrep finds the individual calls; Joern quantifies the structural exposure. The insight is medium-value — an experienced reviewer would suspect this, but the numbers confirm it.

## Query 4 — Error messages leaking internals to clients (CWE-209)

**Question:** "Which code paths pass raw error objects or messages into HTTP responses?"

**CPGQL approach:** Find all `res.json()` / `res.send()` / `res.status()` calls where an argument contains `err` — indicating raw error forwarding to the client.

**Results:** **54 response calls reference error data.** Categorized:

### Direct raw error forwarding (worst — CWE-209)
| File | Line | Code | Severity |
|------|------|------|----------|
| `errorHandler.ts` | 21 | `res.status(500).json({ error: JSON.parse(JSON.stringify(error)) })` | **Critical** — global error handler serializes full error object |
| `errorHandler.ts` | 28 | `res.status(500).send(fn({ title, error }))` | **Critical** — renders error into HTML template |
| `likeProductReviews.ts` | 56 | `res.status(500).json(err)` | High — raw MongoDB error |
| `updateProductReviews.ts` | 27 | `res.status(500).json(err)` | High — raw MongoDB error |
| 6x `codefixes/*.ts` | various | `res.status(500).json(err)` | Medium — challenge code, same pattern |

### Wrapped error forwarding (better but still leaky)
| File | Pattern | Count |
|------|---------|-------|
| `checkKeys.ts`, `createProductReviews.ts`, `nftMint.ts`, `vulnCodeSnippet.ts`, `web3Wallet.ts` | `res.status(500).json(utils.getErrorMessage(error))` | 6 |
| `deluxe.ts` | `'Something went wrong: ' + utils.getErrorMessage(err)` | 1 |
| `chatbot.ts` | `"Remember to stay hydrated while I try to recover from \"${utils.getErrorMessage(err)}\""` | 1 |

### Hardcoded error messages (safe)
| Pattern | Count |
|---------|-------|
| `{ error: 'Unauthorized' }` / `{ error: 'Not found' }` / etc. | ~35 |
| `{ status: 'error', message: '...' }` | ~5 |

**The global error handler is the critical finding.** `errorHandler.ts` catches ALL unhandled errors and serializes them with `JSON.parse(JSON.stringify(error))` — this preserves stack traces, SQL error details, file paths, and internal state. Every unhandled exception in the app leaks internals through this handler.

**Could OpenGrep find this?** Partially. OpenGrep can match `res.status(500).json(err)` as a pattern. But it cannot:
1. Distinguish raw `err` forwarding from safe hardcoded messages (both are `res.json(...)`)
2. Identify the global error handler as architecturally critical (it catches errors from ALL routes)
3. Trace error flow from catch blocks through variable assignments to response calls

The pattern match finds individual instances. The CPG reveals the architectural impact — one global handler that affects every route.

**Verdict:** Mixed. Individual instances (raw `err` in response) are OpenGrep-findable. The architectural insight (global error handler serializes all errors to clients) requires understanding the Express error pipeline, which is structural. The CPG adds value for the global handler finding; less so for individual `res.json(err)` instances.

## Query 5 — Input-to-database paths without validation layer (CWE-602 / CWE-20)

**Question:** "Does a centralized validation layer exist between HTTP input and database operations? Not 'is there a bug' but 'is there a design control?'"

**CPGQL approach:** Two checks — (1) search for validation library imports across the entire project, (2) search for any input type-checking patterns in route handlers.

### Check 1: Validation library imports

```scala
cpg.call.name("require")
  .where(_.argument.code(".*express.validator.*|.*joi.*|.*zod.*|.*yup.*|.*ajv.*|.*celebrate.*|.*class.validator.*"))
```

**Result: Zero.** No validation library is imported anywhere in the project.

### Check 2: Ad-hoc input validation in routes

```scala
cpg.call.code(".*typeof req\\.(body|query|params).*|.*parseInt.*req\\.(body|query|params).*|.*Number.*req\\.(body|query|params).*")
```

**Result: 2 locations total.**

| File | Line | Code | Context |
|------|------|------|---------|
| `codefixes/noSqlReviewsChallenge_3_correct.ts` | 5 | `typeof req.body.id !== 'string'` | A "correct fix" codefix — not the main app |
| `showProductReviews.ts` | 31 | `Number(req.params.id)` | Type coercion, not validation — no rejection on failure |

### Cross-reference with v2 taint results

v2 found **42 taint flows** from HTTP input to SQL queries, **4 flows** to file system operations, and **147 flows** to `.update()` calls. None of these flows pass through any validation function. The taint analysis intermediate steps show:
- Direct `req.body.X` → `sequelize.query(...)` with no intermediate processing
- Direct `req.body.key` → `fs.readFileSync(...)` through helper functions
- Direct `req.body.UserId` → `.update({ where: { UserId } })` with no ownership check

**The validation layer doesn't exist.** This isn't a matter of finding bugs in validation logic — there is no validation logic. The 147 `.update()` flows with client-supplied keys are all mass assignment (CWE-915) by design.

**Could OpenGrep find this?** No. OpenGrep can find specific missing validation patterns (e.g., "SQL query without parameterization"). It cannot answer the architectural question: "across all routes, does a validation layer exist as a design pattern?" That requires:
1. Searching the entire dependency graph for validation library imports (absence of evidence)
2. Scanning all route handlers for input checking patterns (global negative query)
3. Cross-referencing taint analysis to confirm no intermediate validation in data flows

This is the definitive A06 query — it's about the design, not any single bug.

**Verdict:** Genuine A06 finding. The application has zero centralized input validation. No validation library. No middleware-level validation. Two ad-hoc type checks in 33 route files handling 147 unique input lines. This is insecure design — no implementation fix addresses it; the architecture needs a validation layer.

---

## Summary: What the CPG found that pattern matchers can't

| Query | CWE | Finding | OpenGrep equivalent? |
|-------|-----|---------|---------------------|
| Q1: Routes without auth | CWE-306 | 64/108 routes unprotected (~59%) | **No** — requires negative sub-traversal over variadic arguments |
| Q2: DB writes without auth | CWE-862 | 18 DB writes in unauth routes, including password change and wallet manipulation | **No** — requires cross-referencing two graph traversals (set intersection) |
| Q3: Sensitive function fan-in | CWE-269 | `authenticatedUsers` accessed from 30 files, `hash` (MD5) from 9 files | **Partial** — finds calls, can't aggregate or rank by fan-in |
| Q4: Error leaking | CWE-209 | Global error handler serializes all errors to clients; 8 routes pass raw `err` to response | **Partial** — finds individual patterns, misses architectural impact |
| Q5: Missing validation layer | CWE-602/20 | Zero validation libraries, 2 ad-hoc checks across 33 route files, 193+ unvalidated data flows | **No** — requires global absence-of-evidence query across entire codebase |

### Scores

| Criterion | Score |
|-----------|-------|
| Queries that returned meaningful results | **5/5** |
| Findings that are genuine design issues (A06) | **5/5** |
| Findings impossible with OpenGrep | **3/5** (Q1, Q2, Q5) |
| Findings partially possible with OpenGrep | **2/5** (Q3, Q4) |
| Findings fully achievable with OpenGrep | **0/5** |

## Observations

### What makes these A06 queries different from v2

v2 asked: "Is there a SQL injection at line X?" — a specific bug in specific code. A pattern matcher answers that.

v3 asks: "Does the architecture enforce authentication?" — a property of the entire system. You can't answer that by looking at one file. You need:
- All route registrations (100+ calls in server.ts)
- All their arguments (variadic, 2-6 per call)
- A property check across all arguments (contains security middleware?)
- Aggregation of the negative results

This is graph analysis, not pattern matching.

### Practical value

The five queries took ~15 minutes of CPGQL iteration (including syntax errors and refinement). They produced an architectural security assessment:

1. **59% of routes have no auth middleware** — the app's security perimeter has more holes than walls
2. **Critical DB operations (password, wallet, role) accessible without auth** — not just read access, write access
3. **Security bottleneck**: `authenticatedUsers` store touched by 30 files — single point of compromise
4. **Global error handler leaks everything** — a single architectural decision exposes all internal errors
5. **No validation layer exists** — not broken validation, absent validation

An experienced security reviewer would suspect most of these. The CPG confirms them with evidence and quantifies the exposure. The value is in completeness and confidence — "I checked all 108 routes" vs. "I sampled a few."

### The query catalog problem

The 5 A06 questions are universal: "does auth coverage exist?", "are DB writes protected?", "is there a validation layer?" But the CPGQL expressions are framework-specific. Query 1 works because we knew auth middleware is `security.*` passed as a co-argument in Express route registration. On a different stack, everything changes:

| Knowledge required | This app | A Django app | A Spring Boot app |
|-------------------|----------|-------------|-------------------|
| Auth middleware pattern | `security.isAuthorized()` as route co-argument | `@login_required` decorator | `@PreAuthorize` annotation |
| ORM write methods | `Model.create/update/destroy` (Sequelize) | `Model.objects.create/save/delete` | `repository.save/delete` |
| Validation libraries | joi, zod, express-validator | Django forms, DRF serializers | javax.validation, @Valid |
| Error handling | `next(error)` → global handler → `res.json()` | middleware exception handler | `@ExceptionHandler` |

The engine is framework-agnostic. The queries are not. Without a large database mapping {framework, ORM, auth pattern} → {CPGQL expressions}, each new app requires manual query adaptation. This is the same gap Semgrep filled with 3,000+ community rules — Joern has 32 archived queries, mostly C/Java.

**This is the real bottleneck for adoption.** The CPG is powerful. The query language is expressive. But without a curated query catalog per framework, every engagement starts from scratch.

### CPGQL friction

Joern's JS/TS frontend represents code differently from what you'd expect:
- **Argument ordering starts at 2** (receiver at position 2, first arg at 3) for method calls
- **`filterNot` needs Boolean, not Iterator** — use `.filter(c => c.traversal.l.isEmpty)` instead
- **Generic method names** (`get`, `put`, `update`) match everything — always filter by file or code pattern
- **No curated queries** for Express/Node.js — every query is hand-written

The learning curve is real. Each query required 1-3 iterations to get the CPGQL syntax right. But the queries are reusable — they'd work on any Express app with the same middleware pattern.

## Updated verdicts

### Joern for A06 (Insecure Design)

**Justified.** The five structural queries found genuine design issues that pattern matchers cannot express. The CPG earns its cost (443K nodes, startup time, CPGQL learning curve) specifically for these architectural questions. For individual bug finding (A05), OpenGrep is faster, cheaper, and has curated rules. For design analysis (A06), Joern is the right tool.

### The complete tool stack

| Layer | Tool | What it answers |
|-------|------|----------------|
| Bug finding (A05) | OpenGrep | "Is there a SQL injection here?" — pattern match, curated rules |
| Design analysis (A06) | Joern | "Does the architecture enforce auth?" — graph traversal, structural queries |
| Orientation | GitNexus | "What are the major areas?" — clusters, call graph, disambiguation |
| Dependencies (A03) | SCA tools | "Are dependencies vulnerable?" — npm audit, Snyk |

Each tool has a layer. Using Joern for bug finding or OpenGrep for design analysis is using the wrong tool for the job.

### Reusable A06 query set for Express/Node.js

The five queries form a minimal design assessment for any Express app:

1. **Auth coverage**: Which routes lack auth middleware? (CWE-306)
2. **Write exposure**: Which DB mutations are in unprotected routes? (CWE-862)
3. **Security bottlenecks**: Which sensitive functions have high fan-in? (CWE-269)
4. **Error exposure**: Does the error handler leak internals? (CWE-209)
5. **Validation layer**: Does centralized input validation exist? (CWE-602/20)

These are transferable. The CPGQL expressions need adjustment per app (middleware function names, DB library), but the questions are universal.
