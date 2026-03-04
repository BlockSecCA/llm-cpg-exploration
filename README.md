# LLM + CPG Exploration

Can an LLM find design flaws in code it never reads?

This project explores whether Code Property Graphs can bridge the gap between LLMs and codebase-wide security analysis. LLMs understand code semantics but see one file at a time. SAST tools see the whole codebase but only match patterns. Design flaws live in neither place: they're defined by absence (what's missing) and relationships (what connects to what).

The approach: give the LLM a structural graph it can query instead of source code to read.

**[View the presentation](https://blocksecca.github.io/llm-cpg-exploration/)**

## Results

| | |
|---|---|
| **30** findings confirmed | across **8** OWASP A06 CWE categories |
| **0** false positives | validated against 107 known challenges |
| **20** CPGQL queries | 9 structural + 11 design-targeted |
| **443K** CPG nodes | LLM read **0** of them directly |

## How it works

Two passes against a target application's CPG, built with [Joern](https://joern.io):

1. **Pass 1: Learn the architecture.** Nine generic structural queries extract facts: route inventory, middleware coverage, validation patterns, encryption usage. No knowledge of the app required beyond the framework name.

2. **Pass 2: Interrogate the design.** The LLM reads Pass 1 results (not source code) and writes targeted CPGQL queries for 8 CWE categories: missing auth, weak crypto, unrestricted uploads, trust boundary violations, client-side-only validation, poor isolation, missing rate limiting, broken workflows.

The LLM never reads the codebase. It reasons over small, structured query results.

## Reading order

The documents below follow the project chronologically, from initial tool evaluation through final validation.

### Part 1: Exploration

Evaluated three graph-based tools against a deliberately vulnerable application to find what works for security analysis at the design level.

1. **[Tool comparison](docs/tool-comparison.md)**:GitNexus vs Joern vs GitLab Knowledge Graph. Why Joern won for design analysis.
2. **[Exploration questions](docs/exploration-questions.md)**:16 questions across 4 phases to evaluate what each tool can answer.
3. **[Initial results](docs/initial-results.md)**:First real findings. Proved CPG queries can surface architectural facts that pattern matchers miss.
4. **[Design queries](docs/design-queries.md)**:Pivoted to OWASP A06 (Insecure Design). Five structural queries that justified the CPG approach.

### Part 2: Two-pass analysis

Formalized the method and ran it end-to-end against the target application.

5. **[CWE mapping](docs/cwe-mapping.md)**:Which of the 39 A06 CWEs are structurally detectable via CPG? Nine are. Those became the targets.
6. **[Analysis questions](docs/analysis-questions.md)**:The 20 queries (9 structural + 11 design) and what each one is looking for.
7. **[Two-pass results](docs/two-pass-results.md)**:Full analysis. Every query, every finding, every verdict.
8. **[Validation](docs/validation.md)**:Each finding cross-referenced against the target app's 107 documented challenges. 30 matches, zero false positives.

## Tools

| Tool | Role |
|------|------|
| [Joern](https://joern.io) (v4.0.489) | CPG engine, CPGQL queries, dataflow/taint analysis |
| [GitNexus](https://github.com/BlockSecCA/GitNexus) | Complementary graph analysis (blast radius, module discovery) |
| [joern-mcp](https://github.com/BlockSecCA/joern-mcp) | MCP server wrapping Joern's API for LLM tool use |

## Target

[vulnerable-app](https://github.com/BlockSecCA/vulnerable-app): an intentionally vulnerable Express/TypeScript application with 107 documented security challenges. Express 4.21, Sequelize ORM, custom JWT auth, no input validation libraries.

## Author

Carlos / [BlockSecCA](https://github.com/BlockSecCA)

## License

This work is published for educational and research purposes.
