// scenes.jsx — individual scenes for the CPG video.
// Each scene is a Sprite placed on a Stage timeline in index.html.

const SANS = "Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif";
const MONO = "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace";
const SERIF = "'Instrument Serif', 'Iowan Old Style', Georgia, serif";

// Palette — warm editorial with a CPG-blue accent
const C = {
  bg:        '#f6f2ea',
  bgDeep:    '#efeadf',
  ink:       '#141210',
  ink2:      '#3a3631',
  muted:     '#8b8478',
  rule:      '#d9d2c4',
  accent:    '#2b4fff',   // CPG blue
  accentSft: '#dfe4ff',
  red:       '#c6392e',
  green:     '#2e7d4a',
  amber:     '#b5821a',
};

// ─── Reusable bits ──────────────────────────────────────────────────────────

// Small uppercase chip/label
function Chip({ children, color = C.ink, x, y, align = 'left' }) {
  const translate = align === 'center' ? '-50%' : align === 'right' ? '-100%' : '0';
  return (
    <div style={{
      position: 'absolute', left: x, top: y, transform: `translateX(${translate})`,
      fontFamily: MONO, fontSize: 13, letterSpacing: '0.18em',
      textTransform: 'uppercase', color,
    }}>
      {children}
    </div>
  );
}

// A clipping mask that wipes children in/out by progress (0..1)
function Wipe({ progress, direction = 'right', children, style }) {
  let clip;
  if (direction === 'right') clip = `inset(0 ${100 - progress * 100}% 0 0)`;
  if (direction === 'left')  clip = `inset(0 0 0 ${100 - progress * 100}%)`;
  if (direction === 'up')    clip = `inset(${100 - progress * 100}% 0 0 0)`;
  if (direction === 'down')  clip = `inset(0 0 ${100 - progress * 100}% 0)`;
  return <div style={{ ...style, clipPath: clip, WebkitClipPath: clip }}>{children}</div>;
}

// Typewriter: returns text[0..n] based on progress
function typewriter(text, p) {
  const n = Math.floor(text.length * clamp(p, 0, 1));
  return text.slice(0, n);
}

// ─── SCENE 1 — Cold open / title (0 – 4.5s) ─────────────────────────────────

function Scene1_Hook() {
  return (
    <Sprite start={0} end={4.6}>
      {({ localTime, progress, duration }) => {
        const tIn = clamp(localTime / 0.6, 0, 1);
        const tOut = clamp((localTime - (duration - 0.6)) / 0.6, 0, 1);

        // Typewriter the question
        const q1 = 'Can an LLM find design flaws';
        const q2 = "in code it can't read?";
        const typeStart = 0.25;
        const typeDur = 2.4;
        const tp = clamp((localTime - typeStart) / typeDur, 0, 1);
        const totalLen = q1.length + q2.length;
        const cutoff = Math.floor(totalLen * Easing.easeOutQuad(tp));
        const line1 = q1.slice(0, Math.min(cutoff, q1.length));
        const line2 = cutoff > q1.length ? q2.slice(0, cutoff - q1.length) : '';

        // Cursor blink
        const blink = Math.floor(localTime * 2) % 2 === 0 ? 1 : 0;

        const out = tOut > 0 ? 1 - tOut : 1;

        return (
          <div style={{
            position: 'absolute', inset: 0,
            background: C.bg,
            opacity: Easing.easeOutCubic(tIn) * out,
          }}>
            {/* grid of thin rules */}
            <svg style={{ position: 'absolute', inset: 0, opacity: 0.35 }} width="1920" height="1080">
              {Array.from({ length: 13 }).map((_, i) => (
                <line key={'v'+i} x1={i*160} y1={0} x2={i*160} y2={1080} stroke={C.rule} strokeWidth="1" />
              ))}
              {Array.from({ length: 8 }).map((_, i) => (
                <line key={'h'+i} x1={0} y1={i*160} x2={1920} y2={i*160} stroke={C.rule} strokeWidth="1" />
              ))}
            </svg>

            {/* Top eyebrow */}
            <Chip x={160} y={160} color={C.accent}>OWASP A06 · Insecure Design</Chip>
            <div style={{
              position: 'absolute', left: 160, top: 186, width: 160 * (localTime > 0.2 ? 1 : 0),
              height: 2, background: C.accent, transition: 'width 0.6s cubic-bezier(.2,.8,.2,1)'
            }} />

            {/* Headline */}
            <div style={{
              position: 'absolute', left: 160, top: 330, right: 160,
              fontFamily: SERIF, fontSize: 128, lineHeight: 1.05,
              color: C.ink, letterSpacing: '-0.02em',
              fontWeight: 400, whiteSpace: 'nowrap',
            }}>
              <div style={{ height: 135, overflow: 'hidden' }}>
                {line1}<span style={{ opacity: line1.length < q1.length ? blink : 0, color: C.accent }}>▍</span>
              </div>
              <div style={{ color: C.ink2, fontStyle: 'italic', height: 135, overflow: 'hidden' }}>
                {line2}<span style={{ opacity: line1.length >= q1.length && line2.length < q2.length ? blink : 0, color: C.accent }}>▍</span>
              </div>
            </div>

            {/* Bottom meta */}
            <div style={{
              position: 'absolute', left: 160, bottom: 140,
              display: 'flex', gap: 32, alignItems: 'center',
              fontFamily: MONO, fontSize: 15, color: C.muted,
              opacity: clamp((localTime - 2.2) / 0.6, 0, 1),
            }}>
              <span style={{ color: C.ink }}>Joern CPG</span>
              <span>·</span>
              <span>Express + Sequelize</span>
              <span>·</span>
              <span>LLM-Assisted</span>
            </div>

            <div style={{
              position: 'absolute', right: 160, bottom: 140,
              fontFamily: MONO, fontSize: 15, color: C.muted,
              opacity: clamp((localTime - 2.4) / 0.6, 0, 1),
            }}>
              github.com/BlockSecCA/llm-cpg-exploration
            </div>
          </div>
        );
      }}
    </Sprite>
  );
}

// ─── SCENE 2 — The keyhole problem (4.5 – 11s) ──────────────────────────────

function Scene2_Keyhole() {
  return (
    <Sprite start={4.8} end={11.0}>
      {({ localTime, duration }) => {
        const tIn = clamp(localTime / 0.5, 0, 1);
        const tOut = clamp((localTime - (duration - 0.5)) / 0.5, 0, 1);
        const out = tOut > 0 ? 1 - tOut : 1;
        const appear = Easing.easeOutCubic(tIn) * out;

        // Grid of "files" — more compact, tucked beneath headline
        const cols = 10, rows = 5;
        const cellW = 108, cellH = 88;
        const gridW = cols * cellW, gridH = rows * cellH;
        const gridX = (1920 - gridW) / 2;
        const gridY = 340;

        // Spotlight moves along a path over time
        const t = clamp((localTime - 0.4) / 4.5, 0, 1);
        // Sample a wandering path
        const path = [
          [1, 1], [3, 1], [3, 3], [6, 3], [6, 1], [8, 2],
          [8, 4], [5, 4], [2, 4], [0, 2],
        ];
        const segT = t * (path.length - 1);
        const i = Math.min(Math.floor(segT), path.length - 2);
        const local = segT - i;
        const eased = Easing.easeInOutQuad(local);
        const px = path[i][0] + (path[i+1][0] - path[i][0]) * eased;
        const py = path[i][1] + (path[i+1][1] - path[i][1]) * eased;
        const spotX = gridX + px * cellW + cellW / 2;
        const spotY = gridY + py * cellH + cellH / 2;
        const spotR = 80;

        // The "design flaw" cells — a cross-cutting set
        const flawCells = [[1,1],[2,2],[4,2],[5,3],[7,3],[8,4]];
        const flawReveal = clamp((localTime - 4.5) / 1.2, 0, 1);

        return (
          <div style={{ position: 'absolute', inset: 0, background: C.bg, opacity: appear }}>
            <Chip x={160} y={120} color={C.accent}>02 · The Keyhole Problem</Chip>
            <div style={{
              position: 'absolute', left: 160, top: 160,
              fontFamily: SERIF, fontSize: 78, color: C.ink,
              letterSpacing: '-0.02em', maxWidth: 1500, lineHeight: 1.05,
            }}>
              LLMs see code through a keyhole.
            </div>

            {/* Grid of file cells */}
            <svg style={{ position: 'absolute', left: 0, top: 0 }} width="1920" height="1080">
              <defs>
                <mask id="keyhole-mask">
                  <rect width="1920" height="1080" fill="white" opacity="0.18" />
                  <circle cx={spotX} cy={spotY} r={spotR} fill="white" />
                </mask>
                <radialGradient id="spot-grad" cx="50%" cy="50%">
                  <stop offset="0%" stopColor={C.accent} stopOpacity="0.22"/>
                  <stop offset="60%" stopColor={C.accent} stopOpacity="0.05"/>
                  <stop offset="100%" stopColor={C.accent} stopOpacity="0"/>
                </radialGradient>
              </defs>

              {/* Dimmed grid */}
              <g opacity="0.28">
                {Array.from({ length: rows }).map((_, r) =>
                  Array.from({ length: cols }).map((_, c) => (
                    <g key={`${r}-${c}`}>
                      <rect
                        x={gridX + c * cellW + 6}
                        y={gridY + r * cellH + 6}
                        width={cellW - 12} height={cellH - 12}
                        fill="none" stroke={C.ink2} strokeWidth="1"
                      />
                      {/* lines representing code */}
                      {[0, 1, 2, 3].map((ln) => (
                        <line
                          key={ln}
                          x1={gridX + c * cellW + 16}
                          y1={gridY + r * cellH + 22 + ln * 14}
                          x2={gridX + c * cellW + 16 + ((c*3 + r + ln) % 5 + 4) * 10}
                          y2={gridY + r * cellH + 22 + ln * 14}
                          stroke={C.ink2} strokeWidth="2"
                        />
                      ))}
                    </g>
                  ))
                )}
              </g>

              {/* Spotlight glow */}
              <circle cx={spotX} cy={spotY} r={spotR * 2} fill="url(#spot-grad)" />

              {/* Revealed grid inside spotlight */}
              <g mask="url(#keyhole-mask)">
                {Array.from({ length: rows }).map((_, r) =>
                  Array.from({ length: cols }).map((_, c) => (
                    <g key={`${r}-${c}-lit`}>
                      <rect
                        x={gridX + c * cellW + 6}
                        y={gridY + r * cellH + 6}
                        width={cellW - 12} height={cellH - 12}
                        fill={C.bgDeep} stroke={C.ink} strokeWidth="1.2"
                      />
                      {[0, 1, 2, 3].map((ln) => (
                        <line
                          key={ln}
                          x1={gridX + c * cellW + 16}
                          y1={gridY + r * cellH + 22 + ln * 14}
                          x2={gridX + c * cellW + 16 + ((c*3 + r + ln) % 5 + 4) * 10}
                          y2={gridY + r * cellH + 22 + ln * 14}
                          stroke={C.ink} strokeWidth="2"
                        />
                      ))}
                    </g>
                  ))
                )}
              </g>

              {/* Spotlight ring */}
              <circle cx={spotX} cy={spotY} r={spotR} fill="none" stroke={C.accent} strokeWidth="1.5" opacity="0.8"/>

              {/* Design flaw callout — connects cross-cutting cells */}
              {flawReveal > 0 && (
                <g opacity={flawReveal}>
                  {flawCells.map(([cx, cy], idx) => {
                    const x = gridX + cx * cellW + cellW / 2;
                    const y = gridY + cy * cellH + cellH / 2;
                    return (
                      <g key={idx}>
                        <rect
                          x={gridX + cx * cellW + 2}
                          y={gridY + cy * cellH + 2}
                          width={cellW - 4} height={cellH - 4}
                          fill="none" stroke={C.red} strokeWidth="2.5" strokeDasharray="4 4"
                        />
                        <circle cx={x} cy={y} r="5" fill={C.red} />
                      </g>
                    );
                  })}
                  {/* connect them */}
                  <path
                    d={flawCells.map(([cx, cy], i) => {
                      const x = gridX + cx * cellW + cellW / 2;
                      const y = gridY + cy * cellH + cellH / 2;
                      return (i === 0 ? 'M' : 'L') + x + ' ' + y;
                    }).join(' ')}
                    fill="none" stroke={C.red} strokeWidth="2" strokeDasharray="6 4"
                  />
                </g>
              )}
            </svg>

            {/* Caption */}
            <div style={{
              position: 'absolute', left: 160, top: 820, right: 160,
              display: 'flex', gap: 48, alignItems: 'flex-start', justifyContent: 'space-between',
              opacity: clamp((localTime - 0.8) / 0.5, 0, 1),
            }}>
              <div style={{ fontFamily: SANS, fontSize: 26, color: C.ink, fontWeight: 500, maxWidth: 820, lineHeight: 1.35 }}>
                One file. One function. One context window.<br/>
                <span style={{ color: C.muted, fontWeight: 400 }}>Local bugs are visible. Design flaws are not.</span>
              </div>
              <div style={{
                opacity: flawReveal,
                fontFamily: MONO, fontSize: 14, color: C.red, letterSpacing: '0.14em', textTransform: 'uppercase',
                textAlign: 'right',
              }}>
                Design flaw spans 6 cells.<br/>Spotlight sees 1.
              </div>
            </div>
          </div>
        );
      }}
    </Sprite>
  );
}

// ─── SCENE 3 — Three approaches (11 – 19s) ──────────────────────────────────

function Scene3_ThreeApproaches() {
  return (
    <Sprite start={11.2} end={18.8}>
      {({ localTime, duration }) => {
        const tIn = clamp(localTime / 0.5, 0, 1);
        const tOut = clamp((localTime - (duration - 0.5)) / 0.5, 0, 1);
        const out = tOut > 0 ? 1 - tOut : 1;
        const appear = Easing.easeOutCubic(tIn) * out;

        // Three circles forming a venn-like arrangement
        const cx = 960, cy = 640, r = 240;
        const dx = 180;

        // Stagger: LLM first, SAST second, CPG third
        const p1 = clamp((localTime - 0.3) / 0.7, 0, 1);
        const p2 = clamp((localTime - 1.1) / 0.7, 0, 1);
        const p3 = clamp((localTime - 1.9) / 0.7, 0, 1);
        const pGap = clamp((localTime - 3.2) / 0.8, 0, 1);

        return (
          <div style={{ position: 'absolute', inset: 0, background: C.bg, opacity: appear }}>
            <Chip x={160} y={120} color={C.accent}>03 · Three approaches, three blind spots</Chip>
            <div style={{
              position: 'absolute', left: 160, top: 160,
              fontFamily: SERIF, fontSize: 78, color: C.ink,
              letterSpacing: '-0.02em', lineHeight: 1.05, maxWidth: 1500,
            }}>
              Bug finding is solved.
              <br/>
              <span style={{ color: C.ink2, fontStyle: 'italic' }}>Design analysis is not.</span>
            </div>

            <svg style={{ position: 'absolute', inset: 0 }} width="1920" height="1080">
              {/* LLM circle */}
              <circle cx={cx - dx} cy={cy - 96} r={r * Easing.easeOutCubic(p1)}
                fill={C.accent} fillOpacity={0.08 * p1}
                stroke={C.accent} strokeWidth="1.5" strokeOpacity={p1}/>
              {/* SAST circle */}
              <circle cx={cx + dx} cy={cy - 96} r={r * Easing.easeOutCubic(p2)}
                fill={C.ink} fillOpacity={0.06 * p2}
                stroke={C.ink} strokeWidth="1.5" strokeOpacity={p2}/>
              {/* CPG circle */}
              <circle cx={cx} cy={cy + 150} r={(r + 20) * Easing.easeOutCubic(p3)}
                fill={C.red} fillOpacity={0.08 * p3}
                stroke={C.red} strokeWidth="1.5" strokeOpacity={p3}
                strokeDasharray={p3 < 0.95 ? '4 4' : '0'}/>

              {/* LLM label — up-left of left circle center */}
              <g opacity={p1}>
                <text x={cx - dx - 80} y={cy - 140} textAnchor="middle" fontFamily={MONO} fontSize="14" fill={C.accent} letterSpacing="2">LLM</text>
                <text x={cx - dx - 80} y={cy - 106} textAnchor="middle" fontFamily={SANS} fontSize="24" fill={C.ink} fontWeight="500">Semantics</text>
                <text x={cx - dx - 80} y={cy - 76} textAnchor="middle" fontFamily={SANS} fontSize="15" fill={C.muted}>Understands intent.</text>
                <text x={cx - dx - 80} y={cy - 54} textAnchor="middle" fontFamily={SANS} fontSize="15" fill={C.muted}>Can't hold architecture.</text>
              </g>

              {/* SAST label — up-right of right circle center */}
              <g opacity={p2}>
                <text x={cx + dx + 80} y={cy - 140} textAnchor="middle" fontFamily={MONO} fontSize="14" fill={C.ink} letterSpacing="2">SAST · SEMGREP</text>
                <text x={cx + dx + 80} y={cy - 106} textAnchor="middle" fontFamily={SANS} fontSize="24" fill={C.ink} fontWeight="500">Coverage</text>
                <text x={cx + dx + 80} y={cy - 76} textAnchor="middle" fontFamily={SANS} fontSize="15" fill={C.muted}>3,000+ pattern rules.</text>
                <text x={cx + dx + 80} y={cy - 54} textAnchor="middle" fontFamily={SANS} fontSize="15" fill={C.muted}>No semantic reasoning.</text>
              </g>

              {/* Overlap label — "BUG FINDING (solved)" in the LLM∩SAST lens (top only) */}
              <g opacity={Math.min(p1, p2)}>
                <text x={cx} y={cy - 150} textAnchor="middle" fontFamily={MONO} fontSize="13"
                  fill={C.ink} letterSpacing="1.5">BUG FINDING</text>
                <text x={cx} y={cy - 128} textAnchor="middle" fontFamily={MONO} fontSize="11"
                  fill={C.muted} letterSpacing="1">(solved)</text>
              </g>

              {/* CPG label — inside bottom circle, below overlap */}
              <g opacity={p3}>
                <text x={cx} y={cy + 220} textAnchor="middle" fontFamily={MONO} fontSize="14" fill={C.red} letterSpacing="2">CPG</text>
                <text x={cx} y={cy + 252} textAnchor="middle" fontFamily={SANS} fontSize="24" fill={C.ink} fontWeight="500">Structure + Flow</text>
                <text x={cx} y={cy + 282} textAnchor="middle" fontFamily={SANS} fontSize="15" fill={C.muted}>Whole-program graph.</text>
                <text x={cx} y={cy + 304} textAnchor="middle" fontFamily={SANS} fontSize="15" fill={C.muted}>Architecture, visible.</text>
              </g>

              {/* 3-way intersection — the "?" */}
              <g opacity={Math.min(p1, p2, p3)}>
                <text x={cx} y={cy - 18} textAnchor="middle"
                  fontFamily={SERIF} fontStyle="italic" fontSize="56" fill={C.red} fontWeight="500">
                  ?
                </text>
              </g>

              {/* The gap — callout OUTSIDE the venn, arrow pointing at the 3-way intersection */}
              {pGap > 0 && (
                <g opacity={pGap}>
                  {/* target point at 3-way intersection */}
                  {/* callout text to the right of the venn */}
                  <text x={1520} y={cy - 120} textAnchor="start"
                    fontFamily={MONO} fontSize="13" fill={C.red} letterSpacing="2">
                    DESIGN ANALYSIS
                  </text>
                  <text x={1520} y={cy - 98} textAnchor="start"
                    fontFamily={MONO} fontSize="13" fill={C.red} letterSpacing="2">
                    LIVES HERE
                  </text>
                  {/* arrow from callout — arc over the top to the "?" */}
                  <path
                    d={`M 1510 ${cy - 102} Q 1200 ${cy - 300}, ${cx + 30} ${cy - 14}`}
                    stroke={C.red} strokeWidth="1.5" fill="none"
                    strokeDasharray="4 4"
                  />
                  {/* Arrowhead: triangle rotated to match tangent (down-left) */}
                  <g transform={`translate(${cx + 30}, ${cy - 14}) rotate(126)`}>
                    <path d="M 0 0 L -14 -6 L -14 6 Z" fill={C.red} />
                  </g>
                </g>
              )}
            </svg>
          </div>
        );
      }}
    </Sprite>
  );
}

Object.assign(window, { Scene1_Hook, Scene2_Keyhole, Scene3_ThreeApproaches, C, SANS, MONO, SERIF, Chip, Wipe, typewriter });
