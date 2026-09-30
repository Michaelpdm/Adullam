// Visual effects: particle background, cursor glow, scroll progress, hero cube, tilt cards, counters, marquee.
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const touch = matchMedia("(hover: none)").matches;

  /* scroll progress bar */
  document.body.insertAdjacentHTML("afterbegin", `<div id="progress"></div><canvas id="bg"></canvas><div id="glow"></div>`);
  const bar = $("#progress");

  /* particle network background */
  const cv = $("#bg"), cx = cv.getContext("2d");
  let W, H, pts = [], mouse = { x: -999, y: -999 };
  function size() {
    W = cv.width = innerWidth; H = cv.height = innerHeight;
    const n = Math.min(touch ? 35 : 90, Math.floor(W * H / (touch ? 22000 : 16000)));
    pts = Array.from({ length: n }, () => ({ x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - .5) * .35, vy: (Math.random() - .5) * .35, r: Math.random() * 1.6 + .4 }));
  }
  let raf;
  function draw() {
    cancelAnimationFrame(raf);
    cx.clearRect(0, 0, W, H);
    for (const p of pts) {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0 || p.x > W) p.vx *= -1;
      if (p.y < 0 || p.y > H) p.vy *= -1;
      const dx = p.x - mouse.x, dy = p.y - mouse.y, d = Math.hypot(dx, dy);
      if (d < 140) { p.x += dx / d * 1.2; p.y += dy / d * 1.2; }
      cx.beginPath(); cx.arc(p.x, p.y, p.r, 0, 6.283); cx.fillStyle = "rgba(180,160,255,.7)"; cx.fill();
    }
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
      const d = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y);
      if (d < 130) { cx.strokeStyle = `rgba(139,92,246,${(1 - d / 130) * .3})`; cx.lineWidth = 1; cx.beginPath(); cx.moveTo(pts[i].x, pts[i].y); cx.lineTo(pts[j].x, pts[j].y); cx.stroke(); }
    }
    if (!reduce && !document.hidden) raf = requestAnimationFrame(draw);
  }
  size(); draw(); addEventListener("resize", size);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) draw(); });

  /* cursor glow (smoothly follows the mouse) */
  const glow = $("#glow"); let gx = innerWidth / 2, gy = innerHeight / 3, tx = gx, ty = gy;
  addEventListener("mousemove", e => { tx = e.clientX; ty = e.clientY; mouse.x = tx; mouse.y = ty; });
  (function follow() { gx += (tx - gx) * .08; gy += (ty - gy) * .08; glow.style.transform = `translate(${gx}px,${gy}px)`; requestAnimationFrame(follow); })();

  /* scroll: progress bar + hero cube fly-away */
  const stage = $("#stage"), hero = $(".hero");
  let ticking = false;
  function onScroll() {
    const y = scrollY, max = document.documentElement.scrollHeight - innerHeight;
    bar.style.width = (max > 0 ? y / max * 100 : 0) + "%";
    if (stage && !reduce) {
      const p = Math.min(1, Math.max(0, y / (hero.offsetHeight * .85)));
      stage.style.setProperty("--p", p.toFixed(3));
    }
    ticking = false;
  }
  addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  onScroll();

  /* mouse tilt + spotlight on cards */
  if (!touch && !reduce) {
    $$(".card, .work:not(.empty)").forEach(el => {
      el.classList.add("tilt");
      el.addEventListener("mousemove", e => {
        const r = el.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
        el.style.setProperty("--mx", x + "px"); el.style.setProperty("--my", y + "px");
        el.style.transform = `perspective(800px) rotateX(${((y / r.height) - .5) * -9}deg) rotateY(${((x / r.width) - .5) * 9}deg) translateY(-6px)`;
      });
      el.addEventListener("mouseleave", () => { el.style.transform = ""; });
    });
  }

  /* rotating headline word */
  const rot = $("#rot");
  if (rot && !reduce) {
    const words = ["UGC videos", "video ads", "websites", "apps", "content"]; let i = 0;
    setInterval(() => {
      rot.classList.add("out");
      setTimeout(() => { i = (i + 1) % words.length; rot.textContent = words[i]; rot.classList.remove("out"); }, 350);
    }, 2400);
  }

  /* marquee */
  const mq = $("#mq");
  if (mq) {
    const items = ["AI UGC Videos", "AI Video Generation", "Web Development", "App Development", "Automation", "AI Chatbots", "Voiceovers"];
    const row = items.map(t => `<span>${t}</span>`).join("");
    mq.innerHTML = row + row;
  }

  /* phones: play gallery videos only while on screen */
  if (touch) {
    const vo = new IntersectionObserver(es => es.forEach(x => { const v = x.target; x.isIntersecting ? v.play().catch(() => {}) : v.pause(); }), { threshold: .6 });
    $$(".work video").forEach(v => vo.observe(v));
  }

  /* count-up stats */
  $$("[data-count]").forEach(el => {
    const end = +el.dataset.count;
    if (reduce) { el.textContent = end; return; }
    new IntersectionObserver((es, o) => es.forEach(x => {
      if (!x.isIntersecting) return; o.disconnect();
      const t0 = performance.now();
      (function tick(t) { const k = Math.min(1, (t - t0) / 1400); el.textContent = Math.round(end * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(tick); })(t0);
    })).observe(el);
  });
})();
