# Comparative Analysis: Graph-Based Code Analysis Tools

**GitNexus** | **Joern** | **GitLab Knowledge Graph**

---

## Two Distinct Categories

**Structural code graphs for AI agents:** GitNexus, GitLab Knowledge Graph
**Formal program analysis:** Joern

This is the most important distinction — it shapes everything else.

---

## Graph Model

| | GitNexus | GitLab Knowledge Graph | Joern |
|---|---|---|---|
| **Type** | Code knowledge graph | Structural code graph | Code Property Graph (CPG) |
| **Granularity** | Definition-level (functions, classes, methods) | Definition-level (functions, classes, methods) | **Statement-level** (expressions, variables, assignments, control structures) |
| **Contains AST?** | No (used for extraction, discarded) | No (same — tree-sitter parses, entities extracted) | **Yes — full AST is a core layer** |
| **Contains CFG?** | No | No | **Yes — control flow graph is a core layer** |
| **Contains PDG?** | No | No | **Yes — program dependence graph (data + control deps)** |
| **Node types** | ~27 (File, Function, Class, Community, Process...) | 4 tables (Directory, File, Definition, ImportedSymbol) | ~30+ (METHOD, CALL, BLOCK, LITERAL, IDENTIFIER, CONTROL_STRUCTURE, LOCAL...) |
| **Edge types** | 8 (CALLS, IMPORTS, EXTENDS, CONTAINS...) | 52 relationship types (very granular nesting: CLASS_TO_METHOD, LAMBDA_TO_METHOD...) | ~15+ (AST, CFG, CDG, REACHING_DEF, CALL, DOMINATE...) |
| **Unique features** | Community detection (Leiden clustering), Process tracing (execution flow chains) | AMBIGUOUSLY_CALLS edge type (explicit uncertainty), very rich containment model | Dominator trees, reaching definitions, layered schema (17 layers) |

**Key insight:** Joern models what happens *inside* functions (every statement, every branch, every variable assignment). GitNexus and GitLab KG model the *boundaries between* functions (who calls whom, who imports what). This is the difference between "can detect a buffer overflow" and "can tell you what breaks if you rename a method."

---

## Formal Methods

| Method | GitNexus | GitLab KG | Joern |
|---|---|---|---|
| Dataflow analysis | - | - | **Yes** (interprocedural, configurable depth) |
| Taint analysis | - | - | **Yes** (source-to-sink tracing) |
| Control flow analysis | - | - | **Yes** (CFG + dominator/post-dominator trees) |
| Program dependence | - | - | **Yes** (data + control dependence) |
| Program slicing | - | - | **Yes** (backward data-flow slicing + usage slicing) |
| Type inference | - | - | Partial (type recovery passes) |
| Abstract interpretation | - | - | - |
| Symbolic execution | - | - | - |

GitNexus and GitLab KG use zero formal methods. Both are purely syntactic/structural — they extract what tree-sitter sees and reason about names and imports, not values or execution paths.

Joern has a dedicated `dataflowengineoss` engine that does real interprocedural analysis. You can write `sink.reachableByFlows(source)` and get the exact propagation path through function calls. This is the foundation for vulnerability detection.

---

## Language Coverage

| | GitNexus | GitLab KG | Joern |
|---|---|---|---|
| **Languages** | 9 | 7 | 13+ |
| **Parser** | tree-sitter (native + WASM) | tree-sitter + ast-grep (via gitlab-code-parser) | Dedicated frontends per language |
| **Binary analysis** | - | - | **Yes** (Ghidra frontend for x86/x64) |
| **Bytecode analysis** | - | - | **Yes** (JVM bytecode via Soot/Jimple) |
| **Robust/fuzzy parsing** | - | - | **Yes** (works with incomplete codebases) |

Joern's parser architecture is fundamentally different: each language gets a *dedicated frontend* (Eclipse CDT for C/C++, JavaParser for Java, Roslyn for C#, GraalVM for JS) that produces a uniform CPG. This is heavier but gets deeper semantic information than tree-sitter can provide.

GitNexus and GitLab KG both bet on tree-sitter — fast, lightweight, but limited to syntax. The trade-off is speed and breadth vs. depth.

---

## Graph Storage

| | GitNexus | GitLab KG | Joern |
|---|---|---|---|
| **Database** | KuzuDB (embedded) | LadybugDB (KuzuDB fork, after Apple acquired Kuzu) | flatgraph (custom columnar, in-memory) |
| **Query language** | Cypher | Cypher | CPGQL (Scala DSL on Gremlin) |
| **WASM support** | Yes (browser runtime) | No | No |
| **Export formats** | - | Parquet (intermediate) | Neo4j CSV, GraphML, GraphSON, DOT |
| **Vector search** | Yes (HNSW, 384-dim embeddings) | No | No |

GitLab KG uses LadybugDB which is a **fork of KuzuDB** — the same database GitNexus uses directly. Both chose embedded columnar graph DBs with Cypher, arriving at nearly the same storage architecture independently.

Joern went a completely different route with a custom JVM-native graph engine (flatgraph), optimized for the enormous graphs CPGs produce (48M nodes for the Linux kernel).

---

## Features & Purpose

| | GitNexus | GitLab KG | Joern |
|---|---|---|---|
| **Primary purpose** | AI coding agent context | AI agent context (GitLab Duo) | Vulnerability discovery / security research |
| **MCP server** | Yes (7 tools) | Yes (7 tools) | No |
| **Vulnerability detection** | No | No | **Yes** (joern-scan with QueryDB) |
| **Impact/blast radius** | Yes (depth-grouped) | Yes | Via graph queries |
| **Community detection** | Yes (Leiden algorithm) | No | No |
| **Execution flow tracing** | Yes (Process nodes) | No | Via dataflow engine |
| **Rename refactoring** | Yes (graph + regex) | No | No |
| **Hybrid search** | Yes (BM25 + semantic + RRF) | No | No |
| **Web UI** | Yes (Sigma.js graph viz) | Yes (bundled with `gkg server`) | Minimal (REPL-based, DOT export) |
| **CI/CD integration** | No | Planned (GitLab native) | Yes (joern-scan for pipelines) |
| **Incremental indexing** | No (planned) | Yes (file watching) | No |

---

## Maturity

| | GitNexus | GitLab KG | Joern |
|---|---|---|---|
| **Age** | ~7 months | ~10 months | **~7 years** (this repo since 2019, project older) |
| **Stars** | 3,346 | N/A (GitLab) | ~2,957 |
| **Contributors** | 2 | 20 | 74+ |
| **Release cadence** | Manual | Rapid (27 releases in 10 months) | **Daily automated releases** |
| **Current version** | 1.2.9 | 0.24.0 (beta) | 4.0.489 |
| **Backing** | Solo developer | **GitLab (corporate)** | **Qwiet AI + academia** |
| **License** | PolyForm Noncommercial | MIT | Apache 2.0 |
| **Academic papers** | No | No | **IEEE S&P 2014** (foundational CPG paper) |

---

## Summary

**Joern** is the only tool doing real program analysis. If you need to find vulnerabilities, trace data flows, or reason about what values a variable can hold — it's the only option here. It's academically grounded (IEEE S&P paper), battle-tested (7 years, daily releases, commercial backing from Qwiet AI), and covers the most languages including binaries. The trade-off is complexity: it's a JVM-based Scala project, queries require learning CPGQL, and CPGs are massive.

**GitNexus** and **GitLab KG** are solving a different problem: giving AI coding agents structural awareness of codebases. They're strikingly similar — both use tree-sitter, both store in KuzuDB (or its fork), both expose MCP tools, both operate at definition-level granularity. GitNexus differentiates with community detection (Leiden), execution flow tracing, semantic search (embeddings), and a rename tool. GitLab KG differentiates with corporate backing, incremental indexing, a richer edge taxonomy (52 types vs 8), and a roadmap to integrate with GitLab's full product surface (MRs, issues, security findings).

The fundamental axis is **depth vs. breadth**: Joern goes deep inside function bodies to track data flow; GitNexus and GitLab KG stay at the structural level but are designed to be consumed by LLMs in real-time coding workflows.

---

## Sources

### GitNexus
- [GitHub Repository](https://github.com/abhigyanpatwari/GitNexus)

### Joern
- [GitHub Repository](https://github.com/joernio/joern)
- [Documentation](https://docs.joern.io/)
- [CPG Specification](https://cpg.joern.io/)
- [Yamaguchi et al. 2014 — "Modeling and Discovering Vulnerabilities with Code Property Graphs" (IEEE S&P)](https://www.semanticscholar.org/paper/Modeling-and-Discovering-Vulnerabilities-with-Code-Yamaguchi-Golde/07c4549be429a52274bc0ec083bf5598a3e5c365)
- [Yamaguchi 2019 — "Elegant and Scalable Code Querying with Code Property Graphs"](https://fabianyamaguchi.com/files/2019-cdl.pdf)
- [ShiftLeftSecurity/codepropertygraph](https://github.com/ShiftLeftSecurity/codepropertygraph)
- [joernio/flatgraph](https://github.com/joernio/flatgraph)

### GitLab Knowledge Graph
- [GitLab Repository](https://gitlab.com/gitlab-org/rust/knowledge-graph)
- [Documentation](https://gitlab-org.gitlab.io/rust/knowledge-graph/)
- [MCP Tools Reference](https://gitlab-org.gitlab.io/rust/knowledge-graph/mcp/tools/)
- [GitLab Docs — Knowledge Graph](https://docs.gitlab.com/user/project/repository/knowledge_graph/)
- [GitLab Code Parser](https://gitlab.com/gitlab-org/rust/gitlab-code-parser)
- [LadybugDB](https://ladybugdb.com/)
- [GitLab 18.4 Release Blog](https://about.gitlab.com/blog/gitlab-18-4-ai-native-development-with-automation-and-insight/)
