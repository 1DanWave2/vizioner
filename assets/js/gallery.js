// assets/js/gallery.js
// ES module. Предполагает, что app.js экспортирует:
// { $, $all, escapeHtml, setActiveNav, initParallax, loadWorks, formatPrice, tgLink }

import { $, $all, escapeHtml, setActiveNav, initParallax, loadWorks, formatPrice, tgLink } from "./app.js";
import { applySiteConfig } from "./site.config.js";

applySiteConfig();
setActiveNav();
initParallax();

// --- DOM refs ---
const grid = $("#grid");
const toolbar = document.querySelector(".toolbar");
const searchInput = $("#searchInput");

const modal = $("#modal");
const modalImg = $("#modalImg");
const modalTitle = $("#modalTitle");
const modalSub = $("#modalSub");
const modalDesc = $("#modalDesc");
const modalPrice = $("#modalPrice");
const closeModal = $("#closeModal");
const copyTitleBtn = $("#copyTitle");
const tgBtn = $("#tgBtn");

const kvMaterial = document.getElementById("kvMaterial");
const kvTechnique = document.getElementById("kvTechnique");

let works = [];
let filterType = "all";
let filterArtist = "all";
let q = "";

// --- Utility: robust copy with fallback ---
async function copyText(text, btn = null) {
  if (!text) return;
  // try modern API
  try {
    await navigator.clipboard.writeText(text);
    if (btn) showCopied(btn);
    return;
  } catch (e) {
    // fallthrough
  }

  // fallback (older browsers / Safari)
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.left = "-9999px";
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand("copy");
    if (btn) showCopied(btn);
  } catch (err) {
    alert("Не удалось скопировать в буфер обмена");
  }
  document.body.removeChild(ta);
}

function showCopied(btn) {
  const old = btn.textContent;
  btn.textContent = "Скопировано ✓";
  btn.disabled = true;
  setTimeout(() => {
    btn.textContent = old;
    btn.disabled = false;
  }, 1200);
}

// --- Render dynamic filter chips for types and artists ---
function renderChips(types = [], artists = []) {
  if (!toolbar) return;

  // remove previously created dynamic chips
  toolbar.querySelectorAll(".chip.dynamic").forEach(n => n.remove());

  // Add type chips (if more than 'all')
  types.forEach(t => {
    const tt = (t || "").toString();
    if (!tt || tt.toLowerCase() === "all") return;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "chip dynamic";
    btn.dataset.filterType = tt.toLowerCase();
    btn.textContent = tt[0].toUpperCase() + tt.slice(1);
    toolbar.insertBefore(btn, toolbar.querySelector(".search"));
    btn.addEventListener("click", () => {
      // clear active on other chips
      toolbar.querySelectorAll(".chip").forEach(c => c.classList.remove("active"));
      btn.classList.add("active");
      filterType = tt.toLowerCase();
      render();
    });
  });

  // Add artist chips
  if (artists && artists.length) {
    // small separator
    const sep = document.createElement("div");
    sep.style.width = "8px";
    sep.className = "chip-sep dynamic";
    toolbar.insertBefore(sep, toolbar.querySelector(".search"));
    artists.forEach(a => {
      if (!a) return;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "chip dynamic artist-chip";
      btn.dataset.filterArtist = a.toLowerCase();
      btn.textContent = a;
      toolbar.insertBefore(btn, toolbar.querySelector(".search"));
      btn.addEventListener("click", () => {
        toolbar.querySelectorAll(".chip").forEach(c => c.classList.remove("active"));
        btn.classList.add("active");
        filterArtist = a.toLowerCase();
        render();
      });
    });
  }
}

// --- Matching/filter logic ---
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

// --- Render grid ---
function render() {
  if (!grid) return;
  grid.innerHTML = "";

  const filtered = works.filter(matches);
  if (!filtered.length) {
    grid.innerHTML = `
      <div class="panel" style="grid-column:1/-1">
        <div class="smallcaps">ничего не найдено</div>
        <div style="margin-top:6px; color:var(--muted)">Попробуйте другой фильтр или запрос.</div>
      </div>`;
    return;
  }

  filtered.forEach(w => {
    const article = document.createElement("article");
    article.className = "work";
    article.tabIndex = 0;

    const badge = w.type ? `<div class="badge">${escapeHtml(w.type)}</div>` : "";

    article.innerHTML = `
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

    article.addEventListener("click", () => openWork(w));
    article.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openWork(w);
      }
    });

    grid.appendChild(article);
  });
}

// --- Open modal for a work ---
function openWork(w) {
  if (!modal) return;
  modalImg.src = w.image || "";
  modalImg.alt = w.title || "";

  modalTitle.textContent = w.title || "";
  modalSub.textContent = [w.author, w.year, w.type, w.style, w.genre, w.size].filter(Boolean).join(" · ");
  modalDesc.textContent = w.description || "";
  modalPrice.textContent = formatPrice(w.price);

  if (kvMaterial) kvMaterial.textContent = w.material || "—";
  if (kvTechnique) kvTechnique.textContent = w.technique || "—";

  // Telegram button uses site dataset or site config
  const baseTg = document.documentElement.dataset.telegram || "https://t.me/USERNAME_OR_CHANNEL";
  const text = `Здравствуйте! Интересует работа: ${w.title || ""}${w.author ? " (" + w.author + ")" : ""}.`;
  if (tgBtn) tgBtn.href = tgLink(baseTg, text);

  // attach copy handler (fresh function capture)
  if (copyTitleBtn) {
    // remove previous listener by clone technique
    const newBtn = copyTitleBtn.cloneNode(true);
    copyTitleBtn.parentNode.replaceChild(newBtn, copyTitleBtn);
    newBtn.addEventListener("click", () => copyText(w.title || "", newBtn));
  }

  // show modal
  modal.classList.add("open");
  // focus for accessibility
  setTimeout(() => {
    const close = $("#closeModal");
    if (close) close.focus();
  }, 200);
}

// --- Close modal ---
function close() {
  if (!modal) return;
  modal.classList.remove("open");
}

if (modal) {
  modal.addEventListener("click", (e) => {
    if (e.target === modal) close();
  });
}
if (closeModal) closeModal.addEventListener("click", close);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && modal && modal.classList.contains("open")) close();
});

// --- Filters & search wiring ---
if (searchInput) {
  searchInput.addEventListener("input", (e) => {
    q = (e.target.value || "").trim();
    render();
  });
}

// initial 'All' chip behavior (if present in markup)
const initialChips = document.querySelectorAll(".chip");
initialChips.forEach(chip => {
  chip.addEventListener("click", (ev) => {
    initialChips.forEach(c => c.classList.remove("active"));
    chip.classList.add("active");
    const ft = chip.dataset.filter;
    if (ft) {
      filterType = ft.toLowerCase();
      render();
    }
  });
});

// --- Load works & initialize dynamic chips ---
(async function init() {
  try {
    const data = await loadWorks();
    // normalize: ensure array
    works = Array.isArray(data) ? data : (data.works || []);
    // compute unique types and artists
    const typesSet = new Set();
    const artistsSet = new Set();
    works.forEach(w => {
      if (w.type) typesSet.add((w.type || "").toString());
      const artist = (w.artist || w.author || "").toString();
      if (artist) artistsSet.add(artist);
    });

    // prepare arrays with 'all' first
    const types = ["all", ...Array.from(typesSet)];
    const artists = ["all", ...Array.from(artistsSet)];

    // render chips for types and artists (artist chips will be added after existing 'Все' chip)
    renderChips(types, Array.from(artistsSet));

    // render initial grid
    render();

  } catch (err) {
    console.error(err);
    if (grid) grid.innerHTML = `<div class="panel" style="grid-column:1/-1">
      <div class="smallcaps">ошибка загрузки</div>
      <div style="margin-top:6px; color:var(--muted)">Проверьте, что файл <b>data/works.json</b> существует и сайт открыт через сервер/хостинг (а не двойным кликом).</div>
    </div>`;
  }
})();
