// ============================================================
//  APX CLIENT — ambient decor layer
//  Pure-DOM ornaments that follow the active theme:
//    · drifting aurora ribbons behind the content
//    · slow-rotating orbital sigils at the section edges
//    · a hairline scroll-progress rail at the very top
//    · corner brackets that frame each section head
//  Everything is pointer-events:none and respects
//  prefers-reduced-motion.
// ============================================================
(function () {
  "use strict";

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---------- 1. aurora ribbons ----------
  function ribbons() {
    const host = document.getElementById("bg");
    if (!host || host.querySelector(".ribbons")) return;
    const wrap = document.createElement("div");
    wrap.className = "ribbons";
    wrap.setAttribute("aria-hidden", "true");
    for (let i = 0; i < 3; i++) {
      const r = document.createElement("span");
      r.className = "ribbon ribbon-" + (i + 1);
      wrap.appendChild(r);
    }
    host.appendChild(wrap);
  }

  // ---------- 2. orbital sigils ----------
  function sigils() {
    const sections = document.querySelectorAll(".section");
    sections.forEach((sec, i) => {
      if (sec.querySelector(".sigil")) return;
      const s = document.createElement("div");
      s.className = "sigil sigil-" + ((i % 3) + 1);
      s.setAttribute("aria-hidden", "true");
      s.innerHTML =
        '<svg viewBox="0 0 200 200" fill="none" stroke="currentColor">' +
        '<circle cx="100" cy="100" r="86" stroke-width=".6"/>' +
        '<circle cx="100" cy="100" r="64" stroke-width=".5" stroke-dasharray="3 7"/>' +
        '<circle cx="100" cy="100" r="42" stroke-width=".6"/>' +
        '<path d="M100 14v20M100 166v20M14 100h20M166 100h20" stroke-width=".7"/>' +
        '<path d="M100 58l7 20 20 7-20 7-7 20-7-20-20-7 20-7z" stroke-width=".7"/>' +
        "</svg>";
      sec.appendChild(s);
    });
  }

  // ---------- 3. scroll-progress rail ----------
  function rail() {
    if (document.querySelector(".scroll-rail")) return;
    const el = document.createElement("div");
    el.className = "scroll-rail";
    el.setAttribute("aria-hidden", "true");
    el.innerHTML = '<i></i>';
    document.body.appendChild(el);

    const bar = el.firstChild;
    let ticking = false;
    function paint() {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      bar.style.transform = "scaleX(" + p.toFixed(4) + ")";
      ticking = false;
    }
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(paint);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", paint);
    paint();
  }

  // ---------- 4. corner brackets on section heads ----------
  function brackets() {
    document.querySelectorAll(".section-head").forEach(head => {
      if (head.querySelector(".brackets")) return;
      const b = document.createElement("span");
      b.className = "brackets";
      b.setAttribute("aria-hidden", "true");
      b.innerHTML = "<i></i><i></i><i></i><i></i>";
      head.appendChild(b);
    });
  }

  // ---------- 5. hero HUD frame ----------
  function heroHud() {
    const stage = document.querySelector(".hero-stage");
    if (!stage || stage.querySelector(".hud")) return;
    const hud = document.createElement("div");
    hud.className = "hud";
    hud.setAttribute("aria-hidden", "true");
    hud.innerHTML =
      '<span class="hud-ring"></span>' +
      '<span class="hud-ring hud-ring-2"></span>' +
      '<span class="hud-tick hud-tick-1"></span>' +
      '<span class="hud-tick hud-tick-2"></span>' +
      '<span class="hud-tick hud-tick-3"></span>' +
      '<span class="hud-tick hud-tick-4"></span>' +
      '<span class="hud-tag hud-tag-a">STABLE · 240 FPS</span>' +
      '<span class="hud-tag hud-tag-b">FABRIC 1.21.11</span>';
    stage.appendChild(hud);
  }

  // ---------- 6. back-to-top button ----------
  function toTop() {
    if (document.querySelector(".to-top")) return;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "to-top";
    btn.setAttribute("aria-label", "Догори");
    btn.innerHTML =
      '<svg class="sicon" width="17" height="17" aria-hidden="true" viewBox="0 0 24 24">' +
      '<path d="M12 19V5M6 11l6-6 6 6"/></svg>';
    document.body.appendChild(btn);

    const toggle = () => {
      btn.classList.toggle("show", window.scrollY > window.innerHeight * 0.9);
    };
    btn.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
    });
    window.addEventListener("scroll", toggle, { passive: true });
    toggle();
  }

  // ---------- 7. drifting data motes ----------
  function motes() {
    if (document.querySelector(".motes")) return;
    const wrap = document.createElement("div");
    wrap.className = "motes";
    wrap.setAttribute("aria-hidden", "true");
    // a deterministic scatter so the field is stable between reloads
    let seed = 0x2f6e;
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    for (let i = 0; i < 26; i++) {
      const m = document.createElement("i");
      m.style.left = (rnd() * 100).toFixed(2) + "%";
      m.style.top = (rnd() * 100).toFixed(2) + "%";
      const s = 1 + rnd() * 2.2;
      m.style.width = s.toFixed(1) + "px";
      m.style.height = s.toFixed(1) + "px";
      m.style.animationDelay = (-rnd() * 22).toFixed(1) + "s";
      m.style.animationDuration = (16 + rnd() * 20).toFixed(1) + "s";
      m.style.opacity = (0.16 + rnd() * 0.4).toFixed(2);
      wrap.appendChild(m);
    }
    document.body.appendChild(wrap);
  }

  // ---------- 8. ghost section numerals ----------
  function numerals() {
    const map = {
      features: "01", modules: "02", pricing: "03",
      review: "04", reviews: "05", faq: "06", start: "07",
    };
    document.querySelectorAll(".section").forEach(sec => {
      const id = sec.id || "";
      const num = map[id] || null;
      if (!num || sec.querySelector(".sec-num")) return;
      sec.style.position = sec.style.position || "relative";
      const n = document.createElement("span");
      n.className = "sec-num";
      n.setAttribute("aria-hidden", "true");
      n.textContent = num;
      sec.appendChild(n);
    });
  }

  // ---------- 9. hero scan sweep ----------
  function scan() {
    const stage = document.querySelector(".hero-stage");
    if (!stage || stage.querySelector(".scan-sweep")) return;
    const el = document.createElement("span");
    el.className = "scan-sweep";
    el.setAttribute("aria-hidden", "true");
    stage.appendChild(el);
  }

  // ---------- 10. status ticker under the hero ----------
  function ticker() {
    const hero = document.querySelector(".hero");
    if (!hero || hero.querySelector(".ticker")) return;
    const items = [
      "SHADER · WEBGL RAYTRACER ONLINE",
      "MODULES · 20+ LOADED",
      "FABRIC · 1.21.11",
      "LATENCY · 12 MS",
      "BUILD · STABLE",
      "THEME · ADAPTIVE",
    ];
    const el = document.createElement("div");
    el.className = "ticker";
    el.setAttribute("aria-hidden", "true");
    const row = items.concat(items)
      .map(t => '<span class="tk"><i></i>' + t + "</span>")
      .join("");
    el.innerHTML = '<div class="ticker-track">' + row + "</div>";
    hero.appendChild(el);
  }

  function build() {
    ribbons();
    sigils();
    rail();
    brackets();
    heroHud();
    toTop();
    motes();
    numerals();
    scan();
    ticker();
    if (!reduce) document.documentElement.classList.add("decor-anim");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", build);
  } else {
    build();
  }

  window.ApxDecor = { rebuild: build };
})();
