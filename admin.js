// Private admin dashboard. Talks to the Google Apps Script in backend/Code.gs (password checked there, not here).
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const slug = s => String(s).toLowerCase().replace(/\s+/g, "-");
  const STATUSES = ["New", "Contacted", "Quoted", "Paid", "In progress", "Delivered", "Lost"];
  const EARNED = ["Paid", "In progress", "Delivered"];      // statuses whose Amount counts as revenue
  let pw = "", rows = [], filter = "All", query = "", openId = null;
  try { pw = sessionStorage.getItem("adm") || ""; } catch (_) {}

  /* ---------- api ---------- */
  async function api(action, payload = {}) {
    if (!SITE.sheetUrl) throw new Error("sheetUrl is not set in data.js");
    // text/plain keeps this a "simple" request (no CORS preflight), which Apps Script requires
    const r = await fetch(SITE.sheetUrl, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ action, pw, ...payload }) });
    const j = await r.json();
    if (!j.ok) throw new Error(j.error || "request failed");
    return j;
  }
  const errText = m => ({
    "wrong-password": "Wrong password.",
    "locked": "Too many wrong tries. Locked for 15 minutes.",
    "admin-not-configured": "Set ADMIN_PASSWORD in the Google script first (see backend/SETUP.md).",
    "missing fields": "Your Google script is still the OLD version. Paste the new Code.gs into Apps Script, then Deploy > Manage deployments > pencil > New version > Deploy."
  }[m] || m);

  function toast(t) { const el = $("#toast"); el.textContent = t; el.classList.add("show"); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove("show"), 2200); }

  /* ---------- login / logout ---------- */
  async function load(quiet) {
    if (!quiet) $("#state").textContent = "Loading…";
    try {
      const j = await api("list");
      rows = j.rows;
      $("#login").hidden = true; $("#app").hidden = false;
      render();
      return true;
    } catch (e) {
      if (/password|locked|configured/.test(e.message)) { pw = ""; try { sessionStorage.removeItem("adm"); } catch (_) {} $("#login").hidden = false; $("#app").hidden = true; $("#lerr").textContent = errText(e.message); }
      else if (!$("#login").hidden) { $("#lerr").textContent = "Couldn't sign in: " + errText(e.message); }
      else { $("#state").textContent = "Couldn't load: " + errText(e.message); }
      return false;
    }
  }
  $("#lf").addEventListener("submit", async e => {
    e.preventDefault();
    const btn = $("button", e.target); btn.disabled = true; btn.textContent = "Checking…"; $("#lerr").textContent = "";
    pw = $("#pw").value;
    try { sessionStorage.setItem("adm", pw); } catch (_) {}
    await load();
    btn.disabled = false; btn.textContent = "Sign in"; $("#pw").value = "";
  });
  $("#logout").onclick = () => { pw = ""; rows = []; try { sessionStorage.removeItem("adm"); } catch (_) {} $("#app").hidden = true; $("#login").hidden = false; };
  $("#refresh").onclick = async () => { if (await load(true)) toast("Updated"); };
  $("#q").addEventListener("input", e => { query = e.target.value.toLowerCase(); renderList(); });

  /* ---------- contact helpers ---------- */
  function contactLinks(r) {
    const c = String(r.contact || "").trim(), out = [];
    const hi = `Hi ${r.name}, thanks for your request for ${r.service}${r.pkg && r.pkg !== "Not sure yet" ? " (" + r.pkg + ")" : ""}! `;
    const digits = c.replace(/[^\d]/g, "");
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c)) out.push([`✉️ Email`, `mailto:${c}?subject=${encodeURIComponent("Your request: " + r.service)}&body=${encodeURIComponent(hi)}`]);
    else if (/^\+?[\d\s()-]{7,}$/.test(c)) out.push([`💬 WhatsApp`, `https://wa.me/${digits}?text=${encodeURIComponent(hi)}`]);
    else if (/^@?[\w.]{2,30}$/.test(c)) out.push([`📸 Instagram`, `https://ig.me/m/${c.replace(/^@/, "")}`]);
    return out;
  }

  /* ---------- render ---------- */
  function fmtDate(iso) {
    const d = new Date(iso); if (isNaN(d)) return String(iso);
    const mins = (Date.now() - d) / 60000;
    if (mins < 60) return Math.max(1, Math.round(mins)) + "m ago";
    if (mins < 1440) return Math.round(mins / 60) + "h ago";
    return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
  }
  function render() { renderStats(); renderChips(); renderList(); }

  function renderStats() {
    const count = s => rows.filter(r => r.status === s).length;
    const earned = rows.filter(r => EARNED.includes(r.status)).reduce((t, r) => t + (parseFloat(r.amount) || 0), 0);
    $("#stats").innerHTML = `
      <div class="stat"><b>${rows.length}</b><span>Total requests</span></div>
      <div class="stat"><b>${count("New")}</b><span>New (need reply)</span></div>
      <div class="stat"><b>${count("Quoted")}</b><span>Quoted</span></div>
      <div class="stat"><b>${count("In progress")}</b><span>In progress</span></div>
      <div class="stat money"><b>${earned.toLocaleString(undefined, { maximumFractionDigits: 0 })}</b><span>Paid / earned</span></div>`;
    const n = count("New"), b = $("#newBadge"); b.hidden = !n; b.textContent = n + " new";
    document.title = (n ? `(${n}) ` : "") + "Admin — " + SITE.brand;
  }

  function renderChips() {
    $("#chips").innerHTML = ["All", ...STATUSES].map(s => {
      const n = s === "All" ? rows.length : rows.filter(r => r.status === s).length;
      return `<button class="chip ${filter === s ? "on" : ""}" data-f="${esc(s)}">${esc(s)} ${n}</button>`;
    }).join("");
    document.querySelectorAll(".chip").forEach(c => c.onclick = () => { filter = c.dataset.f; renderChips(); renderList(); });
  }

  function renderList() {
    const list = rows.filter(r => (filter === "All" || r.status === filter) &&
      (!query || [r.name, r.contact, r.msg, r.service, r.notes].join(" ").toLowerCase().includes(query)));
    $("#state").textContent = list.length ? "" : (rows.length ? "No requests match." : "No requests yet. Share your link!");
    $("#list").innerHTML = list.map(r => `
      <article class="req ${slug(r.status)} ${openId === r.id ? "open" : ""}" data-id="${esc(r.id)}">
        <button class="head" aria-expanded="${openId === r.id}">
          <span><span class="who">${esc(r.name)}</span><br><span class="meta">${esc(r.service)}${r.pkg && r.pkg !== "Not sure yet" ? " · " + esc(r.pkg) : ""} · ${esc(fmtDate(r.date))}</span></span>
          <span class="pill">${esc(r.status)}</span>
        </button>
        <div class="body">
          <div class="msg">${esc(r.msg)}</div>
          <p class="muted">Contact: <span class="contact">${esc(r.contact)}</span></p>
          <div class="kv" style="margin-top:12px">
            <label>Status<select data-k="status">${STATUSES.map(s => `<option ${s === r.status ? "selected" : ""}>${esc(s)}</option>`).join("")}</select></label>
            <label>Amount (price agreed)<input data-k="amount" type="number" inputmode="decimal" min="0" step="any" value="${esc(r.amount)}" placeholder="0"></label>
          </div>
          <label>Notes (private)<textarea data-k="notes" rows="2" placeholder="Quote sent, waiting on assets…">${esc(r.notes)}</textarea></label>
          <div class="row">
            <button class="btn primary sm" data-act="save">Save</button>
            ${contactLinks(r).map(([t, h]) => `<a class="btn ghost sm" href="${esc(h)}" target="_blank" rel="noopener">${t}</a>`).join("")}
            <button class="btn danger sm" data-act="del">Delete</button>
          </div>
        </div>
      </article>`).join("");
  }

  /* ---------- list interactions (event delegation) ---------- */
  $("#list").addEventListener("click", async e => {
    const card = e.target.closest(".req"); if (!card) return;
    const id = card.dataset.id, r = rows.find(x => x.id === id);
    if (e.target.closest(".head")) { openId = openId === id ? null : id; renderList(); return; }
    const act = e.target.closest("[data-act]")?.dataset.act;
    if (act === "save") {
      const btn = e.target.closest("button"); btn.disabled = true; btn.textContent = "Saving…";
      const payload = { id, status: $('[data-k="status"]', card).value, amount: $('[data-k="amount"]', card).value, notes: $('[data-k="notes"]', card).value };
      try { await api("update", payload); Object.assign(r, payload); toast("Saved ✓"); render(); }
      catch (err) { toast("Couldn't save: " + errText(err.message)); btn.disabled = false; btn.textContent = "Save"; }
    }
    if (act === "del") {
      if (!confirm(`Permanently delete the request from ${r.name}? This can't be undone.`)) return;
      try { await api("delete", { id }); rows = rows.filter(x => x.id !== id); openId = null; toast("Deleted"); render(); }
      catch (err) { toast("Couldn't delete: " + errText(err.message)); }
    }
  });

  /* ---------- start ---------- */
  if (pw) load(); else $("#pw").focus();
  setInterval(() => { if (!$("#app").hidden && !document.hidden && openId === null) load(true); }, 60000);   // auto-refresh while no request is open
})();
