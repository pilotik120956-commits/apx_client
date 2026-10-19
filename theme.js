// ============================================================
//  APX CLIENT — theme switcher
//  Four hand-tuned dark themes, applied via <html data-theme="...">.
//  The choice is remembered in localStorage. Switching is animated with
//  a short cross-fade so it never feels like a hard blink.
// ============================================================
(function () {
  "use strict";

  const THEMES = [
    { id: "cosmic",   name: "Cosmic",   dot: "#7f97cf", hint: "Глибокий синій космос" },
    { id: "obsidian", name: "Obsidian", dot: "#b9bac2", hint: "Нейтральний графіт" },
    { id: "abyss",    name: "Abyss",    dot: "#6fb3ba", hint: "Холодна вода" },
    { id: "ember",    name: "Ember",    dot: "#cf9d68", hint: "Теплий бурштин" },
  ];
  const KEY = "apx_theme";
  const root = document.documentElement;

  function read() {
    let t = null;
    try { t = localStorage.getItem(KEY); } catch (e) {}
    return THEMES.some(x => x.id === t) ? t : "cosmic";
  }

  let current = read();

  function apply(id, animate) {
    if (!THEMES.some(t => t.id === id)) id = "cosmic";
    if (!animate) root.classList.add("theme-no-anim");
    root.setAttribute("data-theme", id);
    current = id;
    try { localStorage.setItem(KEY, id); } catch (e) {}
    // keep the mobile browser chrome in step with the theme
    const meta = document.getElementById("metaTheme");
    if (meta) {
      const bg = getComputedStyle(root).getPropertyValue("--bg").trim();
      if (bg) meta.setAttribute("content", bg);
    }
    // remove the freeze on the next frame so the transition is smooth
    if (!animate) requestAnimationFrame(() => root.classList.remove("theme-no-anim"));
    document.dispatchEvent(new CustomEvent("apxtheme", { detail: { theme: id } }));
  }

  // apply immediately (before paint) so there is no flash of the wrong theme
  apply(current, false);

  // ---------- build the picker UI ----------
  function buildPicker(mountId) {
    const host = document.getElementById(mountId);
    if (!host) return;

    const wrap = document.createElement("div");
    wrap.className = "theme-picker";

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "theme-btn";
    btn.setAttribute("aria-haspopup", "true");
    btn.setAttribute("aria-expanded", "false");
    btn.setAttribute("aria-label", "Змінити тему");
    btn.innerHTML =
      '<svg class="sicon" width="15" height="15" aria-hidden="true" viewBox="0 0 24 24">' +
      '<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 0 0 18 4.5 4.5 0 0 1 0-9 4.5 4.5 0 0 0 0-9z" fill="currentColor" stroke="none"/></svg>';

    const menu = document.createElement("div");
    menu.className = "theme-menu glass";
    menu.setAttribute("role", "menu");

    THEMES.forEach(t => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "theme-item";
      item.setAttribute("role", "menuitemradio");
      item.dataset.theme = t.id;
      item.innerHTML =
        '<span class="theme-dot" style="--dot:' + t.dot + '"></span>' +
        '<span class="theme-text"><b>' + t.name + '</b><i>' + t.hint + '</i></span>' +
        '<svg class="sicon theme-tick" width="14" height="14" aria-hidden="true" viewBox="0 0 24 24">' +
        '<path d="m5 12.5 4.2 4.2L19 7"/></svg>';
      item.addEventListener("click", () => {
        apply(t.id, true);
        close();
      });
      menu.appendChild(item);
    });

    wrap.appendChild(btn);
    wrap.appendChild(menu);
    host.appendChild(wrap);

    const open = () => {
      wrap.classList.add("open");
      btn.setAttribute("aria-expanded", "true");
    };
    const close = () => {
      wrap.classList.remove("open");
      btn.setAttribute("aria-expanded", "false");
    };

    btn.addEventListener("click", e => {
      e.stopPropagation();
      wrap.classList.contains("open") ? close() : open();
    });
    document.addEventListener("click", e => {
      if (!wrap.contains(e.target)) close();
    });
    document.addEventListener("keydown", e => {
      if (e.key === "Escape") close();
    });

    // reflect the active theme
    const paint = () => {
      menu.querySelectorAll(".theme-item").forEach(el => {
        el.classList.toggle("is-active", el.dataset.theme === current);
      });
    };
    paint();
    document.addEventListener("apxtheme", paint);
  }

  window.ApxTheme = {
    list: () => THEMES.map(t => t.id),
    get: () => current,
    set: (id) => apply(id, true),
    mount: buildPicker,
  };

  // auto-mount on every slot present (desktop nav + mobile menu)
  function mountAll() {
    document.querySelectorAll("[data-theme-slot]").forEach(el => {
      if (!el.querySelector(".theme-picker")) buildPicker(el.id);
    });
  }
  document.addEventListener("DOMContentLoaded", mountAll);
  // if the script runs after DOMContentLoaded already fired
  if (document.readyState !== "loading") mountAll();
})();
