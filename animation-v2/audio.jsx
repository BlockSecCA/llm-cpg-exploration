// audio.jsx
// Audio engine for the CPG video.
// - Web Audio synthesized ambient pad (editorial, patient, 60s)
// - Synthesized UI cues (soft ticks, whoosh, resolve) triggered at scene beats
// - Optional <audio> element playing narration.mp3 if the file exists
// - Big centered 🔊 UNMUTE button overlay — required first user gesture
//
// All audio is gated: nothing plays until the user clicks unmute. Once clicked,
// the audio timeline is synced to the video timeline (Stage's `time`), so
// seeking, pause, and refresh all keep audio in sync with visuals.
//
// Usage in App:
//   <Stage ...>
//     <AudioLayer/>   {/* reads useTime() — must be inside Stage */}
//     ...scenes...
//   </Stage>

// Scene beats (seconds) — when UI cues fire.
// Must match the scene timing in scenes.jsx / scenes2.jsx.
const AUDIO_CUES = [
  { t: 0.3,  kind: 'tick'   },   // Scene 1 starts
  { t: 6.5,  kind: 'whoosh' },   // Scene 2 keyhole reveal
  { t: 13.0, kind: 'tick'   },   // Scene 3
  { t: 22.0, kind: 'tick'   },   // Scene 4 graphs
  { t: 31.0, kind: 'tick'   },   // Scene 5 9 questions
  { t: 40.0, kind: 'tick'   },   // Scene 6 findings
  { t: 48.0, kind: 'tick'   },   // Scene 7 ratio
  { t: 54.5, kind: 'resolve' },  // Scene 8 thesis
];

// ── Synth engine ────────────────────────────────────────────────────────────

function createAudioEngine() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  const ctx = new AC();

  // Master bus
  const master = ctx.createGain();
  master.gain.value = 0.0; // start silent; faded up on unmute
  master.connect(ctx.destination);

  // ── Ambient pad bus ────
  // Two detuned sine oscillators + a slow lowpass sweep + very quiet pink-ish noise.
  // Mood: editorial / cinematic / patient.
  const padBus = ctx.createGain();
  padBus.gain.value = 0.0;
  const padFilter = ctx.createBiquadFilter();
  padFilter.type = 'lowpass';
  padFilter.frequency.value = 600;
  padFilter.Q.value = 0.6;
  padBus.connect(padFilter);
  padFilter.connect(master);

  // Root + fifth, very slow, minor-feeling
  // A2 = 110, E3 = 164.8, C3 = 130.8 — Am chord bed
  const voices = [
    { freq: 110,   detune: -4, gain: 0.22 },
    { freq: 164.8, detune: +3, gain: 0.14 },
    { freq: 130.8, detune: +1, gain: 0.10 }, // minor third, subtle
    { freq: 220,   detune: -2, gain: 0.06 }, // octave color
  ];
  voices.forEach(v => {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = v.freq;
    osc.detune.value = v.detune;
    const g = ctx.createGain();
    g.gain.value = v.gain;
    osc.connect(g);
    g.connect(padBus);
    osc.start();
    // Slow LFO on gain for breathing
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.05 + Math.random() * 0.08;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = v.gain * 0.4;
    lfo.connect(lfoGain);
    lfoGain.connect(g.gain);
    lfo.start();
  });

  // Subtle noise floor (tape hiss feel)
  const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const nd = noiseBuffer.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = (Math.random() * 2 - 1) * 0.15;
  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuffer;
  noise.loop = true;
  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = 'bandpass';
  noiseFilter.frequency.value = 1200;
  noiseFilter.Q.value = 0.5;
  const noiseGain = ctx.createGain();
  noiseGain.gain.value = 0.02;
  noise.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(master);
  noise.start();

  // Slow filter sweep for movement (60s cycle)
  const filterLfo = ctx.createOscillator();
  filterLfo.frequency.value = 1 / 40; // 40-second cycle
  const filterLfoGain = ctx.createGain();
  filterLfoGain.gain.value = 300;
  filterLfo.connect(filterLfoGain);
  filterLfoGain.connect(padFilter.frequency);
  filterLfo.start();

  // ── Cue triggers ────
  function fireCue(kind) {
    const now = ctx.currentTime;
    if (kind === 'tick') {
      // Short woody tick: high sine blip with fast decay
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1800, now);
      osc.frequency.exponentialRampToValueAtTime(900, now + 0.08);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(0.08, now + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
      osc.connect(g); g.connect(master);
      osc.start(now); osc.stop(now + 0.15);
    } else if (kind === 'whoosh') {
      // Filtered noise swell — key reveal
      const src = ctx.createBufferSource();
      src.buffer = noiseBuffer;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.value = 2;
      bp.frequency.setValueAtTime(400, now);
      bp.frequency.exponentialRampToValueAtTime(3000, now + 0.6);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(0.18, now + 0.25);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);
      src.connect(bp); bp.connect(g); g.connect(master);
      src.start(now); src.stop(now + 1.0);
    } else if (kind === 'resolve') {
      // Small chord resolve: A + E + A octave, soft
      [220, 329.6, 440].forEach((f, i) => {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = f;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(0.06 - i * 0.01, now + 0.4);
        g.gain.setValueAtTime(0.06 - i * 0.01, now + 1.5);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 3.5);
        osc.connect(g); g.connect(master);
        osc.start(now); osc.stop(now + 3.6);
      });
    }
  }

  function fadeMaster(toValue, seconds) {
    const now = ctx.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(master.gain.value, now);
    master.gain.linearRampToValueAtTime(toValue, now + seconds);
  }

  function fadePad(toValue, seconds) {
    const now = ctx.currentTime;
    padBus.gain.cancelScheduledValues(now);
    padBus.gain.setValueAtTime(padBus.gain.value, now);
    padBus.gain.linearRampToValueAtTime(toValue, now + seconds);
  }

  return {
    ctx,
    fireCue,
    fadeMaster,
    fadePad,
    resume: () => ctx.resume(),
  };
}

// ── React wrapper ──────────────────────────────────────────────────────────

function AudioLayer({ narrationSrc = 'narration.mp3', duration = 62 }) {
  const { time, playing, setPlaying, setTime } = useTimeline();
  const [armed, setArmed] = React.useState(false);          // user clicked unmute
  const [narrationLoaded, setNarrationLoaded] = React.useState(false);
  const [narrationError, setNarrationError] = React.useState(false);
  const engineRef = React.useRef(null);
  const audioElRef = React.useRef(null);
  const lastCueIdxRef = React.useRef(-1);
  const lastTimeRef = React.useRef(0);

  // Pause video until the user chooses. Don't force time=0 — they may be
  // mid-scrub or returning after refresh.
  React.useEffect(() => {
    if (!armed) {
      setPlaying(false);
    }
  }, [armed, setPlaying]);

  // Lazy-init the Web Audio engine on unmute
  const unmute = React.useCallback(async () => {
    if (armed) return;
    const eng = createAudioEngine();
    if (!eng) { setArmed(true); setPlaying(true); return; }
    engineRef.current = eng;
    try { await eng.resume(); } catch {}
    // Fade up master + pad over 1.5s
    eng.fadeMaster(0.9, 1.5);
    eng.fadePad(0.8, 2.0);
    // Try narration
    if (audioElRef.current) {
      try {
        audioElRef.current.currentTime = time;
        audioElRef.current.volume = 0.85;
        await audioElRef.current.play();
      } catch (e) {
        // narration.mp3 missing or blocked — that's fine, continue silently
      }
    }
    setArmed(true);
    setPlaying(true);
  }, [armed, time, setPlaying]);

  const watchSilent = React.useCallback(() => {
    setArmed(true);
    setPlaying(true);
  }, [setPlaying]);

  // Keep narration element synced to video time (seek + play/pause)
  React.useEffect(() => {
    if (!armed) return;
    const el = audioElRef.current;
    if (!el || narrationError) return;
    // Sync on big drift or seek
    const drift = Math.abs(el.currentTime - time);
    if (drift > 0.3) {
      try { el.currentTime = Math.min(time, el.duration || duration); } catch {}
    }
    if (playing && el.paused) { el.play().catch(() => {}); }
    if (!playing && !el.paused) { el.pause(); }
  }, [time, playing, armed, narrationError, duration]);

  // Stop at end
  React.useEffect(() => {
    if (!armed) return;
    if (time >= duration - 0.05) {
      // Fade out the pad at the last half-second
      engineRef.current?.fadePad(0, 0.8);
      engineRef.current?.fadeMaster(0, 1.2);
      if (audioElRef.current && !audioElRef.current.paused) {
        audioElRef.current.pause();
      }
    } else if (time < 1.0 && engineRef.current) {
      // If user scrubbed back to beginning, fade back up
      engineRef.current.fadeMaster(0.9, 0.6);
      engineRef.current.fadePad(0.8, 0.8);
    }
  }, [time, armed, duration]);

  // Fire UI cues when the playhead crosses a cue threshold (forward only)
  React.useEffect(() => {
    if (!armed || !engineRef.current) return;
    const prev = lastTimeRef.current;
    const curr = time;
    lastTimeRef.current = curr;
    // Detect forward crossings only (not scrubbing backwards)
    if (curr < prev) return;
    AUDIO_CUES.forEach((cue) => {
      if (prev < cue.t && curr >= cue.t) {
        engineRef.current.fireCue(cue.kind);
      }
    });
  }, [time, armed]);

  return (
    <>
      {/* Narration element — hidden; only plays if file exists */}
      <audio
        ref={audioElRef}
        src={narrationSrc}
        preload="auto"
        onLoadedData={() => setNarrationLoaded(true)}
        onError={() => setNarrationError(true)}
        style={{ display: 'none' }}
      />

      {/* Unmute overlay */}
      {!armed && (
        <div
          onClick={unmute}
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(20, 18, 16, 0.35)',
            backdropFilter: 'blur(2px)',
            WebkitBackdropFilter: 'blur(2px)',
            cursor: 'pointer',
            zIndex: 9999,
            pointerEvents: 'auto',
          }}
        >
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 28,
            padding: '56px 72px',
            background: '#f6f2ea',
            border: '1px solid rgba(20,18,16,0.12)',
            boxShadow: '0 40px 120px rgba(0,0,0,0.5)',
            maxWidth: 680,
          }}>
            <div style={{
              fontFamily: 'JetBrains Mono, ui-monospace, monospace',
              fontSize: 13,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: '#8b8478',
            }}>
              Sound · 62 seconds · silent ok too
            </div>

            <div style={{
              fontFamily: 'Instrument Serif, Georgia, serif',
              fontStyle: 'italic',
              fontSize: 64,
              lineHeight: 1.05,
              color: '#141210',
              textAlign: 'center',
              letterSpacing: '-0.01em',
              whiteSpace: 'nowrap',
            }}>
              Turn sound on?
            </div>

            <div style={{
              fontFamily: 'Inter, system-ui, sans-serif',
              fontSize: 18,
              lineHeight: 1.55,
              color: '#4a463f',
              textAlign: 'center',
              maxWidth: 480,
            }}>
              This short film has a quiet editorial score and narration.
              You can also watch it silent — nothing is lost.
            </div>

            <div style={{ display: 'flex', gap: 14, marginTop: 8 }}>
              <button
                onClick={(e) => { e.stopPropagation(); unmute(); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '16px 28px',
                  background: '#141210',
                  color: '#f6f2ea',
                  border: 'none',
                  fontFamily: 'Inter, system-ui, sans-serif',
                  fontSize: 17,
                  fontWeight: 600,
                  letterSpacing: '-0.01em',
                  cursor: 'pointer',
                }}
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M3 7v6h3l4 3V4L6 7H3z" fill="currentColor"/>
                  <path d="M13 7c1 1 1 5 0 6M15.5 5c2 2 2 8 0 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
                </svg>
                Play with sound
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  watchSilent();
                }}
                style={{
                  padding: '16px 28px',
                  background: 'transparent',
                  color: '#141210',
                  border: '1px solid rgba(20,18,16,0.25)',
                  fontFamily: 'Inter, system-ui, sans-serif',
                  fontSize: 17,
                  fontWeight: 500,
                  letterSpacing: '-0.01em',
                  cursor: 'pointer',
                }}
              >
                Watch silent
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

Object.assign(window, { AudioLayer, AUDIO_CUES });
