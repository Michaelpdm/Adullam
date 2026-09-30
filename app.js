// Shared behaviour for every page: nav, footer, quote modal, lightbox, portfolio rendering.
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const IG = "https://instagram.com/" + SITE.instagram;
  const IG_DM = "https://ig.me/m/" + SITE.instagram;
  const home = document.body.dataset.page === "home";
  const h = id => (home ? "" : "index.html") + "#" + id;

  /* ---------- nav ---------- */
  const brandHtml = (() => { const [a, ...r] = SITE.brand.split(" "); return `<span class="grad">${esc(a)}</span> ${esc(r.join(" "))}`; })();
  $("#nav").innerHTML = `
    <div class="wrap">
      <a href="index.html" class="logo">${brandHtml}</a>
      <button class="burger" aria-label="Menu" id="burger">☰</button>
      <div class="links" id="links">
        <div class="dd">
          <a href="${h("services")}" class="ddt">Services <span class="car">▾</span></a>
          <div class="ddm">${Object.entries(SERVICES).map(([k, s]) => `<a href="${k}.html">${s.icon} ${esc(s.name)}</a>`).join("")}</div>
        </div>
        <a href="${h("process")}">Process</a>
        <a href="${h("work")}">Work</a>
        <a href="${h("faq")}">FAQ</a>
        <a class="btn primary sm" href="#" data-quote style="color:#fff">Get a quote</a>
      </div>
    </div>`;
  $("#burger").onclick = () => {
    const open = $("#links").classList.toggle("open");
    $("#burger").textContent = open ? "✕" : "☰";
    $("#burger").setAttribute("aria-expanded", open);
  };
  $$("#links a").forEach(a => a.addEventListener("click", () => $("#links").classList.remove("open")));

  /* ---------- footer + floating buttons ---------- */
  $("#footer").innerHTML = `
    <div class="wrap">
      <div>© ${new Date().getFullYear()} ${esc(SITE.brand)}${SITE.parent ? " · by " + esc(SITE.parent) : ""}</div>
      <div class="fl">
        ${Object.entries(SERVICES).map(([k, s]) => `<a href="${k}.html">${esc(s.name)}</a>`).join("")}
        <a href="${IG}" target="_blank" rel="noopener">Instagram @${esc(SITE.instagram)}</a>
        <a href="mailto:${esc(SITE.email)}">Email</a>
      </div>
    </div>`;
  document.body.insertAdjacentHTML("beforeend", `
    <div class="fab">
      ${SITE.whatsapp ? `<a class="wa" href="https://wa.me/${SITE.whatsapp}" target="_blank" rel="noopener" aria-label="WhatsApp">💬</a>` : ""}
      <a class="ig" href="${IG_DM}" target="_blank" rel="noopener" aria-label="Message on Instagram">📸</a>
    </div>`);

  /* ---------- mobile bottom action bar ---------- */
  document.body.insertAdjacentHTML("beforeend", `
    <div class="mbar">
      <a class="btn primary" href="${IG_DM}" target="_blank" rel="noopener">📸 DM me</a>
      <a class="btn ghost" href="#" data-quote>Get a quote</a>
      ${SITE.whatsapp ? `<a class="btn ghost" href="https://wa.me/${SITE.whatsapp}" target="_blank" rel="noopener">💬</a>` : ""}
    </div>`);

  /* ---------- quote modal ---------- */
  document.body.insertAdjacentHTML("beforeend", `
    <div class="modal" id="qm" role="dialog" aria-modal="true" aria-label="Get a quote">
      <div class="mbox">
        <button class="mx" aria-label="Close" data-close>×</button>
        <div id="qform">
          <h3>Start a project</h3>
          <p class="msub">Fastest reply is on Instagram. Or fill this in and I'll send a quote and timeline.</p>
          <a class="btn primary" id="qig" href="${IG_DM}" target="_blank" rel="noopener" style="width:100%;margin-bottom:14px">📸 DM me on Instagram (fastest)</a>
          <form id="qf">
            <div class="row2">
              <label>Name<input name="name" required placeholder="Your name"></label>
              <label>Email / WhatsApp / IG<input name="contact" required placeholder="How can I reach you?"></label>
            </div>
            <div class="row2">
              <label>Service<select name="service" id="qs">
                ${Object.values(SERVICES).map(s => `<option>${esc(s.name)}</option>`).join("")}
                <option>Bundle / Other</option></select></label>
              <label>Package<select name="pkg" id="qp"><option>Not sure yet</option></select></label>
            </div>
            <label>Project details<textarea name="msg" rows="4" required placeholder="What are you looking for? Links, niche, deadline…"></textarea></label>
            <input name="website" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px;width:1px;height:1px;opacity:0">
            <button class="btn primary" style="justify-content:center" type="submit">Send request →</button>
            <div class="alt">
              ${SITE.whatsapp ? `<a class="btn ghost sm" id="qwa" href="#" target="_blank" rel="noopener">💬 WhatsApp</a>` : ""}
            </div>
          </form>
        </div>
        <div class="ok" id="qok">
          <div class="big">🎉</div><h3>Almost there!</h3>
          <p class="msub" id="qokmsg">Your email app should have opened with the request ready to send. Just hit send.</p>
          <button class="btn ghost" data-close>Close</button>
        </div>
      </div>
    </div>`);
  const qm = $("#qm"), qs = $("#qs"), qp = $("#qp");
  const svcByName = n => Object.values(SERVICES).find(s => s.name === n);
  function fillPkgs() {
    const s = svcByName(qs.value);
    qp.innerHTML = `<option>Not sure yet</option>` + (s ? s.packages.map(p => `<option>${esc(p.name)}</option>`).join("") : "");
  }
  qs.onchange = fillPkgs; fillPkgs();
  function messageText() {
    const f = new FormData($("#qf"));
    return `Hi ${SITE.brand}! I'm ${f.get("name") || "…"}.\nService: ${f.get("service")} (${f.get("pkg")})\nContact: ${f.get("contact") || "…"}\n\n${f.get("msg") || ""}`;
  }
  function openQuote(service, pkg) {
    $("#qform").style.display = ""; $("#qok").style.display = "none";
    if (service) { qs.value = service; fillPkgs(); if (pkg) qp.value = pkg; }
    qm.classList.add("open"); document.body.style.overflow = "hidden";
    setTimeout(() => $("#qf [name=name]").focus(), 50);
  }
  function closeQuote() { qm.classList.remove("open"); document.body.style.overflow = ""; }
  window.openQuote = openQuote;
  document.addEventListener("click", e => {
    const t = e.target.closest("[data-quote]");
    if (t) { e.preventDefault(); openQuote(t.dataset.service, t.dataset.pkg); }
    if (e.target.closest("[data-close]") || e.target === qm) closeQuote();
  });
  document.addEventListener("keydown", e => { if (e.key === "Escape") { closeQuote(); closeLb(); } });
  $("#qig").addEventListener("click", () => { try { navigator.clipboard.writeText(messageText()); } catch (_) {} });
  if ($("#qwa")) $("#qwa").addEventListener("click", function () { this.href = `https://wa.me/${SITE.whatsapp}?text=${encodeURIComponent(messageText())}`; });
  $("#qf").addEventListener("submit", async e => {
    e.preventDefault();
    const form = e.target, f = new FormData(form), body = messageText(), btn = $("button[type=submit]", form);
    const done = msg => { $("#qokmsg").textContent = msg; $("#qform").style.display = "none"; $("#qok").style.display = "block"; form.reset(); fillPkgs(); };
    // Fallback when no form key is set (or sending fails): WhatsApp if configured, otherwise the visitor's email app.
    const fallback = () => {
      if (SITE.whatsapp) {
        window.open(`https://wa.me/${SITE.whatsapp}?text=${encodeURIComponent(body)}`, "_blank");
        done("WhatsApp opened with your request ready to send. Just hit send.");
      } else {
        location.href = `mailto:${SITE.email}?subject=${encodeURIComponent("Project request: " + f.get("service"))}&body=${encodeURIComponent(body)}`;
        done("Your email app should have opened with the request ready to send. Just hit send. Or DM me on Instagram.");
      }
    };
    if (!SITE.sheetUrl && !SITE.formKey) return fallback();
    btn.disabled = true; btn.textContent = "Sending…";
    // Preferred: Google Sheet + email via Apps Script (see backend/SETUP.md). "no-cors" means we can't read the reply, so success = the request left the browser.
    if (SITE.sheetUrl) {
      try {
        await fetch(SITE.sheetUrl, { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({ name: f.get("name"), contact: f.get("contact"), service: f.get("service"), pkg: f.get("pkg"), msg: f.get("msg"), website: f.get("website") }) });
        done("Request sent! I'll reply soon, usually within a day. You can also DM me on Instagram.");
      } catch (_) { fallback(); }
      finally { btn.disabled = false; btn.textContent = "Send request →"; }
      return;
    }
    try {
      const r = await fetch("https://api.web3forms.com/submit", {
        method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ access_key: SITE.formKey, subject: "New project request: " + f.get("service"), from_name: SITE.brand, name: f.get("name"), message: body })
      });
      const j = await r.json();
      if (!j.success) throw new Error(j.message);
      done("Request sent! I'll reply soon, usually within a day. You can also DM me on Instagram.");
    } catch (_) { fallback(); }
    finally { btn.disabled = false; btn.textContent = "Send request →"; }
  });

  /* ---------- lightbox ---------- */
  document.body.insertAdjacentHTML("beforeend", `
    <div class="lb" id="lb"><button class="lb-x" aria-label="Close" id="lbx">×</button>
      <button class="lb-nav prev" id="lbp" aria-label="Previous">‹</button><button class="lb-nav next" id="lbn" aria-label="Next">›</button>
      <div class="lb-box"><div id="lbm"></div><div class="lb-cap" id="lbc"></div></div></div>`);
  let lbList = [], lbIdx = 0;
  function showLb() {
    const p = lbList[lbIdx];
    $("#lbm").innerHTML = p.type === "video"
      ? `<video src="${esc(p.src)}" controls autoplay playsinline loop></video>`
      : `<img src="${esc(p.src)}" alt="${esc(p.title)}">`;
    $("#lbc").innerHTML = `<b>${esc(p.title)}</b>${p.note ? " · " + esc(p.note) : ""}`;
  }
  function openLb(list, i) { lbList = list; lbIdx = i; showLb(); $("#lb").classList.add("open"); }
  function closeLb() { $("#lb").classList.remove("open"); $("#lbm").innerHTML = ""; }
  $("#lbx").onclick = closeLb;
  $("#lb").onclick = e => { if (e.target.id === "lb") closeLb(); };
  $("#lbp").onclick = () => { lbIdx = (lbIdx - 1 + lbList.length) % lbList.length; showLb(); };
  $("#lbn").onclick = () => { lbIdx = (lbIdx + 1) % lbList.length; showLb(); };

  /* ---------- portfolio rendering ---------- */
  function gallery(el, projects, emptyLabels) {
    if (!projects.length) {
      el.innerHTML = emptyLabels.map(l => `<div class="work empty"><div><span class="ph">🎞️</span>${esc(l)}<br><small>Coming soon</small></div></div>`).join("");
      return;
    }
    el.innerHTML = projects.map((p, i) => `
      <div class="work rv" data-i="${i}">
        ${p.type === "video"
          ? `<video src="${esc(p.src)}" ${p.poster ? `poster="${esc(p.poster)}"` : ""} muted loop playsinline preload="metadata"></video>`
          : `<img src="${esc(p.src)}" alt="${esc(p.title)}" loading="lazy">`}
        <div class="cap"><b>${esc(p.title)}</b><span>${esc(p.note || "")}</span></div>
      </div>`).join("");
    $$(".work", el).forEach(w => {
      const v = $("video", w);
      if (v) { w.onmouseenter = () => v.play().catch(() => {}); w.onmouseleave = () => { v.pause(); v.currentTime = 0; }; }
      w.onclick = () => openLb(projects, +w.dataset.i);
    });
  }

  /* ---------- home page ---------- */
  if (home) {
    $("#svcGrid").innerHTML = Object.entries(SERVICES).map(([k, s]) => `
      <a class="card rv" href="${k}.html">
        ${s.badge ? `<span class="tag">${esc(s.badge)}</span>` : ""}
        <div class="icon">${s.icon}</div><h3>${esc(s.name)}</h3><p>${esc(s.short)}</p>
        <ul>${s.features.slice(0, 3).map(f => `<li>${esc(f)}</li>`).join("")}</ul>
        <span class="go">View examples &amp; pricing →</span>
      </a>`).join("");
    const all = Object.values(SERVICES).flatMap(s => s.projects.map(p => ({ ...p, _s: s.name })));
    gallery($("#workGrid"), all.slice(0, 8), ["UGC sample", "AI video sample", "Website sample", "App sample"]);
    $("#faqList").innerHTML = FAQ.map(([q, a]) => `<details class="rv"><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join("");
    $("#heroTag").textContent = SITE.tagline;
    $$("[data-extra]").forEach(b => b.onclick = () => openQuote("Bundle / Other"));
  }

  /* ---------- service page ---------- */
  if (document.body.dataset.page === "service") {
    const key = document.body.dataset.svc || new URLSearchParams(location.search).get("s");
    const s = SERVICES[key];
    if (!s) { location.replace("index.html"); return; }
    document.title = `${s.name} — ${SITE.brand}`;
    $("#sv").innerHTML = `
      <div class="wrap">
        <div class="crumb"><a href="index.html">Home</a> / ${esc(s.name)}</div>
        <div class="svc-hero">
          <div class="icon">${s.icon}</div>
          <h1>${esc(s.name)}</h1>
          <p>${esc(s.long)}</p>
          <ul class="checks">${s.features.map(f => `<li>${esc(f)}</li>`).join("")}</ul>
          <div class="cta" style="justify-content:flex-start">
            <a class="btn primary" href="#" data-quote data-service="${esc(s.name)}">Order ${esc(s.name)} →</a>
            <a class="btn ghost" href="#pricing">See pricing</a>
            <a class="btn ghost" href="#examples">View examples</a>
          </div>
        </div>
      </div>
      <section id="examples"><div class="wrap">
        <div class="eyebrow">Examples</div><h2>Recent ${esc(s.name)} work</h2>
        <p class="sub">Click any project to view it full size.</p>
        <div class="gallery" id="gal"></div>
      </div></section>
      <section id="pricing"><div class="wrap">
        <div class="eyebrow">Pricing</div><h2>Pick a package</h2>
        <p class="sub">Custom needs? Choose the closest one and tell me the details.</p>
        <div class="grid">${s.packages.map(p => `
          <div class="card price-card ${p.featured ? "featured" : ""}">
            ${p.featured ? `<span class="tag">BEST VALUE</span>` : ""}
            <h3>${esc(p.name)}</h3><div class="price">${esc(p.price)}</div>
            <ul>${p.items.map(i => `<li>${esc(i)}</li>`).join("")}</ul>
            <a class="btn ${p.featured ? "primary" : "ghost"}" href="#" data-quote data-service="${esc(s.name)}" data-pkg="${esc(p.name)}">Get this package</a>
          </div>`).join("")}</div>
      </div></section>
      <section><div class="wrap">
        <div class="eyebrow">Also offering</div><h2 style="font-size:1.6rem">Explore other services</h2>
        <div class="others">${Object.entries(SERVICES).filter(([k]) => k !== key).map(([k, o]) => `<a href="${k}.html">${o.icon} ${esc(o.name)}</a>`).join("")}</div>
      </div></section>`;
    gallery($("#gal"), s.projects, ["Sample 1", "Sample 2", "Sample 3", "Sample 4"]);
  }

  const igb = $("#igBtn"); if (igb) igb.href = IG_DM;

  /* ---------- analytics (Vercel Web Analytics, live site only) ---------- */
  if (!/^(localhost|127\.|\[::1\])/.test(location.hostname)) {
    window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };
    const s = document.createElement("script"); s.defer = true; s.src = "/_vercel/insights/script.js"; document.head.appendChild(s);
  }

  /* ---------- scroll reveal ---------- */
  const io = new IntersectionObserver(es => es.forEach(x => { if (x.isIntersecting) { x.target.classList.add("in"); io.unobserve(x.target); } }), { threshold: .1 });
  $$(".rv").forEach(el => io.observe(el));
})();
