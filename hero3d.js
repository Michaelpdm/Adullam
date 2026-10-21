// 3D robot hero: loads the Spline viewer only when the hero scrolls into view.
// Scene URL lives in data.js -> SITE.heroScene (swap it there). Falls back to a static image
// for reduced motion, data-saver and low-memory devices.
(function () {
  const scene = document.getElementById("rhScene");
  if (!scene) return;
  const VIEWER = "https://unpkg.com/@splinetool/viewer@1.12.95/build/spline-viewer.js";
  const url = (typeof SITE !== "undefined" && SITE.heroScene) || "";
  const conn = navigator.connection || {};
  const stay = !url || matchMedia("(prefers-reduced-motion: reduce)").matches || conn.saveData || (navigator.deviceMemory && navigator.deviceMemory <= 2);
  if (stay) { scene.classList.add("static"); return; }

  let started = false;
  function start() {
    if (started) return; started = true;
    const s = document.createElement("script");
    s.type = "module"; s.src = VIEWER;
    s.onerror = () => scene.classList.add("static");
    document.head.appendChild(s);
    const v = document.createElement("spline-viewer");
    v.setAttribute("url", url);
    v.setAttribute("loading-anim-type", "none");
    if (matchMedia("(hover:hover)").matches) v.setAttribute("events-target", "global"); // track cursor anywhere on the page
    v.addEventListener("load-complete", () => scene.classList.add("ready"));
    scene.appendChild(v);
    // if the viewer never reports ready (blocked/offline), keep the static fallback
    setTimeout(() => { if (!scene.classList.contains("ready")) scene.classList.add("static"); }, 15000);
  }
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { io.disconnect(); (window.requestIdleCallback || setTimeout)(start); } }, { rootMargin: "200px" });
    io.observe(scene);
  } else start();
})();
