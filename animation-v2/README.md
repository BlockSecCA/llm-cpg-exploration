# CPG Video

Animated video version of **[cpg.blocksec.ca](https://cpg.blocksec.ca/)** — "Can an LLM find design flaws in code it can't read?"

~62 seconds, 1920×1080, silent. Narrates the project's core argument: LLMs read code through a keyhole; SAST has coverage but no semantics; the Code Property Graph is the missing structural bridge.

## Viewing

Two ways:

1. **Single-file (recommended for sharing):** Open [`animation.html`](../animation.html) — a fully self-contained HTML file. Double-click, done. Works offline.
2. **Source (for editing):** Open `index.html` in this folder. Loads the individual scene files (`scenes.jsx`, `scenes2.jsx`, `animations.jsx`).

Use arrow keys / spacebar to scrub or pause. Progress persists across refreshes via `localStorage`.

## Contents

```
animation/
├── index.html            # entry point (source version)
├── animations.jsx        # timeline engine: Stage, Sprite, Easing, interpolate
├── audio.jsx             # audio engine: ambient pad, UI cues, unmute overlay
├── scenes.jsx            # scenes 1–3: hook, keyhole, three approaches
├── scenes2.jsx           # scenes 4–8: CPG graphs, 9 questions, findings, ratio, thesis
├── NARRATION_SCRIPT.md   # first-person VO script, scene-by-scene
└── narration.mp3         # (optional) your recorded narration — auto-detected
```

## Audio

The video plays silent by default. A centered "🔊 Play with sound / Watch silent" overlay asks on load; the user picks.

- **Ambient score + UI cues** are synthesized in-browser via Web Audio — no file needed.
- **Narration** is optional. If `narration.mp3` sits next to `index.html`, it plays synced to the timeline. If the file is missing, everything else still works. See `NARRATION_SCRIPT.md` for the script.

## Scenes

1. **Hook** — opening question
2. **Keyhole** — what the LLM actually sees (one file, one function)
3. **Three approaches** — LLM / SAST / CPG Venn, BUG FINDING solved, DESIGN ANALYSIS unsolved
4. **CPG graphs** — AST + CFG + PDG merge, 443,000 nodes
5. **9 Questions** — Pass 1, structural discovery, zero lines of code read
6. **Findings** — Pass 2, 30 confirmed findings
7. **Ratio** — 5 of 974 cells light up
8. **Close** — thesis + end card

## Built with

React 18, Babel standalone (runtime JSX), no build step. The "animations.jsx" timeline primitives (Stage, Sprite, useTime) drive all scene timing.
