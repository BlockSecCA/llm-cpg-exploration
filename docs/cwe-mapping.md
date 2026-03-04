# OWASP A06 (Insecure Design) — CWE Mapping for CPG Detection

Which of the 39 CWEs under A06 are amenable to CPG structural analysis, and why.

## Categories

- **CPG-structural**: Requires graph traversal — call-graph reachability, negative sub-traversals, fan-in/fan-out, absence-of-pattern detection. These are design-level questions that Semgrep/OpenGrep cannot express. **This is our scope.**
- **CPG-pattern**: Detectable via taint analysis or call-site matching on the CPG, but Semgrep can do the same thing with pattern rules. Joern adds no unique value.
- **Runtime-only**: Requires dynamic execution context — timing, concurrency, multi-system interaction, rendered UI. No static tool can detect these.
- **Config/deployment**: About HTTP headers, TLS settings, server configuration. Not in application source code.
- **Ambiguous**: Abstract/pillar-level CWEs or detection depends heavily on specific manifestation.

## Full mapping

### CPG-structural (9) — Joern's unique value

These are the CWEs where a code property graph answers questions pattern matchers cannot.

**CWE-269 — Improper Privilege Management**
Privileges not properly assigned, tracked, or checked for actors.
*Detection*: Absence of authorization middleware/guards in call paths to sensitive operations. Fan-in analysis on privilege-checking functions. "Are there routes that reach admin functionality without passing through an authz check?"
*Why CPG*: Requires negative sub-traversal across the call graph — checking that a security gate does NOT exist on a path. No single-file pattern expresses this.

**CWE-311 — Missing Encryption of Sensitive Data**
Sensitive data stored or transmitted without encryption.
*Detection*: Sensitive data flows to network/storage sinks without passing through encryption functions. Negative sub-traversal: find paths from sensitive sources to sinks where no encrypt/hash node appears.
*Why CPG*: The query is about the absence of an intermediate node in a cross-file data flow path. Pattern matchers find what's present, not what's missing from a path.

**CWE-434 — Unrestricted Upload of File with Dangerous Type**
File upload accepts dangerous file types without validation.
*Detection*: Check whether file upload handlers have content-type validation, extension checking, or magic-byte verification in their call graph. Negative sub-traversal: upload endpoint reachable without file-type validation node.
*Why CPG*: Requires inspecting the full call chain from upload endpoint to storage — not just the handler function, but everything it calls. The question is "does this chain include a validation step?" which is a graph reachability query with a constraint.

**CWE-501 — Trust Boundary Violation**
Trusted and untrusted data mixed in the same structure without distinction.
*Detection*: Does untrusted input flow into a data structure (e.g., session object, context) that is later consumed as trusted? Track which fields are set from user input vs. internal logic.
*Why CPG*: Requires cross-file data flow tracking across trust boundaries — following a value from `req.body.X` into a session/state object, then tracking where that object is consumed as trusted. Two-hop taint with semantic context.

**CWE-602 — Client-Side Enforcement of Server-Side Security**
Security logic lives only in client code; server trusts it blindly.
*Detection*: Check whether server-side route handlers have their own validation/authorization, or if they accept client-submitted decisions without re-checking. Negative sub-traversal on server endpoints for absence of validation layers.
*Why CPG*: The architectural question — "does the server re-validate?" — requires checking all server endpoints for the presence (or absence) of validation logic. This is a whole-app structural property.

**CWE-653 — Improper Isolation or Compartmentalization**
Components at different privilege levels not properly isolated.
*Detection*: Check whether high-privilege functions are reachable from low-privilege entry points without authorization gates. Call-graph reachability with privilege boundary constraints.
*Why CPG*: The quintessential design-level CPG query. "Can an unauthenticated user reach an admin function?" requires traversing the entire call graph from public entry points and checking for authorization gates along every path. No pattern matcher can express transitive reachability with intermediate constraints.

**CWE-799 — Improper Control of Interaction Frequency**
No rate limiting on actions (brute force, vote stuffing, resource exhaustion).
*Detection*: Check whether authentication endpoints, login routes, or sensitive operations have rate-limiting middleware in their call chain. Absence-of-pattern detection on route definitions.
*Why CPG*: Same structure as CWE-269 — negative sub-traversal. "Does this route registration include a rate-limit middleware as a co-argument?" requires inspecting variadic arguments of all route registrations and filtering by absence.

**CWE-841 — Improper Enforcement of Behavioral Workflow**
Required action sequence not enforced; steps can be skipped or reordered.
*Detection*: Can endpoint B be reached without endpoint A having been called first? Check whether state-machine transitions are enforced — does the handler for step 2 verify that step 1 completed?
*Why CPG*: Requires understanding cross-endpoint state flow. "Does the payment endpoint check that the cart was validated?" is a reachability question across multiple request handlers with shared state. The hardest of the 9 to query — may need both graph structure and state-tracking heuristics.

**CWE-1125 — Excessive Attack Surface**
Product exposes more inputs/endpoints than necessary.
*Detection*: Count exposed routes, public methods, entry points. Measure fan-in from entry points to sensitive internals. Quantitative graph metric: "how many entry points exist, and how many reach sensitive operations?"
*Why CPG*: A whole-graph aggregation metric. The answer isn't "there's a bug here" but "the surface area is N, and M of those paths reach sensitive operations." No pattern matcher produces aggregate statistics over the entire codebase.

### CPG-pattern (16) — Detectable but Semgrep can do these

These are taint-analysis or call-site matching queries. Joern can run them, but the CPG structure isn't necessary — Semgrep/OpenGrep rules cover the same ground.

**CWE-73 — External Control of File Name or Path**
User input controls filesystem paths. Standard taint from HTTP input to file API sinks (`open`, `readFile`, `path.join`). Semgrep has rules for this.

**CWE-256 — Plaintext Storage of a Password**
Passwords stored without hashing. Taint from password variables to storage calls without hash/encrypt in path. Pattern-matchable.

**CWE-312 — Cleartext Storage of Sensitive Information**
Sensitive data written to storage without encryption. Taint to storage APIs from sensitive sources. Subset of CWE-311 but at the implementation level.

**CWE-313 — Cleartext Storage in a File or on Disk**
Subset of CWE-312. Taint to file-write APIs (`fs.writeFileSync`) from sensitive sources. Narrow pattern.

**CWE-382 — J2EE Bad Practices: Use of System.exit()**
Calls to `System.exit()` in a J2EE context. Trivial call-name match. Java-specific.

**CWE-454 — External Initialization of Trusted Variables**
External input flows into variables used in security decisions. Taint from untrusted source to trusted-variable assignment. Standard data flow.

**CWE-472 — External Control of Assumed-Immutable Web Parameter**
Hidden fields or cookies assumed immutable are used in security logic. Taint from `req.body.hiddenField` to privilege/price decisions. Data-flow query.

**CWE-522 — Insufficiently Protected Credentials**
Credentials transmitted or stored insecurely. Taint credentials to network or storage sinks without hash/encrypt. Broader version of CWE-256.

**CWE-539 — Persistent Cookies Containing Sensitive Information**
Sensitive data in cookies with `maxAge`/`expires`. Pattern match on `res.cookie()` calls with specific argument combinations.

**CWE-598 — GET Request with Sensitive Query Strings**
Sensitive data in URL query strings. Detect routes accepting GET for endpoints processing passwords/tokens. Pattern match on HTTP method + parameter names.

**CWE-628 — Function Call with Incorrectly Specified Arguments**
Wrong number, order, or type of arguments. CPG can compare call sites against function signatures, but type checkers (TypeScript) and linters handle this better.

**CWE-642 — External Control of Critical State Data**
External input flows into state variables used for authorization/pricing. Similar to CWE-472 but broader. Taint analysis.

**CWE-646 — Reliance on File Name or Extension**
File type determined by name/extension instead of content inspection. Pattern match for `path.extname()` checks without magic-byte inspection. Borderline structural (absence of content check) but the pattern is simple enough for Semgrep.

**CWE-676 — Use of Potentially Dangerous Function**
Calls to known-risky functions (`strcpy`, `gets`, `eval`, `exec`). Textbook SAST pattern: match call names against a blocklist.

**CWE-807 — Reliance on Untrusted Inputs in Security Decision**
Security decisions based on attacker-controllable inputs. Taint from untrusted input to conditional branches gating sensitive operations. Standard taint-to-decision query.

**CWE-1022 — Web Link with window.opener Access**
`target="_blank"` links without `rel="noopener noreferrer"`. Pure pattern match on HTML/JSX attributes.

### Runtime-only (5) — Outside static analysis scope

**CWE-316 — Cleartext Storage of Sensitive Information in Memory**
Whether memory is swapped to disk, core dumps expose secrets — these are OS/runtime concerns. Code may show `password = input` but the vulnerability manifests at runtime. Partial detection possible (e.g., no `SecureString` in .NET), but the core issue is runtime memory management.

**CWE-362 — Race Condition (TOCTOU)**
Concurrent access to shared resources without synchronization. Timing-dependent — CPG can identify shared mutable state and missing locks, but actual exploitability depends on scheduling and concurrency. Very high false positive rate for static detection.

**CWE-436 — Interpretation Conflict**
Two systems interpret the same input differently. Requires knowledge of how multiple systems parse input — a single codebase's CPG has no view of the other system's behavior.

**CWE-444 — HTTP Request/Response Smuggling**
Proxy and backend disagree on HTTP parsing. Depends on specific HTTP implementations at runtime. Not detectable from application source.

**CWE-451 — UI Misrepresentation of Critical Information**
UI obscures or spoofs critical information. Requires visual/interaction context. CPG has no model of rendered output.

### Config/deployment (3) — Not in source code

**CWE-419 — Unprotected Primary Channel**
Admin/restricted channel lacks TLS or adequate protection. Depends on network architecture and TLS configuration, not application code.

**CWE-525 — Web Browser Cache Containing Sensitive Information**
Pages with sensitive data lack `Cache-Control: no-store`. HTTP header configuration — partially detectable if headers are set in code (e.g., Express `helmet` middleware), but typically a deployment concern.

**CWE-1021 — Improper Restriction of Rendered UI Layers (Clickjacking)**
Content can be framed by other domains. About `X-Frame-Options` or `Content-Security-Policy: frame-ancestors` headers. If set in code, partially detectable as a pattern. Often a CDN/server config.

### Ambiguous (6) — Too abstract or context-dependent

**CWE-183 — Permissive List of Allowed Inputs**
Allowlist is too broad. If the list is a code-visible array/regex, the pattern is detectable. But whether a list is "too permissive" is a domain-specific semantic judgment — not something a query can determine.

**CWE-266 — Incorrect Privilege Assignment**
Product assigns wrong privilege level. If role constants are set in code (`user.role = "admin"`), detectable. If from DB/config, not visible in source. The "incorrectness" requires domain knowledge.

**CWE-286 — Incorrect User Management**
Users assigned to wrong permission groups. Largely a runtime/administrative concern. Could detect code that hardcodes group assignments, but the "incorrectness" is semantic.

**CWE-656 — Reliance on Security Through Obscurity**
Security depends on keeping the mechanism secret. Some patterns detectable (custom XOR "encryption", hardcoded obfuscation keys). But the general concept is a design philosophy, not a code pattern.

**CWE-657 — Violation of Secure Design Principles**
Generic violation. Pillar/class-level CWE — too abstract for any single detection method. Specific children are detectable; the parent is a categorization label.

**CWE-693 — Protection Mechanism Failure**
Product doesn't use or incorrectly uses protection mechanisms. Another pillar-level CWE. Whether a mechanism is "sufficient" is a judgment call. Detect the concrete children, not this abstraction.

---

## Summary

| Category | Count | % of A06 |
|----------|-------|----------|
| CPG-structural | 9 | 23% |
| CPG-pattern | 16 | 41% |
| Runtime-only | 5 | 13% |
| Config/deployment | 3 | 8% |
| Ambiguous | 6 | 15% |

### The 9 CPG-structural CWEs — our scope

| CWE | Name | Query type |
|-----|------|-----------|
| 269 | Improper Privilege Management | Absence of auth gates in call paths to sensitive operations |
| 311 | Missing Encryption of Sensitive Data | Sensitive flows to sinks without encryption node in path |
| 434 | Unrestricted File Upload | Upload handler without content-type validation in call chain |
| 501 | Trust Boundary Violation | Untrusted input flows into trusted data structures |
| 602 | Client-Side Enforcement of Server-Side Security | Server endpoints with no server-side validation layer |
| 653 | Improper Isolation/Compartmentalization | High-privilege reachable from low-privilege without gates |
| 799 | Improper Control of Interaction Frequency | Endpoints without rate-limiting middleware |
| 841 | Improper Enforcement of Behavioral Workflow | Workflow steps skippable (state not enforced) |
| 1125 | Excessive Attack Surface | Entry point count, fan-in to sensitive internals |

**9 CWEs justify the CPG.** These are the targets for the two-pass approach. They require graph reachability, negative sub-traversals, cross-file set operations, or whole-graph aggregation — queries that cannot be expressed as single-file patterns.

**16 CWEs are detectable but don't need a CPG.** Semgrep/OpenGrep handles these. Joern can run them as bonus coverage, but it's not where it adds unique value.

**14 CWEs are out of scope** for any code-level static analysis (runtime, config, or too abstract to target directly).
