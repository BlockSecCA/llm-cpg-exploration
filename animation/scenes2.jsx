// scenes2.jsx — scenes 4, 5, 6, 7, 8

// ─── SCENE 4 — Three graphs merged (19 – 27.5s) ─────────────────────────────

function Scene4_Graphs() {
  return (
    <Sprite start={19} end={27.3}>
      {({ localTime, duration }) => {
        const tIn = clamp(localTime / 0.5, 0, 1);
        const tOut = clamp((localTime - (duration - 0.5)) / 0.5, 0, 1);
        const out = tOut > 0 ? 1 - tOut : 1;
        const appear = Easing.easeOutCubic(tIn) * out;

        // Phase: 0..1 AST in, 1..2 CFG in, 2..3 PDG in, 3..4 all together
        const pAST = clamp((localTime - 0.2) / 0.8, 0, 1);
        const pCFG = clamp((localTime - 1.6) / 0.8, 0, 1);
        const pPDG = clamp((localTime - 3.0) / 0.8, 0, 1);
        const pMerge = clamp((localTime - 4.2) / 1.2, 0, 1);

        // Node positions — a little code structure, spread across canvas
        const nodes = {
          fn:    { x: 520, y: 80,  label: 'function' },
          p1:    { x: 220, y: 260, label: 'param' },
          p2:    { x: 420, y: 260, label: 'param' },
          ifs:   { x: 620, y: 260, label: 'if' },
          call:  { x: 820, y: 260, label: 'call' },
          then:  { x: 540, y: 440, label: 'then' },
          els:   { x: 680, y: 440, label: 'else' },
          args:  { x: 900, y: 440, label: 'args' },
          sink:  { x: 900, y: 600, label: 'db.update()' },
        };

        // Offset for positioning on full canvas
        const ox = 480;
        const oy = 300;

        const astEdges = [
          ['fn','p1'],['fn','p2'],['fn','ifs'],['fn','call'],
          ['ifs','then'],['ifs','els'],['call','args'],
        ];
        const cfgEdges = [ ['p2','ifs'], ['ifs','then'], ['then','call'], ['call','sink'] ];
        const pdgEdges = [ ['p1','call'], ['p2','sink'] ];

        const renderEdges = (edges, opacity, color, style) => (
          <g opacity={opacity}>
            {edges.map(([a, b], i) => {
              const na = nodes[a], nb = nodes[b];
              return (
                <line key={i}
                  x1={na.x + ox} y1={na.y + oy}
                  x2={nb.x + ox} y2={nb.y + oy}
                  stroke={color} strokeWidth="1.8"
                  strokeDasharray={style === 'dashed' ? '5 4' : null}
                />
              );
            })}
          </g>
        );

        // Nodes
        const renderNodes = () => (
          <g>
            {Object.entries(nodes).map(([k, n]) => {
              const appearP = clamp((localTime - 0.1 - Object.keys(nodes).indexOf(k) * 0.06) / 0.4, 0, 1);
              return (
                <g key={k} opacity={appearP} transform={`translate(${n.x + ox}, ${n.y + oy})`}>
                  <circle r={12} fill={C.bg} stroke={C.ink} strokeWidth="1.8"/>
                  <text y={-22} textAnchor="middle" fontFamily={MONO} fontSize="18" fill={C.ink}>{n.label}</text>
                </g>
              );
            })}
          </g>
        );

        // Node counter ticker
        const counterP = clamp((localTime - 4.8) / 2.5, 0, 1);
        const count = Math.floor(Easing.easeOutCubic(counterP) * 443000);

        return (
          <div style={{ position: 'absolute', inset: 0, background: C.bg, opacity: appear }}>
            <Chip x={160} y={120} color={C.accent}>04 · Code Property Graph</Chip>
            <div style={{
              position: 'absolute', left: 160, top: 160,
              fontFamily: SERIF, fontSize: 78, color: C.ink,
              letterSpacing: '-0.02em', lineHeight: 1.05, maxWidth: 1500,
            }}>
              Three graphs, merged into one.
            </div>

            <svg style={{ position: 'absolute', inset: 0 }} width="1920" height="1080">
              {/* AST edges — solid black */}
              {renderEdges(astEdges, pAST, C.ink, 'solid')}
              {/* CFG edges — dashed blue */}
              {renderEdges(cfgEdges, pCFG, C.accent, 'dashed')}
              {/* PDG edges — green */}
              {renderEdges(pdgEdges, pPDG, C.green, 'solid')}
              {renderNodes()}
            </svg>

            {/* Layer labels that appear */}
            {[
              { label: 'AST — structure', y: 880, color: C.ink, p: pAST },
              { label: 'CFG — execution', y: 920, color: C.accent, p: pCFG },
              { label: 'PDG — data flow', y: 960, color: C.green, p: pPDG },
            ].map((L, i) => (
              <div key={i} style={{
                position: 'absolute', left: 200, top: L.y,
                fontFamily: MONO, fontSize: 15, color: L.color,
                opacity: L.p, letterSpacing: '0.08em',
                display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <span style={{ display: 'inline-block', width: 28, height: 2, background: L.color }}/>
                {L.label.toUpperCase()}
              </div>
            ))}

            {/* Counter */}
            <div style={{
              position: 'absolute', right: 160, bottom: 320, left: 160,
              textAlign: 'right',
              opacity: counterP,
              pointerEvents: 'none',
            }}>
              <div style={{ fontFamily: MONO, fontSize: 14, color: C.muted, letterSpacing: '0.2em' }}>
                CPG NODES · TARGET APP
              </div>
              <div style={{
                fontFamily: SERIF, fontSize: 140, color: C.ink,
                letterSpacing: '-0.04em', lineHeight: 1, fontVariantNumeric: 'tabular-nums',
                marginTop: 8,
              }}>
                {count.toLocaleString()}
              </div>
            </div>
          </div>
        );
      }}
    </Sprite>
  );
}

// ─── SCENE 5 — 9 questions rapid fire (27.5 – 38s) ──────────────────────────

const Q9 = [
  { id: 'S1', label: 'Routes',      stat: '109',   note: 'handlers in server.ts' },
  { id: 'S2', label: 'Middleware',  stat: '9',     note: 'reusable, security.*' },
  { id: 'S3', label: 'Auth',        stat: 'custom',note: 'not passport' },
  { id: 'S4', label: 'DB ops',      stat: '33',    note: 'files (Sequelize + Mongo)' },
  { id: 'S5', label: 'Validation',  stat: '0',     note: 'no library, no ad-hoc', danger: true },
  { id: 'S6', label: 'Errors',      stat: '1',     note: 'global handler leaks' },
  { id: 'S7', label: 'Uploads',     stat: '4',     note: 'validators always pass' },
  { id: 'S8', label: 'Rate limits', stat: '4/109', note: '3.7% of routes' },
  { id: 'S9', label: 'WebSocket',   stat: '1',     note: 'no auth on connect' },
];

function Scene5_NineQuestions() {
  return (
    <Sprite start={27.5} end={38.3}>
      {({ localTime, duration }) => {
        const tIn = clamp(localTime / 0.4, 0, 1);
        const tOut = clamp((localTime - (duration - 0.4)) / 0.4, 0, 1);
        const out = tOut > 0 ? 1 - tOut : 1;
        const appear = Easing.easeOutCubic(tIn) * out;

        // 3x3 grid, cards flip in
        const cardDelay = 0.25;
        const stagger = 0.55;

        return (
          <div style={{ position: 'absolute', inset: 0, background: C.bgDeep, opacity: appear }}>
            <Chip x={160} y={120} color={C.accent}>05 · Pass 1 — Structural Discovery</Chip>
            <div style={{
              position: 'absolute', left: 160, top: 160,
              fontFamily: SERIF, fontSize: 78, color: C.ink,
              letterSpacing: '-0.02em', lineHeight: 1.05,
            }}>
              9 questions. <span style={{ color: C.accent, fontStyle: 'italic' }}>Zero lines of code read.</span>
            </div>

            {/* Grid */}
            <div style={{
              position: 'absolute', left: 160, top: 380,
              display: 'grid', gridTemplateColumns: 'repeat(3, 520px)', gap: 20,
            }}>
              {Q9.map((q, i) => {
                const p = clamp((localTime - (cardDelay + i * stagger)) / 0.55, 0, 1);
                const eased = Easing.easeOutCubic(p);
                const hold = clamp((localTime - (cardDelay + i * stagger + 0.55)), 0, 1);
                return (
                  <div key={q.id} style={{
                    width: 520, height: 160,
                    background: C.bg,
                    border: `1px solid ${q.danger ? C.red : C.rule}`,
                    borderLeft: `4px solid ${q.danger ? C.red : C.accent}`,
                    padding: '20px 24px',
                    opacity: p,
                    transform: `translateY(${(1 - eased) * 16}px)`,
                    position: 'relative',
                    boxShadow: p > 0.9 ? '0 1px 0 rgba(0,0,0,0.04)' : 'none',
                  }}>
                    <div style={{
                      fontFamily: MONO, fontSize: 12, color: C.muted,
                      letterSpacing: '0.18em',
                    }}>
                      {q.id} · {q.label.toUpperCase()}
                    </div>
                    <div style={{
                      fontFamily: SERIF, fontSize: 68, color: q.danger ? C.red : C.ink,
                      lineHeight: 1, marginTop: 4,
                      fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em',
                    }}>
                      {q.stat}
                    </div>
                    <div style={{
                      fontFamily: SANS, fontSize: 14, color: C.ink2,
                      marginTop: 6,
                    }}>
                      {q.note}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      }}
    </Sprite>
  );
}

// ─── SCENE 6 — 8 CWEs → 30 findings (38.5 – 48s) ────────────────────────────

const CWES = [
  { id: 'CWE-269', t: '58 unprotected routes',          sev: 'Critical' },
  { id: 'CWE-311', t: 'MD5, hardcoded HMAC, plaintext', sev: 'Critical' },
  { id: 'CWE-434', t: 'Fake file upload validators',    sev: 'High' },
  { id: 'CWE-501', t: '22 untrusted DB operations',     sev: 'Critical' },
  { id: 'CWE-602', t: '4.6% input validation coverage', sev: 'High' },
  { id: 'CWE-653', t: 'Unprotected security functions', sev: 'High' },
  { id: 'CWE-799', t: 'Login not rate-limited',         sev: 'Medium' },
  { id: 'CWE-841', t: 'No purchase state machine',      sev: 'High' },
];

function Scene6_Findings() {
  return (
    <Sprite start={38.5} end={47.8}>
      {({ localTime, duration }) => {
        const tIn = clamp(localTime / 0.4, 0, 1);
        const tOut = clamp((localTime - (duration - 0.4)) / 0.4, 0, 1);
        const out = tOut > 0 ? 1 - tOut : 1;
        const appear = Easing.easeOutCubic(tIn) * out;

        const rowStart = 1.0;
        const rowStagger = 0.35;
        const stampP = clamp((localTime - (rowStart + CWES.length * rowStagger + 0.3)) / 0.6, 0, 1);

        return (
          <div style={{ position: 'absolute', inset: 0, background: C.bg, opacity: appear }}>
            <Chip x={160} y={120} color={C.accent}>06 · Pass 2 — Design Analysis</Chip>
            <div style={{
              position: 'absolute', left: 160, top: 160,
              fontFamily: SERIF, fontSize: 78, color: C.ink,
              letterSpacing: '-0.02em', lineHeight: 1.05,
            }}>
              8 CWEs. 11 queries. <span style={{ color: C.red, fontStyle: 'italic' }}>30 findings.</span>
            </div>

            {/* Table */}
            <div style={{
              position: 'absolute', left: 160, top: 380, width: 1600,
              fontFamily: SANS,
            }}>
              {/* header */}
              <div style={{
                display: 'grid', gridTemplateColumns: '180px 1fr 180px',
                fontFamily: MONO, fontSize: 12, color: C.muted,
                letterSpacing: '0.18em', padding: '10px 0',
                borderBottom: `1px solid ${C.ink}`,
              }}>
                <div>CWE</div>
                <div>FINDING</div>
                <div style={{ textAlign: 'right' }}>SEVERITY</div>
              </div>

              {CWES.map((f, i) => {
                const p = clamp((localTime - (rowStart + i * rowStagger)) / 0.4, 0, 1);
                const sevColor = f.sev === 'Critical' ? C.red : f.sev === 'High' ? C.amber : C.ink2;
                return (
                  <div key={f.id} style={{
                    display: 'grid', gridTemplateColumns: '180px 1fr 180px',
                    padding: '14px 0',
                    borderBottom: `1px solid ${C.rule}`,
                    opacity: p,
                    transform: `translateX(${(1 - Easing.easeOutCubic(p)) * -20}px)`,
                  }}>
                    <div style={{ fontFamily: MONO, fontSize: 15, color: C.ink, fontWeight: 500 }}>{f.id}</div>
                    <div style={{ fontFamily: SANS, fontSize: 20, color: C.ink }}>{f.t}</div>
                    <div style={{
                      textAlign: 'right', fontFamily: MONO, fontSize: 13,
                      letterSpacing: '0.1em', color: sevColor, textTransform: 'uppercase',
                    }}>
                      ● {f.sev}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Zero false positives stamp */}
            {stampP > 0 && (
              <div style={{
                position: 'absolute',
                right: 160, bottom: 140,
                opacity: stampP,
                transform: `rotate(-4deg) scale(${0.6 + 0.4 * Easing.easeOutBack(stampP)})`,
                border: `3px solid ${C.red}`,
                padding: '16px 28px',
                fontFamily: MONO,
                color: C.red,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                background: C.bg,
              }}>
                <div style={{ fontSize: 12, opacity: 0.7 }}>30 confirmed</div>
                <div style={{ fontSize: 28, fontWeight: 700, lineHeight: 1.1 }}>Zero false<br/>positives</div>
              </div>
            )}
          </div>
        );
      }}
    </Sprite>
  );
}

// ─── SCENE 7 — 5 of 974 (48 – 54.5s) ────────────────────────────────────────

function Scene7_Ratio() {
  return (
    <Sprite start={48} end={54.5}>
      {({ localTime, duration }) => {
        const tIn = clamp(localTime / 0.5, 0, 1);
        const tOut = clamp((localTime - (duration - 0.5)) / 0.5, 0, 1);
        const out = tOut > 0 ? 1 - tOut : 1;
        const appear = Easing.easeOutCubic(tIn) * out;

        // 974 tiny cells, 5 glow — grid on right half
        const count = 974;
        const cols = 28;
        const rows = Math.ceil(count / cols);
        const cellSize = 18;
        const gap = 3;
        const gridW = cols * (cellSize + gap) - gap;
        const gridH = rows * (cellSize + gap) - gap;
        const gridX = 1920 - gridW - 160;
        const gridY = 130;

        // Deterministic 5 positions
        const chosen = new Set([37, 194, 412, 641, 823]);

        const cellReveal = clamp((localTime - 0.3) / 1.8, 0, 1);
        const dimP = clamp((localTime - 2.3) / 0.8, 0, 1);
        const highlightP = clamp((localTime - 3.0) / 0.8, 0, 1);
        const textP = clamp((localTime - 3.8) / 0.8, 0, 1);

        return (
          <div style={{ position: 'absolute', inset: 0, background: C.bg, opacity: appear }}>
            <Chip x={160} y={120} color={C.accent}>07 · Targeted verification</Chip>
            <div style={{
              position: 'absolute', left: 160, top: 160, width: 780,
              fontFamily: SERIF, fontSize: 68, color: C.ink,
              letterSpacing: '-0.02em', lineHeight: 1.05,
            }}>
              From reading every file —
            </div>
            <div style={{
              position: 'absolute', left: 160, top: 246, width: 780,
              fontFamily: SERIF, fontStyle: 'italic', fontSize: 68, color: C.accent,
              letterSpacing: '-0.02em', lineHeight: 1.05,
              opacity: clamp((localTime - 0.4) / 0.6, 0, 1),
            }}>
              to querying for answers.
            </div>

            <svg style={{ position: 'absolute', left: 0, top: 0 }} width="1920" height="1080">
              {Array.from({ length: count }).map((_, i) => {
                const r = Math.floor(i / cols);
                const c = i % cols;
                const x = gridX + c * (cellSize + gap);
                const y = gridY + r * (cellSize + gap);
                const cellP = clamp(cellReveal * count / 10 - i / 10, 0, 1);
                const isChosen = chosen.has(i);
                const baseOp = isChosen
                  ? 1
                  : 1 - dimP * 0.85;
                const fill = isChosen
                  ? (highlightP > 0 ? C.red : C.ink)
                  : C.ink;
                return (
                  <rect key={i}
                    x={x} y={y}
                    width={cellSize * cellP}
                    height={cellSize * cellP}
                    fill={fill}
                    opacity={baseOp * cellP}
                  />
                );
              })}

              {/* Rings around chosen 5 */}
              {[...chosen].map((i, idx) => {
                const r = Math.floor(i / cols);
                const c = i % cols;
                const x = gridX + c * (cellSize + gap);
                const y = gridY + r * (cellSize + gap);
                const ringP = clamp((localTime - (3.0 + idx * 0.1)) / 0.5, 0, 1);
                return (
                  <circle key={`ring-${i}`}
                    cx={x + cellSize / 2} cy={y + cellSize / 2}
                    r={cellSize * 1.6 * ringP}
                    fill="none" stroke={C.red} strokeWidth="2" opacity={ringP * (1 - ringP * 0.3)}
                  />
                );
              })}
            </svg>

            {/* Numerical readout */}
            <div style={{
              position: 'absolute', left: 160, top: 420, width: 720,
              display: 'flex', flexDirection: 'column',
              opacity: textP,
            }}>
              <div style={{
                fontFamily: SERIF, fontSize: 240, color: C.red,
                lineHeight: 0.9, letterSpacing: '-0.04em', fontVariantNumeric: 'tabular-nums',
              }}>
                5
              </div>
              <div style={{
                fontFamily: SERIF, fontSize: 120, color: C.muted, lineHeight: 0.9,
                marginTop: 16,
              }}>
                <span style={{ color: C.muted }}>of </span>
                <span style={{ color: C.ink }}>974</span>
              </div>
              <div style={{
                fontFamily: MONO, fontSize: 15, color: C.muted,
                letterSpacing: '0.12em', marginTop: 36, lineHeight: 1.6,
              }}>
                FUNCTIONS READ&nbsp;·&nbsp;FILES IN CODEBASE<br/>
                <span style={{ color: C.ink }}>0.5% of the code</span>
              </div>
            </div>
          </div>
        );
      }}
    </Sprite>
  );
}

// ─── SCENE 8 — Thesis + end card (54.5 – 62s) ───────────────────────────────

function Scene8_Close() {
  return (
    <Sprite start={54.7} end={62}>
      {({ localTime, duration }) => {
        const tIn = clamp(localTime / 0.6, 0, 1);
        const tOut = clamp((localTime - (duration - 0.4)) / 0.4, 0, 1);
        const out = tOut > 0 ? 1 - tOut : 1;
        const appear = Easing.easeOutCubic(tIn) * out;

        const line1P = clamp((localTime - 0.3) / 0.8, 0, 1);
        const line2P = clamp((localTime - 1.2) / 0.8, 0, 1);
        const line3P = clamp((localTime - 2.1) / 0.8, 0, 1);
        const thesisOut = clamp((localTime - 3.6) / 0.5, 0, 1);
        const endCardP = clamp((localTime - 4.0) / 0.8, 0, 1);

        return (
          <div style={{ position: 'absolute', inset: 0, background: C.bg, opacity: appear }}>
            {/* Thesis lines */}
            <div style={{
              position: 'absolute', left: 160, top: 180, right: 160,
              fontFamily: SERIF, fontSize: 78, lineHeight: 1.15,
              letterSpacing: '-0.02em', color: C.ink,
              opacity: 1 - thesisOut,
            }}>
              <div style={{
                opacity: line1P, transform: `translateY(${(1 - line1P) * 12}px)`,
                marginBottom: 16,
              }}>
                Bug finding is solved.
              </div>
              <div style={{
                opacity: line2P, transform: `translateY(${(1 - line2P) * 12}px)`,
                color: 'rgba(24,22,20,0.55)', fontStyle: 'italic',
                marginBottom: 40,
              }}>
                Design analysis needs a structural bridge.
              </div>
              <div style={{
                opacity: line3P, transform: `translateY(${(1 - line3P) * 12}px)`,
                color: C.red,
                fontSize: 52,
              }}>
                The CPG is the right abstraction layer.
              </div>
            </div>

            {/* End card */}
            <div style={{
              position: 'absolute', inset: 0,
              background: C.bg,
              opacity: endCardP,
              display: 'flex', flexDirection: 'column',
              justifyContent: 'center', alignItems: 'flex-start',
              paddingLeft: 160, paddingRight: 160,
            }}>
              <div style={{
                fontFamily: MONO, fontSize: 14, color: C.muted,
                letterSpacing: '0.24em', marginBottom: 32,
              }}>
                OWASP A06 · INSECURE DESIGN
              </div>
              <div style={{
                fontFamily: SERIF, fontSize: 104, color: C.ink,
                letterSpacing: '-0.02em', lineHeight: 1.04, maxWidth: 1500,
                whiteSpace: 'nowrap',
              }}>
                <div>Can an LLM find</div>
                <div>design flaws in code</div>
                <div style={{ fontStyle: 'italic', color: C.red }}>it can't read?</div>
              </div>
              <div style={{
                marginTop: 60, display: 'flex', gap: 80, alignItems: 'baseline',
                fontFamily: MONO, fontSize: 18,
              }}>
                <div>
                  <div style={{ color: C.muted, fontSize: 12, letterSpacing: '0.2em', marginBottom: 6 }}>READ</div>
                  <div style={{ color: C.ink }}>cpg.blocksec.ca</div>
                </div>
                <div>
                  <div style={{ color: C.muted, fontSize: 12, letterSpacing: '0.2em', marginBottom: 6 }}>CODE</div>
                  <div style={{ color: C.ink }}>github.com/BlockSecCA/llm-cpg-exploration</div>
                </div>
              </div>
            </div>
          </div>
        );
      }}
    </Sprite>
  );
}

Object.assign(window, { Scene4_Graphs, Scene5_NineQuestions, Scene6_Findings, Scene7_Ratio, Scene8_Close });
