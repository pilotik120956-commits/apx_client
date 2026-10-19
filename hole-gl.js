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
const float DISK_OUT = 7.4;      // outer edge
const float DISK_H = 0.16;       // disk half-thickness (volumetric)

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
// sharper, ridged turbulence for plasma filaments
float ridge(vec3 p){
  float a = 0.5, s = 0.0;
  for (int i = 0; i < 4; i++){
    float n = 1.0 - abs(noise3(p) * 2.0 - 1.0);
    s += a * n * n;
    p *= 2.17;
    a *= 0.5;
  }
  return s;
}

// ---------- star field ----------
vec3 starField(vec3 dir){
  vec3 c = vec3(0.0);
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
      vec3 tint = mix(vec3(0.72, 0.82, 1.0), vec3(1.0, 0.93, 0.82), hash31(id + 9.1));
      // twinkle
      float tw = 0.78 + 0.22 * sin(uTime * (1.5 + h * 4.0) + h * 40.0);
      c += tint * core * (1.4 / (1.0 + float(k))) * tw;
    }
  }
  return c;
}

// ---------- volumetric nebula ----------
vec3 nebula(vec3 dir){
  vec3 p = dir * 2.4;
  float n1 = fbm(p + vec3(0.0, 0.0, uTime * 0.012));
  float n2 = fbm(p * 1.9 + vec3(5.2, 1.3, 2.7));
  float n3 = ridge(p * 3.4 + vec3(uTime * 0.01));
  float d = smoothstep(0.52, 0.98, n1 * 0.75 + n2 * 0.45);
  vec3 col = mix(vec3(0.10, 0.16, 0.34), vec3(0.30, 0.42, 0.78), n2);
  col = mix(col, vec3(0.55, 0.62, 0.95), smoothstep(0.6, 1.0, n1));
  // violet wisps
  col = mix(col, vec3(0.42, 0.28, 0.72), smoothstep(0.55, 0.95, n3) * 0.5);
  return col * d * 0.17;
}

// ---------- accretion disk emission ----------
vec3 diskColor(float r, float phi, float doppler, float height){
  // temperature falls off with radius: white-hot inside, deep blue outside
  float t = clamp((r - DISK_IN) / (DISK_OUT - DISK_IN), 0.0, 1.0);
  vec3 hot  = vec3(1.00, 0.98, 0.95);
  vec3 mid  = vec3(0.62, 0.76, 1.00);
  vec3 cold = vec3(0.16, 0.28, 0.62);
  vec3 col = mix(hot, mid, smoothstep(0.0, 0.35, t));
  col = mix(col, cold, smoothstep(0.35, 1.0, t));

  // differential rotation: inner orbits are much faster
  float omega = 1.9 / pow(max(r, 1.0), 1.5);
  float sw = phi + uTime * omega * 1.6;

  // multi-octane plasma: long filaments + fine turbulence
  float fil = ridge(vec3(cos(sw) * r * 0.5, sin(sw) * r * 0.5, r * 0.42 - uTime * 0.10));
  float turb = fbm(vec3(cos(sw) * r * 1.7, sin(sw) * r * 1.7, r * 1.2 + uTime * 0.22));
  col *= 0.48 + 1.25 * fil + 0.35 * turb;

  // vertical puffiness: thin at the edges, thicker near the middle
  col *= 1.0 - smoothstep(0.0, DISK_H, abs(height)) * 0.45;

  // hot spots orbiting the inner edge
  float spot = pow(fract(sw * 0.159 + 0.5), 12.0);
  col += vec3(1.0, 0.96, 0.88) * spot * smoothstep(3.0, 0.8, r) * 1.4;

  // relativistic beaming
  col *= doppler;

  // inner edge glows hottest
  col += vec3(1.0, 0.97, 0.92) * smoothstep(0.30, 0.0, t) * 1.1;
  return col;
}

// ---------- gravitational-wave ripple, warping the whole image ----------
vec2 gwRipple(vec2 uv, float t){
  float d = length(uv);
  // fade the warp out near the core so the shadow stays perfectly crisp
  float falloff = smoothstep(0.05, 0.55, d);
  float phase = d * 7.0 - t * 2.4;
  float amp = 0.0045 * exp(-d * 1.35) * sin(phase) * falloff;
  return uv * (1.0 + amp) + vec2(0.0, amp * 0.6);
}

// ---------- flares / prominences erupting off the disk ----------
vec3 flares(vec3 dir, float t){
  vec3 c = vec3(0.0);
  for (int i = 0; i < 3; i++){
    float fi = float(i);
    float ang = fi * 2.1 + t * (0.25 + fi * 0.12);
    // flare origin on the disk, position wanders slowly
    vec3 origin = normalize(vec3(cos(ang), 0.0, sin(ang))) * (2.6 + fi * 1.4);
    // vertical cone of plasma rising out of the disk
    vec3 up = normalize(vec3(cos(ang) * 0.22, 1.0, sin(ang) * 0.22));
    vec3 rel = dir - origin * 0.0;
    float a = max(dot(dir, up) - 0.35, 0.0);
    float w = fbm(dir * 5.5 + vec3(0.0, -t * (0.7 + fi * 0.25), fi * 3.0));
    float body = smoothstep(0.72, 1.0, w) * pow(a, 1.6);
    vec3 tint = mix(vec3(0.55, 0.72, 1.0), vec3(0.85, 0.9, 1.0), fi / 2.0);
    c += tint * body * 0.55;
  }
  return c;
}

// ---------- Einstein ring: the thin secondary image of the disk ----------
vec3 einsteinRing(vec3 pos, vec3 vel, float t){
  // the ring is the light that orbited ~half a turn before escaping
  float r = length(pos);
  float band = exp(-pow((r - 1.42) * 9.0, 2.0));
  // modulate by direction so it isn't a flat circle
  float mod = 0.65 + 0.35 * sin(atan(pos.z, pos.x) * 3.0 + t * 0.8);
  vec3 tint = mix(vec3(0.95, 0.97, 1.0), vec3(0.65, 0.78, 1.0), mod);
  return tint * band * mod * 1.5;
}

void main(){
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / min(uRes.x, uRes.y);
  uv *= uZoom;
  uv += uOffset;

  // ---------- gravitational-wave ripple warps the whole image ----------
  uv = gwRipple(uv, uTime);

  // camera: lifted well above the disk plane -> clean 3/4 view from the side
  vec3 ro = vec3(0.0, 0.0, 16.0);
  // slow cinematic drift, but always kept clear of the disk plane
  ro.y += 3.1 + sin(uTime * 0.11) * 0.42;
  ro.x += cos(uTime * 0.07) * 0.34;

  // aim the camera at the singularity so the hole stays centred
  vec3 target = vec3(0.0);
  vec3 fwd = normalize(target - ro);
  vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), fwd));
  vec3 up = cross(fwd, right);
  float fov = 1.85;
  vec3 rd = normalize(fwd * fov + right * uv.x + up * uv.y);

  // ---------- geodesic integration (gravitational bending) ----------
  vec3 pos = ro;
  vec3 vel = rd;
  vec3 col = vec3(0.0);
  float transmit = 1.0;
  bool captured = false;
  float minR = 1e9;   // closest approach, for the captured-shadow term

  const int STEPS = 230;
  for (int i = 0; i < STEPS; i++){
    float r2 = dot(pos, pos);
    float r = sqrt(r2);
    minR = min(minR, r);
    if (r < BH_R) { captured = true; break; }
    if (r > 42.0) break;

    // step size: fine near the hole, coarse far away
    float dt = clamp(0.040 * r, 0.010, 0.75);
    // Schwarzschild-style acceleration a = -1.5 * h^2 * r / |r|^5
    vec3 h2 = cross(pos, vel);
    float hh = dot(h2, h2);
    vec3 acc = -1.5 * hh * pos / pow(r2, 2.5);
    vel += acc * dt;
    vec3 npos = pos + vel * dt;

    // ---- volumetric disk: accumulate through the slab |y| < DISK_H ----
    // sample the segment against the two slab planes
    float tSlab = -1.0;
    if (abs(pos.y) < DISK_H && abs(npos.y) < DISK_H){
      tSlab = 0.5;                                 // fully inside
    } else if (pos.y * npos.y < 0.0 || abs(npos.y) < DISK_H) {
      tSlab = mix(0.5, 1.0, 0.5);                  // crossed a face
    }

    // emit only where the ray actually passes close to the mid-plane
    float band = exp(-pow(pos.y / DISK_H, 2.0));
    float hn = 1.0 - smoothstep(0.0, DISK_H * 1.15, abs(pos.y));
    float hr = length(pos.xz);
    if (hr > DISK_IN * 0.92 && hr < DISK_OUT && band * hn > 0.02){
      float phi = atan(pos.z, pos.x);
      vec3 tangent = normalize(vec3(-pos.z, 0.0, pos.x));
      vec3 vdir = normalize(vel);
      float beta = 0.62 / sqrt(max(hr, 1.0));
      float dopp = 1.0 / max(pow(1.0 - beta * dot(vdir, tangent) * 1.6, 2.1), 0.10);
      dopp = clamp(dopp, 0.42, 3.2);
      vec3 dc = diskColor(hr, phi, dopp, pos.y);
      // radial falloff so the edges fade out softly
      float edge = smoothstep(DISK_IN, DISK_IN + 0.45, hr)
                 * (1.0 - smoothstep(DISK_OUT - 2.4, DISK_OUT, hr));
      float dens = edge * band * hn;
      // rays plunging toward the horizon get their emission suppressed:
      // this is what carves the crisp black shadow out of the disk
      float plunge = smoothstep(BH_R * 0.95, BH_R * 3.4, length(cross(pos, vel)) / max(length(vel), 0.001));
      dens *= mix(1.0, 0.05, 1.0 - plunge);
      // emission-absorption integration
      float step = dt * dens * 1.35;
      col += transmit * dc * step;
      transmit *= exp(-step * 1.15);
      if (transmit < 0.015) break;
    }

    pos = npos;
  }

  // ---------- background (only what escapes the hole) ----------
  if (!captured){
    vec3 bg = starField(normalize(vel)) * 1.05;
    bg += nebula(normalize(vel));
    bg += flares(normalize(vel), uTime);
    col += transmit * bg;
  }

  // ---------- Einstein ring (thin secondary image of the disk) ----------
  col += einsteinRing(pos, vel, uTime) * transmit;

  // ---------- photon ring: sharp bright halo at r ~ 1.5 Rs ----------
  float rr = length(pos);
  float ring = smoothstep(1.26, 1.48, rr) * (1.0 - smoothstep(1.5, 1.9, rr));
  col += vec3(1.0, 0.97, 0.93) * ring * 2.0 * transmit;

  // shadow mask: nothing additive may be drawn inside the captured cone
  float shadow = captured ? 0.0 : 1.0;
  // a captured ray's final position sits inside the horizon -> full shadow
  shadow *= smoothstep(BH_R * 0.92, BH_R * 1.22, minR);

  // ---------- sparks / infalling debris (screen-space particles) ----------
  {
    vec2 sp = uv * 3.1;
    vec2 sid = floor(sp);
    vec2 sf = fract(sp) - 0.5;
    float h = hash21(sid + 3.7);
    float rad = 2.2 + h * 6.5;
    float ang = uTime * (1.6 / pow(rad, 1.2)) + h * 40.0;
    vec2 cpos = vec2(cos(ang), sin(ang) * 0.30) * rad * 0.115;
    float d = length(sf - cpos);
    float spark = smoothstep(0.055, 0.0, d) * smoothstep(0.30, 0.0, h * 0.4);
    col += vec3(1.0, 0.96, 0.90) * spark * 1.6 * transmit * shadow;
    col += vec3(0.7, 0.82, 1.0) * spark * 0.5 * shadow;
  }

  // ---------- jet glow: narrow polar cone along the vertical axis ----------
  {
    vec2 jp = vec2(uv.x, uv.y * 0.55);
    float cone = exp(-pow(length(jp) * 3.4, 1.6));   // concentrated near the core
    float ax   = pow(max(0.0, abs(uv.y) / max(length(uv), 0.001)), 3.0);
    float jet  = cone * ax * exp(-length(uv) * 1.1) * 0.55;
    col += vec3(0.62, 0.76, 1.0) * jet;
  }

  // ---------- dynamic bloom: brighten pixels that exceed a threshold ----------
  float preLum = dot(col, vec3(0.2126, 0.7152, 0.0722));
  float bloom = smoothstep(0.55, 1.7, preLum);
  col += col * bloom * 0.85;

  // ---------- tone mapping & vignette ----------
  col = col / (col + vec3(0.88));           // Reinhard
  col = pow(col, vec3(0.85));               // gentle lift
  // subtle chromatic edge tint (lens aberration)
  float rE = length(uv);
  col.r *= 1.0 + rE * 0.035;
  col.b *= 1.0 + rE * 0.055;
  vec3 colB = col;
  float vig = 1.0 - 0.34 * dot(uv, uv);
  col *= vig;

  // ignition fade: the hole materialises out of nothing
  col *= uReveal;

  float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
  gl_FragColor = vec4(col, clamp(lum * 2.8 + uReveal * 0.15, 0.0, 1.0));
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
    const cw = canvas.clientWidth || window.innerWidth;
    const ch = canvas.clientHeight || window.innerHeight;
    W = Math.max(2, Math.round(cw * dpr * scale));
    H = Math.max(2, Math.round(ch * dpr * scale));
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
      // size the drawing buffer before the first frame so there is never a
      // flash of the default 300x150 canvas
      resize();
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

  // the raytracer is live: let the CSS layers step aside for it
  const introEl = document.getElementById('intro');
  if (introEl) introEl.classList.add('has-gl');

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
