// gallery.js — каталог: фильтры, поиск, модалка
import { loadWorks, escapeHtml, tgWriteUrl, initReveal } from "./app.js";

const state = {
  works: [],
  filterType: "all",
  filterArtist: "all",
  query: "",
};

const TYPE_LABELS = {
  all: "Все",
  "живопись": "Живопись",
  "графика": "Графика",
  "постер": "Постеры",
  "постеры": "Постеры",
  "скульптура": "Скульптура",
};

function normalizeType(t) {
  if (!t) return "";
  const x = t.toLowerCase().trim();
  if (x === "постер") return "постеры";
  return x;
}

/* ---------------- Filters ---------------- */

function renderFilters() {
  const typesNode = document.getElementById("filter-types");
  const artistsNode = document.getElementById("filter-artists");
  if (!typesNode || !artistsNode) return;

  const allTypes = Array.from(new Set(state.works.map((w) => normalizeType(w.type)).filter(Boolean)));
  allTypes.sort();
  const types = ["all", ...allTypes];

  const allArtists = Array.from(new Set(state.works.map((w) => w.artist).filter(Boolean))).sort();
  const artists = ["all", ...allArtists];

  typesNode.innerHTML = types.map((t) => {
    const label = t === "all" ? "Все" : (TYPE_LABELS[t] || (t[0].toUpperCase() + t.slice(1)));
    const active = t === state.filterType ? "is-active" : "";
    return `<a class="filter-link ${active}" data-type="${escapeHtml(t)}" href="#type=${encodeURIComponent(t)}">${escapeHtml(label)}</a>`;
  }).join("");

  artistsNode.innerHTML = artists.map((a) => {
    const label = a === "all" ? "Все" : a;
    const active = a === state.filterArtist ? "is-active" : "";
    return `<a class="filter-link ${active}" data-artist="${escapeHtml(a)}" href="#artist=${encodeURIComponent(a)}">${escapeHtml(label)}</a>`;
  }).join("");

  typesNode.querySelectorAll("[data-type]").forEach((el) => {
    el.addEventListener("click", (ev) => {
      ev.preventDefault();
      state.filterType = el.dataset.type;
      renderFilters();
      renderGrid();
    });
  });

  artistsNode.querySelectorAll("[data-artist]").forEach((el) => {
    el.addEventListener("click", (ev) => {
      ev.preventDefault();
      state.filterArtist = el.dataset.artist;
      renderFilters();
      renderGrid();
    });
  });
}

/* ---------------- Grid ---------------- */

function matches(w) {
  if (state.filterType !== "all" && normalizeType(w.type) !== state.filterType) return false;
  if (state.filterArtist !== "all" && w.artist !== state.filterArtist) return false;
  if (state.query) {
    const haystack = `${w.title} ${w.artist} ${w.genre} ${w.material} ${w.type}`.toLowerCase();
    if (!haystack.includes(state.query.toLowerCase())) return false;
  }
  return true;
}

function renderGrid() {
  const grid = document.getElementById("works-grid");
  if (!grid) return;

  const filtered = state.works
    .filter(matches)
    .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));

  if (!filtered.length) {
    grid.innerHTML = `<div class="empty-state">По выбранным фильтрам ничего не найдено.</div>`;
    return;
  }

  grid.innerHTML = filtered.map((w, i) => `
    <article class="work-card reveal" tabindex="0" data-id="${escapeHtml(w.id)}" style="transition-delay: ${Math.min(i * 60, 480)}ms">
      <div class="work-thumb">
        <img src="${escapeHtml(w.image)}" alt="${escapeHtml(w.title)}" loading="lazy">
      </div>
      <p class="work-title">${escapeHtml(w.title)}</p>
      <p class="work-meta">
        ${escapeHtml(w.artist || "—")}${w.size ? " · " + escapeHtml(w.size) : ""}${w.year ? " · " + escapeHtml(String(w.year)) : ""}
      </p>
    </article>
  `).join("");

  // запустим reveal для свежих карточек
  requestAnimationFrame(() => initReveal(grid));

  grid.querySelectorAll(".work-card").forEach((card) => {
    const id = card.dataset.id;
    const work = state.works.find((w) => w.id === id);
    if (!work) return;
    const open = () => openModal(work);
    card.addEventListener("click", open);
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        open();
      }
    });
  });
}

/* ---------------- Modal ---------------- */

function openModal(w) {
  const modal = document.getElementById("modal");
  if (!modal) return;

  const fields = [
    ["Художник", w.artist],
    ["Год", w.year],
    ["Тип", w.type ? (TYPE_LABELS[normalizeType(w.type)] || w.type) : null],
    ["Жанр", w.genre],
    ["Материал", w.material],
    ["Техника", w.technique],
    ["Размер", w.size],
  ].filter(([, v]) => v);

  const tableHtml = fields.map(([k, v]) => `
    <dt>${escapeHtml(k)}</dt>
    <dd>${escapeHtml(String(v))}</dd>
  `).join("");

  const tgText = `Здравствуйте! Интересует работа: «${w.title}»${w.artist ? " (" + w.artist + ")" : ""}.`;
  const tgHref = tgWriteUrl(tgText);

  modal.innerHTML = `
    <div class="modal-controls">
      <button class="modal-btn" id="modal-zoom" aria-label="Открыть на весь экран">Развернуть ⤢</button>
      <button class="modal-btn" id="modal-close" aria-label="Закрыть">Закрыть ✕</button>
    </div>
    <div class="modal-inner">
      <div class="modal-image-wrap" id="modal-image-wrap">
        <img src="${escapeHtml(w.image)}" alt="${escapeHtml(w.title)}">
      </div>
      <div class="modal-side">
        <p class="modal-eyebrow">${escapeHtml(w.artist || "")}</p>
        <h2 class="modal-title">${escapeHtml(w.title)}</h2>
        ${w.year ? `<p class="modal-artist">${escapeHtml(String(w.year))}</p>` : ""}
        <div class="modal-divider"></div>
        <dl class="modal-table">${tableHtml}</dl>
        ${w.description ? `<p class="modal-description">${escapeHtml(w.description)}</p>` : ""}
        <p class="modal-price">${escapeHtml(w.price_label || "По запросу")}</p>
        <div class="modal-actions">
          <a class="btn-line" href="${escapeHtml(tgHref)}" target="_blank" rel="noopener">Написать в Telegram</a>
        </div>
      </div>
    </div>
  `;

  modal.classList.add("is-open");
  modal.classList.remove("is-zoomed");
  document.body.classList.add("no-scroll");

  const closeBtn = modal.querySelector("#modal-close");
  const zoomBtn = modal.querySelector("#modal-zoom");
  const imgWrap = modal.querySelector("#modal-image-wrap");

  closeBtn.addEventListener("click", closeModal);

  const toggleZoom = () => {
    const isZoomed = modal.classList.toggle("is-zoomed");
    zoomBtn.textContent = isZoomed ? "Свернуть ⤡" : "Развернуть ⤢";
  };
  zoomBtn.addEventListener("click", toggleZoom);
  imgWrap.addEventListener("click", toggleZoom);

  modal.addEventListener("click", (e) => {
    // клик по «оболочке» (но не по картинке/тексту) тоже закроет
    if (e.target === modal) closeModal();
  });
  document.addEventListener("keydown", onModalKeydown);

  // фокус для скрин-ридеров и клавиатуры
  setTimeout(() => closeBtn.focus(), 50);

  // обновим хеш чтобы можно было поделиться
  history.replaceState(null, "", `#work=${encodeURIComponent(w.id)}`);
}

function closeModal() {
  const modal = document.getElementById("modal");
  if (!modal) return;
  modal.classList.remove("is-open");
  document.body.classList.remove("no-scroll");
  document.removeEventListener("keydown", onModalKeydown);
  if (location.hash.startsWith("#work=")) {
    history.replaceState(null, "", location.pathname + location.search);
  }
}

function onModalKeydown(e) {
  if (e.key !== "Escape") return;
  const modal = document.getElementById("modal");
  if (modal && modal.classList.contains("is-zoomed")) {
    // выйти из полноэкранного режима, не закрывая модалку
    modal.classList.remove("is-zoomed");
    const zoomBtn = modal.querySelector("#modal-zoom");
    if (zoomBtn) zoomBtn.textContent = "Развернуть ⤢";
    return;
  }
  closeModal();
}

/* ---------------- Init ---------------- */

function applyUrlState() {
  // ?artist=Иванов
  const params = new URLSearchParams(location.search);
  const artist = params.get("artist");
  if (artist) state.filterArtist = artist;

  // #type=живопись
  const hash = location.hash.replace(/^#/, "");
  const m = hash.match(/^type=([^&]+)/);
  if (m) state.filterType = decodeURIComponent(m[1]);
}

function maybeOpenFromHash() {
  const m = location.hash.match(/^#work=(.+)$/);
  if (!m) return;
  const id = decodeURIComponent(m[1]);
  const work = state.works.find((w) => w.id === id);
  if (work) openModal(work);
}

(async function init() {
  try {
    state.works = await loadWorks();
  } catch (err) {
    console.error(err);
    const grid = document.getElementById("works-grid");
    if (grid) {
      grid.innerHTML = `<div class="empty-state">Не удалось загрузить каталог. Попробуйте перезагрузить страницу.</div>`;
    }
    return;
  }
  applyUrlState();
  renderFilters();
  renderGrid();

  const search = document.getElementById("search-input");
  if (search) {
    search.addEventListener("input", (e) => {
      state.query = e.target.value || "";
      renderGrid();
    });
  }

  maybeOpenFromHash();
})();
