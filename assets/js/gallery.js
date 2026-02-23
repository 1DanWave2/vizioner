// assets/js/gallery.js
// Самодостаточный (non-module) скрипт для gallery.html
// Требует в html: элементы с id/grid, id/searchInput, modal и дочерние элементы:
// #modal #modalImg #modalTitle #modalSub #modalDesc #modalPrice #closeModal #copyTitle #tgBtn
// и контейнер .toolbar (где будут чипы) и .search (в ней input#searchInput)

(function () {
  "use strict";

  /* ---------- DOM refs ---------- */
  const grid = document.getElementById("grid");
  const toolbar = document.querySelector(".toolbar");
  const searchInput = document.getElementById("searchInput");

  const modal = document.getElementById("modal");
  const modalImg = document.getElementById("modalImg");
  const modalTitle = document.getElementById("modalTitle");
  const modalSub = document.getElementById("modalSub");
  const modalDesc = document.getElementById("modalDesc");
  const modalPrice = document.getElementById("modalPrice");
  const closeModal = document.getElementById("closeModal");
  const copyTitleBtnInitial = document.getElementById("copyTitle");
  const tgBtn = document.getElementById("tgBtn");

  const kvMaterial = document.getElementById("kvMaterial");
  const kvTechnique = document.getElementById("kvTechnique");

  let works = [];
  let filterType = "all";
  let filterArtist = "all";
  let q = "";

  /* ---------- Helpers ---------- */
  function escapeHtml(str) {
    return String(str || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatPrice(p) {
    if (!p) return "Цена: по запросу";
    return p;
  }

  function tgLink(base, text) {
    try {
      const url = new URL(base);
      if (text) url.searchParams.set("text", text);
      return url.toString();
    } catch (e) {
      // fallback: append as query param
      return base + (base.includes("?") ? "&" : "?") + "text=" + encodeURIComponent(text || "");
    }
  }

  // Robust copy with fallback
  async function copyText(text, btn = null) {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      showCopied(btn);
      return;
    } catch (e) {
      // fallback
    }
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
      showCopied(btn);
    } catch (err) {
      alert("Не удалось скопировать");
    }
    document.body.removeChild(ta);
  }

  function showCopied(btn) {
    if (!btn) return;
    const old = btn.textContent;
    btn.textContent = "Скопировано ✓";
    btn.disabled = true;
    setTimeout(() => {
      btn.textContent = old;
      btn.disabled = false;
    }, 1200);
  }

  /* ---------- Rendering filters (types + artists) ---------- */
  function clearDynamicChips() {
    toolbar && toolbar.querySelectorAll(".chip.dynamic").forEach(n => n.remove());
  }

  function renderChips(types = [], artists = []) {
    if (!toolbar) return;
    // remove existing dynamic chips
    clearDynamicChips();

    // Insert type chips before .search
    const searchNode = toolbar.querySelector(".search");
    types.forEach(t => {
      if (!t || t.toLowerCase() === "all") return;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "chip dynamic";
      btn.dataset.filter = t.toLowerCase();
      btn.textContent = t[0].toUpperCase() + t.slice(1);
      toolbar.insertBefore(btn, searchNode);
      btn.addEventListener("click", () => {
        // deactivate others
        toolbar.querySelectorAll(".chip").forEach(c => c.classList.remove("active"));
        btn.classList.add("active");
        filterType = t.toLowerCase();
        render();
      });
    });

    // artist chips
    if (artists && artists.length) {
      // small separator element (visual)
      const sep = document.createElement("div");
      sep.className = "chip dynamic sep";
      sep.style.width = "8px";
      toolbar.insertBefore(sep, searchNode);

      artists.forEach(a => {
        if (!a) return;
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "chip dynamic artist-chip";
        btn.dataset.artist = a.toLowerCase();
        btn.textContent = a;
        toolbar.insertBefore(btn, searchNode);
        btn.addEventListener("click", () => {
          toolbar.querySelectorAll(".chip").forEach(c => c.classList.remove("active"));
          btn.classList.add("active");
          filterArtist = a.toLowerCase();
          render();
        });
      });
    }
  }

  /* ---------- Matching & render grid ---------- */
  function matches(w) {
    if (!w) return false;
    if (filterType && filterType !== "all") {
      const wt = (w.type || "").toLowerCase();
      if (wt !== filterType) return false;
    }
    if (filterArtist && filterArtist !== "all") {
      const wa = (w.artist || w.author || "").toLowerCase();
      if (wa !== filterArtist) return false;
    }
    if (!q) return true;
    const txt = `${w.title || ""} ${w.author || ""} ${w.style || ""} ${w.genre || ""} ${w.type || ""} ${w.artist || ""}`.toLowerCase();
    return txt.includes(q.toLowerCase());
  }

  function render() {
    if (!grid) return;
    grid.innerHTML = "";
    const filtered = works.filter(matches);
    if (!filtered.length) {
      grid.innerHTML = `<div class="panel" style="grid-column:1/-1">
          <div class="smallcaps">ничего не найдено</div>
          <div style="margin-top:6px; color:var(--muted)">Попробуйте другой фильтр или запрос.</div>
        </div>`;
      return;
    }

    filtered.forEach(w => {
      const card = document.createElement("article");
      card.className = "work";
      card.tabIndex = 0;
      const badge = w.type ? `<div class="badge">${escapeHtml(w.type)}</div>` : "";
      card.innerHTML = `
        <div class="thumb">
          <img src="${escapeHtml(w.image || "")}" alt="${escapeHtml(w.title || '')}" loading="lazy" />
          <div class="frame" aria-hidden="true"></div>
          ${badge}
        </div>
        <div class="meta">
          <p class="title">${escapeHtml(w.title)}</p>
          <p class="sub">${escapeHtml(w.author || "—")} · ${escapeHtml(w.size || "")}${w.year ? " · " + escapeHtml(w.year) : ""}</p>
        </div>
      `;
      card.addEventListener("click", () => openWork(w));
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openWork(w);
        }
      });
      grid.appendChild(card);
    });
  }

  /* ---------- Modal handling ---------- */
  function openWork(w) {
    if (!modal) return;
    modalImg.src = w.image || "";
    modalImg.alt = w.title || "";

    modalTitle.textContent = w.title || "";
    modalSub.textContent = [w.author, w.year, w.type, w.style, w.genre, w.size].filter(Boolean).join(" · ");
    modalDesc.textContent = w.description || "";
    modalPrice.textContent = formatPrice(w.price || w.prices || "");

    if (kvMaterial) kvMaterial.textContent = w.material || "—";
    if (kvTechnique) kvTechnique.textContent = w.technique || "—";

    const baseTg = document.documentElement.dataset.telegram || "https://t.me/USERNAME_OR_CHANNEL";
    const text = `Здравствуйте! Интересует работа: ${w.title || ""}${w.author ? " (" + w.author + ")" : ""}.`;
    if (tgBtn) tgBtn.href = tgLink(baseTg, text);

    // replace copy button listener safely
    if (copyTitleBtnInitial && copyTitleBtnInitial.parentNode) {
      const newBtn = copyTitleBtnInitial.cloneNode(true);
      copyTitleBtnInitial.parentNode.replaceChild(newBtn, copyTitleBtnInitial);
      newBtn.addEventListener("click", () => copyText(w.title || "", newBtn));
    }

    modal.classList.add("open");
    setTimeout(() => {
      const cl = document.getElementById("closeModal");
      if (cl) cl.focus();
    }, 150);
  }

  function closeModalFn() {
    if (!modal) return;
    modal.classList.remove("open");
  }

  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeModalFn();
    });
  }
  if (closeModal) closeModal.addEventListener("click", closeModalFn);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal && modal.classList.contains("open")) closeModalFn();
  });

  /* ---------- Load data (works.json) ---------- */
  async function loadWorksJson() {
    try {
      const res = await fetch("data/works.json", { cache: "no-store" });
      if (!res.ok) throw new Error("Не удалось загрузить data/works.json: " + res.status);
      const data = await res.json();
      return Array.isArray(data) ? data : (data.works || []);
    } catch (err) {
      console.error(err);
      return [];
    }
  }

  /* ---------- Init ---------- */
  (async function init() {
    // load works
    works = await loadWorksJson();

    // prepare types and artists
    const typesSet = new Set();
    const artistsSet = new Set();
    works.forEach(w => {
      if (w.type) typesSet.add(String(w.type));
      const artist = String(w.artist || w.author || "").trim();
      if (artist) artistsSet.add(artist);
    });

    // create arrays
    const types = ["all", ...Array.from(typesSet)];
    const artists = ["all", ...Array.from(artistsSet)];

    // render dynamic chips
    renderChips(types, Array.from(artistsSet));

    // wire search
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        q = (e.target.value || "").trim();
        render();
      });
    }

    // initial render
    render();
  })();

})();
