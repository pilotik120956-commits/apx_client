// ============================================================
//  APX CLIENT — shattered-glass matrix background
//  A Voronoi "broken glass" pattern. Inside every shard, falling
//  code columns and terminal log lines scroll. The crack edges
//  glow faintly. Rendered on a 2D canvas, palette-matched.
// ============================================================
(function () {
  "use strict";

  const canvas = document.getElementById('shards');
  if (!canvas || !canvas.getContext) return;

  const ctx = canvas.getContext('2d');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- glyphs & log vocabulary ----------
  const GLYPHS = "01<>{}[]/\\|=+-*#$_ABCDEFabcdef0197ｦｧｨｩｪｫｬｭｮｯｰｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ";
  const HEX = "0123456789abcdef";
  const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

  // log lines: mixed technical + raw data. Deliberately neutral —
  // module names, memory addresses, hashes, no "bypass" talk.
  const LOGS = [
    "> init apx.core ......... [ ok ]",
    "> mount /modules ......... [ ok ]",
    "> load mod.render ........ [ ok ]",
    "> load mod.hud ........... [ ok ]",
    "> load mod.input ......... [ ok ]",
    "> sync profile .......... 100%",
    "> cfg: theme=glass  lang=uk",
    "> cfg: fps_cap=unlimited",
    "> handshake 0x7f3a ........ ok",
    "> cache warm ........... 128 kb",
    "> checksum 4f2a9c31e08b7d16",
    "> checksum a91be77c0042ff5d",
    "> addr 0x0040F1A8 -> 0x0040F2C0",
    "> addr 0x7FFE2D40 -> 0x7FFE2E18",
    "> mem 24.6mb / 96.0mb",
    "> latency 3ms  jitter 0.4ms",
    "> modules online: 42",
    "> thread pool: 8 active",
    "> shader compile ......... ok",
    "> net sync ............... ok",
    "> profile saved to disk",
    "> hotkeys bound: 14",
    "> diagnostics: clean",
    "> 01001000 01000101 01001100",
    "> 4c 6f 61 64 69 6e 67 2e 2e",
    "APX-CLIENT v2.4 // stable",
    "C:\\apx> modules --list",
    "C:\\apx> run --profile default",
  ];

  function randGlyph() {
    return GLYPHS[(Math.random() * GLYPHS.length) | 0];
  }
  function randHex(n) {
    let s = "";
    for (let i = 0; i < n; i++) s += HEX[(Math.random() * 16) | 0];
    return s;
  }
  function randB64(n) {
    let s = "";
    for (let i = 0; i < n; i++) s += B64[(Math.random() * B64.length) | 0];
    return s;
  }
  function randToken() {
    const r = Math.random();
    if (r < 0.42) return randHex(4 + ((Math.random() * 6) | 0));
    if (r < 0.72) return randB64(4 + ((Math.random() * 8) | 0));
    return String((Math.random() * 9999) | 0);
  }

  // ---------- geometry ----------
  let W = 0, H = 0, dpr = 1;
  let seeds = [];       // break points of the glass
  let shards = [];      // polygons + their own animation state
  let cracks = [];      // short crack filaments between the main lines
  let rafId = null;
  let lastLog = 0;

  // font metrics — must match between measuring and drawing
  const CELL = 13;      // column width
  const LHF = 15;       // line height

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth;
    H = canvas.clientHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    buildGlass();
  }

  // Build the shattered-glass pattern: scattered seed points, and the
  // Voronoi cells around them become the shards.
  function buildGlass() {
    // fewer, larger panes — the glass should read as an accent, not a mesh
    const target = Math.max(7, Math.round((W * H) / 520000));
    const n = Math.min(14, target);
    seeds = [];
    for (let i = 0; i < n; i++) {
      seeds.push({
        x: 40 + Math.random() * (W - 80),
        y: 40 + Math.random() * (H - 80),
      });
    }
    // one "impact point" that most cracks radiate from
    const impact = {
      x: W * (0.24 + Math.random() * 0.52),
      y: H * (0.18 + Math.random() * 0.44),
    };
    // radial splinter points around the impact
    const arms = 9 + ((Math.random() * 6) | 0);
    for (let i = 0; i < arms; i++) {
      const a = (i / arms) * Math.PI * 2 + (Math.random() - 0.5) * 0.28;
      const d = 90 + Math.random() * Math.max(W, H) * 0.85;
      seeds.push({
        x: impact.x + Math.cos(a) * d,
        y: impact.y + Math.sin(a) * d,
        hub: true,
      });
    }

    // Voronoi cells via half-plane clipping
    shards = seeds.map((s, i) => {
      let poly = [
        { x: 0, y: 0 }, { x: W, y: 0 }, { x: W, y: H }, { x: 0, y: H },
      ];
      for (let j = 0; j < seeds.length; j++) {
        if (i === j) continue;
        const o = seeds[j];
        const mx = (s.x + o.x) * 0.5, my = (s.y + o.y) * 0.5;
        const nx = o.x - s.x, ny = o.y - s.y;
        poly = clipHalfPlane(poly, mx, my, nx, ny);
        if (poly.length < 3) break;
      }
      return {
        poly,
        // per-shard scroll state
        off: Math.random() * 1000,
        speed: 0.35 + Math.random() * 0.9,
        lit: 0.22 + Math.random() * 0.26,
        seedX: s.x,
        seedY: s.y,
        // should this shard show columns, logs, or both
        mode: Math.random() < 0.34 ? "log" : (Math.random() < 0.72 ? "code" : "mix"),
        logLines: [],
        trace: 0,
      };
    }).filter(s => s.poly.length >= 3);

    // build crack filaments radiating from the impact
    cracks = [];
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * Math.PI * 2;
      const len = 60 + Math.random() * 240;
      const start = {
        x: impact.x + (Math.random() - 0.5) * 60,
        y: impact.y + (Math.random() - 0.5) * 60,
      };
      const pts = [start];
      let cur = start;
      const segs = 3 + ((Math.random() * 4) | 0);
      for (let k = 0; k < segs; k++) {
        cur = {
          x: cur.x + Math.cos(a + (Math.random() - 0.5) * 0.6) * (len / segs),
          y: cur.y + Math.sin(a + (Math.random() - 0.5) * 0.6) * (len / segs),
        };
        pts.push(cur);
      }
      cracks.push({ pts, a: 0.05 + Math.random() * 0.12 });
    }
  }

  // Sutherland–Hodgman clip of a polygon by the half-plane
  // (p - m) · n <= 0
  function clipHalfPlane(poly, mx, my, nx, ny) {
    const out = [];
    const side = (p) => (p.x - mx) * nx + (p.y - my) * ny;
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      const da = side(a), db = side(b);
      if (da <= 0) out.push(a);
      if ((da <= 0 && db > 0) || (da > 0 && db <= 0)) {
        const t = da / (da - db);
        out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
      }
    }
    return out;
  }

  // ---------- drawing ----------
  function shardPath(poly) {
    ctx.beginPath();
    ctx.moveTo(poly[0].x, poly[0].y);
    for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i].x, poly[i].y);
    ctx.closePath();
  }

  // palette — read from the active theme so the canvas follows the theme picker
  let ACCENT = "110,132,180";
  let BRIGHT = "146,164,206";
  let SOFT   = "172,188,222";
  function readPalette() {
    const cs = getComputedStyle(document.documentElement);
    ACCENT = (cs.getPropertyValue('--canvas-tint').trim()   || ACCENT);
    BRIGHT = (cs.getPropertyValue('--canvas-bright').trim() || BRIGHT);
    SOFT   = (cs.getPropertyValue('--canvas-soft').trim()   || SOFT);
  }
  readPalette();
  document.addEventListener('apxtheme', () => {
    readPalette();
    if (reduce) draw(0);
  });

  function drawShardCode(sh, t) {
    // column code across the whole pane — the shard's own clip keeps it inside
    const x0 = 0;
    const x1 = W;
    ctx.font = CELL + "px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace";
    ctx.textBaseline = "top";
    const cols = Math.ceil((x1 - x0) / CELL);
    for (let c = 0; c < cols; c++) {
      const gx = x0 + c * CELL;
      // per-column phase + speed so they don't march in lockstep
      const ph = ((c * 97) % 61) / 61;
      const cs = 0.6 + ph * 1.5;
      const head = ((t * cs * 40 + ph * 1300 + sh.off) % (H + 300)) - 150;
      const tail = 11 + ((c * 13) % 16);
      for (let k = 0; k < tail; k++) {
        const gy = Math.round((head - k * LHF) / LHF) * LHF;
        if (gy < -LHF || gy > H + LHF) continue;
        const fade = 1 - k / tail;
        const a = sh.lit * (0.42 + 0.58 * fade);
        const lead = k === 0;
        if (lead) {
          ctx.fillStyle = "rgba(" + SOFT + "," + Math.min(1, sh.lit * 1.45).toFixed(3) + ")";
        } else {
          ctx.fillStyle = "rgba(" + ACCENT + "," + Math.min(1, a).toFixed(3) + ")";
        }
        ctx.fillText(randGlyph(), gx, gy);
      }
    }
  }

  function drawShardLog(sh, t) {
    ctx.font = LHF - 3 + "px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace";
    ctx.textBaseline = "top";
    // keep this shard's own scrolling list of log lines
    while (sh.logLines.length < 26) {
      const r = Math.random();
      if (r < 0.62) sh.logLines.push(LOGS[(Math.random() * LOGS.length) | 0]);
      else sh.logLines.push("> " + randToken() + " " + randToken() + " " + randToken());
    }
    const scroll = (t * sh.speed * 9 + sh.off) % LHF;
    const total = sh.logLines.length * LHF;
    for (let pass = -1; pass <= Math.ceil(H / total) + 1; pass++) {
      for (let i = 0; i < sh.logLines.length; i++) {
        const gy = i * LHF - scroll + pass * total;
        if (gy < -LHF || gy > H + LHF) continue;
        // typing-in effect: the newest line reveals character by character
        let txt = sh.logLines[i];
        if (i === sh.logLines.length - 1) {
          const n = Math.floor((sh.trace) % (txt.length + 6));
          txt = txt.slice(0, n);
        }
        const a = sh.lit * (i === sh.logLines.length - 1 ? 1.2 : 0.85);
        ctx.fillStyle = "rgba(" + ACCENT + "," + a.toFixed(3) + ")";
        ctx.fillText(txt, Math.max(0, sh.seedX - 400), gy);
      }
    }
  }

  function draw(t) {
    ctx.clearRect(0, 0, W, H);

    // --- the matrix code inside every shard, clipped by its polygon ---
    for (const sh of shards) {
      ctx.save();
      shardPath(sh.poly);
      ctx.clip();
      // faint glass fill so the shard reads as a pane
      ctx.fillStyle = "rgba(" + BRIGHT + ",0.014)";
      ctx.fill();

      if (sh.mode === "code") drawShardCode(sh, t);
      else if (sh.mode === "log") drawShardLog(sh, t);
      else { drawShardCode(sh, t); }

      ctx.restore();
    }

    // --- glowing crack edges ---
    ctx.lineWidth = 1;
    for (const sh of shards) {
      shardPath(sh.poly);
      ctx.strokeStyle = "rgba(" + BRIGHT + ",0.13)";
      ctx.stroke();
      // inner highlight line for a bevelled-glass feel
      ctx.strokeStyle = "rgba(" + SOFT + ",0.045)";
      ctx.stroke();
    }

    // --- impact-point splinter cracks (brighter) ---
    ctx.lineCap = "round";
    for (const cr of cracks) {
      ctx.beginPath();
      ctx.moveTo(cr.pts[0].x, cr.pts[0].y);
      for (let i = 1; i < cr.pts.length; i++) ctx.lineTo(cr.pts[i].x, cr.pts[i].y);
      ctx.strokeStyle = "rgba(" + SOFT + "," + (cr.a * 2.2).toFixed(3) + ")";
      ctx.lineWidth = 0.9;
      ctx.stroke();
    }

    // --- a slow travelling glint across the whole pane ---
    const glint = (t * 0.055) % 1.6 - 0.3;
    const gx = glint * W;
    const grad = ctx.createLinearGradient(gx - 180, 0, gx + 180, H);
    grad.addColorStop(0, "rgba(" + SOFT + ",0)");
    grad.addColorStop(0.5, "rgba(" + SOFT + ",0.022)");
    grad.addColorStop(1, "rgba(" + SOFT + ",0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    ctx.globalAlpha = 1;
  }

  function frame(now) {
    const t = now * 0.001;
    // refresh raw-data lines now and then so it keeps changing
    if (now - lastLog > 900) {
      lastLog = now;
      for (const sh of shards) {
        if (sh.mode === "log" && Math.random() < 0.5) {
          sh.logLines.push(
            Math.random() < 0.5
              ? LOGS[(Math.random() * LOGS.length) | 0]
              : "> " + randToken() + " " + randToken()
          );
          sh.logLines.shift();
          sh.trace = 0;
        }
        sh.trace += 8;
      }
    }
    draw(t);
    rafId = requestAnimationFrame(frame);
  }

  resize();
  if (reduce) {
    draw(0);
  } else {
    rafId = requestAnimationFrame(frame);
  }

  let rt = null;
  window.addEventListener('resize', () => {
    clearTimeout(rt);
    rt = setTimeout(() => { resize(); if (reduce) draw(0); }, 200);
  });
  document.addEventListener('visibilitychange', () => {
    if (reduce) return;
    if (document.hidden) { cancelAnimationFrame(rafId); rafId = null; }
    else if (!rafId) rafId = requestAnimationFrame(frame);
  });

  window.ShardsFX = { ok: true, count: () => shards.length, renderOnce: (t) => draw(t || 4) };
})();
