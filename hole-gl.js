// ============================================================
//  APX CLIENT — real-time raytraced black hole (WebGL)
//  Full-screen shader: gravitational lensing, accretion disk,
//  Doppler beaming, photon ring, volumetric nebula.
//  Self-contained, no external libraries.
// ============================================================
(function () {
  "use strict";

  const canvas = document.getElementById('holeGL');
  if (!canvas) return;

  const gl = canvas.getContext('webgl', {
    alpha: true,
    antialias: false,
    premultipliedAlpha: false,
    powerPreference: 'high-performance',
  }) || canvas.getContext('experimental-webgl', { alpha: true, antialias: false });

  if (!gl) { canvas.style.display = 'none'; return; }

  const VERT = `
attribute vec2 aPos;
void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }
`;

  const FRAG = `
precision highp float;

uniform vec2  uRes;
uniform float uTime;
uniform float uReveal;   // 0..1 ignition progress
uniform float uZoom;     // camera distance
uniform vec2  uOffset;   // camera offset (parallax)

const float PI = 3.14159265359;
const float BH_R = 1.0;          // Schwarzschild radius
const float DISK_IN = 2.3;       // inner edge (ISCO-ish)
const float DISK_OUT = 9.0;      // outer edge

// ---------- hashes & noise ----------
float hash21(vec2 p){
  p = fract(p * vec2(123.34, 345.45));
  p += dot(p, p + 34.345);
  return fract(p.x * p.y);
}
float hash31(vec3 p){
  p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float noise3(vec3 x){
  vec3 i = floor(x), f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash31(i + vec3(0,0,0)), hash31(i + vec3(1,0,0)), f.x),
        mix(hash31(i + vec3(0,1,0)), hash31(i + vec3(1,1,0)), f.x), f.y),
    mix(mix(hash31(i + vec3(0,0,1)), hash31(i + vec3(1,0,1)), f.x),
        mix(hash31(i + vec3(0,1,1)), hash31(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm(vec3 p){
  float a = 0.5, s = 0.0;
  for (int i = 0; i < 5; i++){
    s += a * noise3(p);
    p *= 2.03;
    a *= 0.5;
  }
  return s;
}

// ---------- star field ----------
vec3 starField(vec3 dir){
  vec3 c = vec3(0.0);
  // three layers of stars at different scales
  for (int k = 0; k < 3; k++){
    float scale = 90.0 + float(k) * 130.0;
    vec3 p = dir * scale;
    vec3 id = floor(p);
    vec3 f = fract(p) - 0.5;
    float h = hash31(id + float(k) * 37.7);
    if (h > 0.955){
      float d = length(f);
      float bright = (h - 0.955) / 0.045;
      float core = smoothstep(0.34, 0.0, d) * bright;
      // slight colour variation: blue-white to warm
      vec3 tint = mix(vec3(0.72, 0.82, 1.0), vec3(1.0, 0.93, 0.82), hash31(id + 9.1));
      c += tint * core * (1.4 / (1.0 + float(k)));
    }
  }
  return c;
}

// ---------- volumetric nebula ----------
vec3 nebula(vec3 dir){
  vec3 p = dir * 2.4;
  float n1 = fbm(p + vec3(0.0, 0.0, uTime * 0.012));
  float n2 = fbm(p * 1.9 + vec3(5.2, 1.3, 2.7));
  float d = smoothstep(0.42, 0.92, n1 * 0.75 + n2 * 0.45);
  // cool blue-violet dust, matching the site palette
  vec3 col = mix(vec3(0.10, 0.16, 0.34), vec3(0.30, 0.42, 0.78), n2);
  col = mix(col, vec3(0.55, 0.62, 0.95), smoothstep(0.6, 1.0, n1));
  return col * d * 0.30;
}

// ---------- accretion disk emission ----------
vec3 diskColor(float r, float phi, float doppler){
  // temperature falls off with radius: white-hot inside, deep blue outside
  float t = clamp((r - DISK_IN) / (DISK_OUT - DISK_IN), 0.0, 1.0);
  vec3 hot  = vec3(1.00, 0.98, 0.95);
  vec3 mid  = vec3(0.62, 0.76, 1.00);
  vec3 cold = vec3(0.16, 0.28, 0.62);
  vec3 col = mix(hot, mid, smoothstep(0.0, 0.35, t));
  col = mix(col, cold, smoothstep(0.35, 1.0, t));
  // turbulent filaments
  float sw = phi * 3.0 + r * 1.7 - uTime * 0.55;
  float turb = fbm(vec3(cos(sw) * r * 0.55, sin(sw) * r * 0.55, r * 0.7 + uTime * 0.05));
  col *= 0.62 + 1.05 * turb;
  // relativistic beaming: approaching side much brighter & bluer
  col *= doppler;
  // inner edge glows hottest
  col += vec3(1.0, 0.97, 0.92) * smoothstep(0.30, 0.0, t) * 1.1;
  return col;
}

void main(){
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / min(uRes.x, uRes.y);
  uv *= uZoom;
  uv += uOffset;

  // camera: slightly above the disk plane -> 3/4 side view
  vec3 camPos = vec3(0.0, 1.05, 0.0);   // eye at origin, hole offset below
  vec3 ro = vec3(0.0, 0.0, 16.0);
  vec3 rd = normalize(vec3(uv.x, uv.y - 0.06, -1.55));

  // ---------- geodesic integration (gravitational bending) ----------
  vec3 pos = ro;
  vec3 vel = rd;
  vec3 col = vec3(0.0);
  float transmit = 1.0;
  bool captured = false;

  const int STEPS = 190;
  for (int i = 0; i < STEPS; i++){
    float r2 = dot(pos, pos);
    float r = sqrt(r2);
    if (r < BH_R) { captured = true; break; }
    if (r > 42.0) break;

    // step size: fine near the hole, coarse far away
    float dt = clamp(0.045 * r, 0.012, 0.75);
    // Schwarzschild-style acceleration a = -1.5 * h^2 * r / |r|^5
    vec3 h2 = cross(pos, vel);
    float hh = dot(h2, h2);
    vec3 acc = -1.5 * hh * pos / pow(r2, 2.5);
    vel += acc * dt;
    vec3 npos = pos + vel * dt;

    // ---- disk crossing (thin slab at y = 0) ----
    if (pos.y * npos.y < 0.0){
      float f = pos.y / (pos.y - npos.y);
      vec3 hit = mix(pos, npos, f);
      float hr = length(hit.xz);
      if (hr > DISK_IN && hr < DISK_OUT){
        float phi = atan(hit.z, hit.x);
        // orbital velocity -> Doppler factor
        vec3 tangent = normalize(vec3(-hit.z, 0.0, hit.x));
        vec3 vdir = normalize(vel);
        float beta = 0.62 / sqrt(max(hr, 1.0));
        float dopp = 1.0 / max(pow(1.0 - beta * dot(vdir, tangent) * 1.6, 3.0), 0.08);
        dopp = clamp(dopp, 0.25, 4.2);
        vec3 dc = diskColor(hr, phi, dopp);
        // edge softness
        float edge = smoothstep(DISK_IN, DISK_IN + 0.35, hr)
                   * (1.0 - smoothstep(DISK_OUT - 2.2, DISK_OUT, hr));
        col += transmit * dc * edge * 0.85;
        transmit *= 1.0 - edge * 0.72;
        if (transmit < 0.02) break;
      }
    }

    pos = npos;
  }

  // ---------- background (only what escapes the hole) ----------
  if (!captured){
    vec3 bg = starField(normalize(vel)) * 1.25;
    bg += nebula(normalize(vel));
    col += transmit * bg;
  }

  // ---------- photon ring: sharp bright halo at r ~ 1.5 Rs ----------
  float rr = length(pos);
  float ring = smoothstep(1.28, 1.5, rr) * (1.0 - smoothstep(1.5, 1.85, rr));
  col += vec3(1.0, 0.97, 0.93) * ring * 1.6 * transmit;

  // ---------- tone mapping & vignette ----------
  col = col / (col + vec3(0.85));           // Reinhard
  col = pow(col, vec3(0.86));               // gentle lift
  float vig = 1.0 - 0.32 * dot(uv, uv);
  col *= vig;

  // ignition fade: the hole materialises out of nothing
  col *= uReveal;

  float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
  gl_FragColor = vec4(col, clamp(lum * 2.6 + uReveal * 0.15, 0.0, 1.0));
}
`;

  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.warn('[holeGL] shader:', gl.getShaderInfoLog(s));
      gl.deleteShader(s);
      return null;
    }
    return s;
  }

  const vs = compile(gl.VERTEX_SHADER, VERT);
  const fs = compile(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) { canvas.style.display = 'none'; return; }

  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.warn('[holeGL] link:', gl.getProgramInfoLog(prog));
    canvas.style.display = 'none';
    return;
  }
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'aPos');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const U = {
    res: gl.getUniformLocation(prog, 'uRes'),
    time: gl.getUniformLocation(prog, 'uTime'),
    reveal: gl.getUniformLocation(prog, 'uReveal'),
    zoom: gl.getUniformLocation(prog, 'uZoom'),
    offset: gl.getUniformLocation(prog, 'uOffset'),
  };

  let W = 0, H = 0, dpr = 1;
  function resize() {
    // render below native resolution for performance, then let CSS upscale
    dpr = Math.min(window.devicePixelRatio || 1, 1.25);
    const scale = 0.85;
    W = Math.max(2, Math.round(canvas.clientWidth * dpr * scale));
    H = Math.max(2, Math.round(canvas.clientHeight * dpr * scale));
    if (canvas.width !== W || canvas.height !== H) {
      canvas.width = W;
      canvas.height = H;
      gl.viewport(0, 0, W, H);
    }
  }

  let raf = null;
  let t0 = performance.now();
  let reveal = 0;
  let revealTarget = 0;
  let running = false;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function frame(now) {
    if (!running) return;
    resize();
    const t = (now - t0) / 1000;
    reveal += (revealTarget - reveal) * 0.045;

    gl.uniform2f(U.res, W, H);
    gl.uniform1f(U.time, reduced ? 0 : t);
    gl.uniform1f(U.reveal, reveal);
    gl.uniform1f(U.zoom, 1.0);
    gl.uniform2f(U.offset, 0, 0);

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    raf = requestAnimationFrame(frame);
  }

  window.HoleGL = {
    start() {
      if (running) return;
      running = true;
      t0 = performance.now();
      revealTarget = 1;
      raf = requestAnimationFrame(frame);
    },
    setReveal(v) { revealTarget = v; },
    setInstant() { reveal = 1; revealTarget = 1; },
    stop() {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      raf = null;
    },
    ok: true,
  };

  window.addEventListener('resize', () => { if (running) resize(); });

  // if the tab is hidden we don't need to burn GPU
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (raf) { cancelAnimationFrame(raf); raf = null; }
    } else if (running && !raf) {
      t0 = performance.now() - 1000;
      raf = requestAnimationFrame(frame);
    }
  });
})();
