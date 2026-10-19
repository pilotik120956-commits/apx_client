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

  function build() {
    ribbons();
    sigils();
    rail();
    brackets();
    if (!reduce) document.documentElement.classList.add("decor-anim");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", build);
  } else {
    build();
  }

  window.ApxDecor = { rebuild: build };
})();
