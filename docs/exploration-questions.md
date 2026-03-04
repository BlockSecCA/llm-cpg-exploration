# Question Plan

Practical questions to evaluate both tools against `~/public/vulnerable-app`.
Plain English first, then how each tool answers (or can't).

## Preamble

### Query selection bias

Joern's CPGQL is open-ended — you can query anything the CPG represents. The v1/v2 queries were ad-hoc: we wrote taint source/sink pairs and pattern searches based on what we expected to find. When they found it, that confirms the tool *can* answer the question — but it doesn't tell you which questions to ask in the first place.

The evaluation target (vulnerable-app) is sound. It's a codebase with known vulnerabilities — ground truth. If the tool misses something we know is there, that's a real signal about tool limitations. The issue isn't the target, it's the query selection: how do you decide what to look for without prior knowledge of the codebase?

There is no curated Joern query pack for JavaScript/TypeScript. The [official query database](https://queries.joern.io/) has 32 queries, almost entirely C/Java, and the [repo was archived in 2021](https://github.com/joernio/query-database). For Express/Node.js, you're on your own. This means:

- The `find_vulnerabilities` categories in joern-mcp are structural pattern matches we invented (find `eval`, find string-concatenated SQL). Reasonable but not principled.
- The taint source/sink pairs were crafted per-vulnerability. There's no systematic "run these N queries for OWASP Top 10 coverage on a Node.js app."
- Whether Joern "finds things" depends on whether you ask the right questions.

GitNexus has the same problem, at smaller scale. Its operations are fixed (clusters, context, impact, Cypher), but Cypher is flexible within structural questions. The v1/v2 evaluation used Cypher queries we knew would work (`filePath STARTS WITH 'routes/'`) because we understood the project layout. On an unfamiliar codebase, which Cypher queries reveal meaningful structure? Which impact analyses matter? GitNexus doesn't tell you — you bring the questions. The space of possible structural questions is smaller than Joern's, but the "answer is only as good as the question" problem applies to both tools.

### Bugs vs. structure

Most of the v1/v2 questions targeted code-level mistakes: `eval()` with user input, string-concatenated SQL, unsanitized path joins. These are implementation bugs — a developer intended a parameterized query but wrote a template literal. SAST tools (Semgrep, ESLint security rules) find these through pattern matching on source text. We used a 443K-node code property graph to do what a regex could do.

What Joern and GitNexus actually model is *structure* — how data flows through the program (Joern) and how symbols depend on each other (GitNexus). The structural questions are different from bug-finding:

- "Is there any path from HTTP input to a database call that doesn't pass through a validation function?" — architecture, not a specific bug
- "Which modules can be reached from unauthenticated entry points?" — attack surface by design
- "If this shared utility is compromised, what's the blast radius?" — structural risk

We barely asked those questions. Q11 (blast radius) was the closest, and it revealed the structural-risk-vs-security-risk mismatch. A principled evaluation should separate these two layers: (1) can the tool find known bug patterns (SAST-equivalent), and (2) can the tool reveal structural properties that create or amplify risk — things no pattern matcher would catch.

### What's needed

A query framework derived from an established vulnerability taxonomy (OWASP Top 10, CWE Top 25), not ad-hoc pattern matching. Each taxonomy entry maps to:

1. A `find_vulnerabilities` pattern category (reconnaissance)
2. Source/sink pairs for `taint_analysis` (confirmation)
3. CPGQL patterns for `query` (variant discovery)

This makes the process reproducible: run the same query set against any Node.js/Express app, and absence of results means something — the tool looked and didn't find, not that nobody asked.

The framework also needs a structural layer — design-level questions that go beyond bug patterns. These are the queries that justify using a CPG or code graph over a simpler SAST tool.

### Status

v1 and v2 used ad-hoc queries for both tools, mostly targeting code-level bugs (A05 Injection). v3 addressed the structural layer with 5 OWASP A06 queries mapped to CWEs (306, 862, 269, 209, 602/20). These queries require graph traversal (negative sub-traversals, cross-file set operations, global aggregation, absence-of-evidence) that pattern matchers cannot express. Results in `results-v3.md`.

The bug-finding layer (A05) is validated as Semgrep/OpenGrep territory. The design layer (A06) is validated as CPG territory. The framework question is answered: use OWASP categories to select the tool, not the other way around.

## Critical gates

Each tool has a question that proves (or disproves) its unique value. If the gate fails, the downstream questions collapse or need alternative inputs.

| Gate | Tool | Question | If it fails | Fallback |
|------|------|----------|-------------|----------|
| **Q5** | Joern | Does `find_vulnerabilities` return real, actionable findings? | Q9-16 lose their primary input (no vuln names, no sinks to trace) | Pick suspicious functions manually from Q6-Q8 route analysis |
| **Q1+Q2** | GitNexus | Are clusters meaningful groupings? Are processes real execution flows? | GitNexus's unique features are unproven — it reduces to a call graph, which Joern also has | Q11-12 still work mechanically but the architectural value story is hollow |

If both gates fail, the evaluation answer is clear: neither tool delivers on its promise for this codebase.

## Phase 1: Orientation — "What's here?"

| # | Plain English | Needs | GitNexus | Joern |
|---|---------------|-------|----------|-------|
| 1 | What are the major areas of this codebase? | — | Read `clusters` resource | — no architectural view |
| 2 | What are the main execution flows (login, checkout, search)? | — | Read `processes` resource | — no execution flow concept |

**What we're learning:** Does GitNexus give a useful high-level map of unfamiliar code? These are pure orientation — no Joern equivalent exists.

## Phase 2: Discovery — "Where are the risks?"

| # | Plain English | Needs | GitNexus | Joern |
|---|---------------|-------|----------|-------|
| 5 | Scan for known vulnerability patterns | — | — no vuln detection | `find_vulnerabilities` |
| 6 | What are all the HTTP entry points (routes)? | Q1, Q2 | `query` or Cypher on route files | `get_methods` filtered, or CPGQL for Express patterns |
| 7 | What does each route handler call downstream? | Q6 | `context({name: "<handler>"})` | `get_callees("<handler>")` |
| 8 | Which functions handle user input directly? | Q6 | `query` — find in route clusters | CPGQL for parameter types (`req`, `request`) |

**What we're learning:** Joern finds actual bugs (Q5). GitNexus maps the attack surface (Q6-8). Both can answer Q6-8 but at different granularity — does that matter?

## Phase 3: Tracing — "How bad is it?"

For each vulnerability Joern finds in Phase 2:

| # | Plain English | Needs | GitNexus | Joern |
|---|---------------|-------|----------|-------|
| 9 | Can user input actually reach this dangerous function? Show me the path. | Q5 sinks, Q6 sources | — no data flow tracing | `taint_analysis(source, sink)` |
| 10 | Show me every possible path from HTTP handler to database query | Q5 sinks, Q6 sources | — no data flow tracing | `get_data_flows(source, sink)` |
| 11 | What else depends on the vulnerable function? What breaks if we fix it? | Q5 function names | `impact({target, direction: "upstream"})` — depth 1/2/3 | `get_callers` — direct only, no depth |
| 12 | Which execution flows pass through the vulnerable function? | Q5 function names | `context({name})` → processes list | — no execution flow concept |

**What we're learning:** Data flow (Q9-10) is Joern-only. Blast radius (Q11-12) is GitNexus's strength. These are genuinely complementary.

## Phase 4: Combined — "Assess overall risk"

| # | Plain English | Needs | GitNexus | Joern |
|---|---------------|-------|----------|-------|
| 13 | Joern found a SQL injection in function X. Which routes expose it? | Q5 vulns, Q6 routes | `impact` upstream from X → find route handlers | `get_callers` — direct, then manually recurse |
| 14 | This route handler has no input validation. What damage can data do? | Q6 handlers, Q5 sinks | — can show what handler calls, not what data does | `taint_analysis` from handler params to all sinks |
| 15 | If we add sanitization to function Y, what else calls Y that might break? | Q5 function names | `impact({target: "Y", direction: "upstream"})` | `get_callers("Y")` — direct only |
| 16 | Are there other functions with the same pattern as the vulnerability? | Q5 vuln pattern | — no pattern matching on internals | CPGQL query for similar code patterns |

**What we're learning:** Can we chain the tools? Joern finds → GitNexus maps scope → Joern confirms exploitability → GitNexus guides the fix. Or is the handoff awkward?

## Capability summary

| Capability | GitNexus | Joern |
|------------|----------|-------|
| Codebase architecture (clusters, areas) | Yes | — |
| Execution flow tracing (end-to-end processes) | Yes | — |
| Call graph (who calls whom) | Yes (definition-level) | Yes (statement-level) |
| Impact/blast radius (depth + confidence) | Yes | — (callers only, no depth) |
| Vulnerability detection | — | Yes |
| Data flow / taint analysis | — | Yes |
| Pattern matching on code internals | — | Yes (CPGQL) |
| Rename refactoring | Yes | — |
| Semantic search (embeddings) | Yes | — |

## What "useful" looks like

After running through these, we should be able to answer:

- **GitNexus**: Is the structural view actually helpful, or is it just a fancy grep? Does impact analysis tell you things you wouldn't figure out from reading code?
- **Joern**: Does the vulnerability scanner find real things? Is taint analysis practical or does it require too much CPGQL knowledge? How noisy are the results?
- **Together**: Is the combination greater than the sum, or are they solving problems that don't actually connect?
- **Neither**: What questions did we want to ask that neither tool could answer?
