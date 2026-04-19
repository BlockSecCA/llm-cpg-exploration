# Narration script — "Can an LLM find design flaws in code it can't read?"

**Voice:** First-person, author's POV. Warm but measured. Like you're explaining an experiment to a thoughtful colleague over coffee.

**Target length:** ~60 seconds total (~150 words at a calm pace).

**Delivery tips:**
- Pause at the em-dashes. Let the visuals breathe.
- The numbers (443,000 / 9 / 30 / 974 / 5) are load-bearing — hit them cleanly.
- Don't push the ending. The last line is the thesis; it lands better quiet than emphatic.

---

## Timed script

Each block is a scene. Times are approximate; the visuals will follow your cadence if you record naturally.

### Scene 1 — Hook (0:00–0:06)
> I wanted to know — can a language model find *design* flaws in code it can't read?

### Scene 2 — Keyhole (0:06–0:13)
> Because this is what it actually sees. One file. One function. A keyhole.

### Scene 3 — Three approaches (0:13–0:22)
> So I looked at three tools. LLMs. Static analysis. And code property graphs. Bug-finding is a solved problem — but design analysis isn't.

### Scene 4 — CPG graphs (0:22–0:31)
> A code property graph merges three views of a codebase — syntax, control flow, and data flow — into one structure. For the project I tested, that was four hundred and forty-three thousand nodes.

### Scene 5 — Nine questions (0:31–0:40)
> I gave the LLM nine structural questions to ask of the graph. Not "read this file" — "query the architecture." Pass one. Zero lines of code read.

### Scene 6 — Findings (0:40–0:48)
> Pass two let it read only the cells the structure had flagged. It confirmed thirty findings — real ones.

### Scene 7 — Ratio (0:48–0:54)
> Out of nine hundred and seventy-four potential hotspots. It read five.

### Scene 8 — Close (0:54–1:02)
> The LLM didn't need to read the whole codebase. It needed the *shape* of it. The graph was the map — the model just had to know where to look.

---

## Production notes

**If using ElevenLabs or similar:**
- Voice style: "narrative / documentary" or "conversational" — avoid anything too polished or hype-y.
- Stability: mid (not too flat, not too emotive).
- Recommended voices to try: Adam (calm male), Rachel (warm female), or clone your own voice.

**If recording yourself:**
- A quiet room, phone or laptop mic is fine — the ambient bed will cover minor noise.
- Record in one take if you can; naturalness > polish.
- Export as **mp3, 128–192 kbps, mono**.

**File placement:**
Save the finished file as **`narration.mp3`** in the same folder as `index.html` (or the repo root alongside `animation.html`). The video auto-detects it — if the file is missing, the ambient score and UI cues still play.

**Timing sync:**
The video is locked to 62 seconds. If your narration is longer, speed it up slightly or trim silences. If it's shorter, the ambient bed will carry the remainder.
