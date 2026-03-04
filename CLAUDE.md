# LLM + CPG Exploration

> PUBLIC REPO — No secrets, no PII, no internal references. Assume strangers read everything.

## Purpose

Exploration of whether Code Property Graphs can let an LLM find design flaws in code it never reads. Two-pass method using Joern CPG queries against a vulnerable app, targeting OWASP A06 (Insecure Design). 30 confirmed findings, zero false positives.

## Type

Static Web (GitHub Pages presentation + markdown docs). No build step.

## Key Files

- `index.html` — reveal.js presentation, served via GitHub Pages at blocksecca.github.io/llm-cpg-exploration
- `docs/tool-comparison.md` — GitNexus vs Joern vs GitLab KG evaluation
- `docs/exploration-questions.md` — 16 questions across 4 phases for tool evaluation
- `docs/initial-results.md` — first CPG findings proving the approach
- `docs/design-queries.md` — pivot to OWASP A06, five structural queries
- `docs/cwe-mapping.md` — which A06 CWEs are structurally detectable (9 of 39)
- `docs/analysis-questions.md` — the 20 queries (9 structural + 11 design)
- `docs/two-pass-results.md` — full analysis, every query and finding
- `docs/validation.md` — cross-reference against 107 known challenges, 30 matches

## Reading Order

Docs are chronological: tool-comparison → exploration-questions → initial-results → design-queries → cwe-mapping → analysis-questions → two-pass-results → validation.

## Related Repos

| Repo | Role |
|------|------|
| `~/public/joern-mcp` | MCP server wrapping Joern for LLM tool use |
| `~/public/GitNexus` | Fork with local API fixes, complementary graph analysis |
| `~/public/vulnerable-app` | Debranded target app (Express/TypeScript, 107 challenges) |

## Deployment

GitHub Pages from `main` branch. Push to `main` publishes automatically.

## Practices

- After corrections: "Update CLAUDE.md so you don't make that mistake again"
- Keep `docs/notes/` for learnings that shouldn't bloat this file
- Plan first for complex tasks; re-plan when things go sideways
