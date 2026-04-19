# Narration — ElevenLabs paste-ready

Plain-text version of [`NARRATION_SCRIPT.md`](NARRATION_SCRIPT.md), optimized for pasting straight into the ElevenLabs web UI. Scene labels and production notes stripped; em-dashes kept as natural pause cues.

Save the generated MP3 as `narration.mp3` next to `index.html` (or at the repo root alongside `animation-v2.html`). The audio engine auto-loads it.

## Paste this

```
I wanted to know — can a language model find design flaws in code it can't read?

Because this is what it actually sees. One file. One function. A keyhole.

So I looked at three tools. LLMs. Static analysis. And code property graphs. Bug-finding is a solved problem — but design analysis isn't.

A code property graph merges three views of a codebase — syntax, control flow, and data flow — into one structure. For the project I tested, that was four hundred and forty-three thousand nodes.

I gave the LLM nine structural questions to ask of the graph. Not "read this file" — "query the architecture." Pass one. Zero lines of code read.

Pass two let it read only the cells the structure had flagged. It confirmed thirty findings — real ones.

Out of nine hundred and seventy-four potential hotspots. It read five.

The LLM didn't need to read the whole codebase. It needed the shape of it. The graph was the map — the model just had to know where to look.
```

## Settings

- **Voice:** Adam (calm male) or Rachel (warm female) are safe defaults. The script is first-person author POV, so pick whichever matches your own read.
- **Stability:** mid. Too flat on low, too emotive on high.
- **Similarity / Style:** defaults are fine.
- **Export:** MP3, 128–192 kbps, mono.

## Timing

The video is locked to 62 seconds. If your render comes back longer, re-generate with a slightly faster voice or trim silences. Shorter is fine: the ambient pad in `audio.jsx` carries the remainder.

## Optional: explicit pause tags

The web UI generally strips SSML, but if you're calling the API with a model that supports `<break>` tags (Eleven v2 / v3), you can replace em-dashes with `<break time="0.4s"/>` and paragraph gaps with `<break time="0.8s"/>` for tighter pause control.
