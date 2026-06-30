// artists.js — страница со списком художников + их работы
import { loadWorks, escapeHtml, initReveal } from "./app.js";

async function loadArtists() {
  const res = await fetch("data/artists.json", { cache: "no-store" });
  if (!res.ok) throw new Error("Не удалось загрузить data/artists.json");
  return res.json();
}

function render(artists, works) {
  const mount = document.getElementById("artists-list");
  if (!mount) return;

  mount.innerHTML = artists.map((artist, idx) => {
    const items = works
      .filter((w) => (w.artist || "").toLowerCase() === artist.name.toLowerCase())
      .slice(0, 4);

    const itemsHtml = items.length ? items.map((w) => `
      <a class="artist-work" href="gallery.html#work=${encodeURIComponent(w.id)}">
        <div class="artist-work-thumb">
          <img src="${escapeHtml(w.image)}" alt="${escapeHtml(w.title)}" loading="lazy">
        </div>
        <p class="artist-work-title">${escapeHtml(w.title)}</p>
        <p class="artist-work-meta">${w.year ? escapeHtml(String(w.year)) + " · " : ""}${escapeHtml(w.size || "")}</p>
      </a>
    `).join("") : `<p class="muted">Работы скоро будут добавлены.</p>`;

    const galleryLink = encodeURIComponent(artist.name);

    return `
      <article class="artist-block reveal" id="${escapeHtml(artist.slug)}">
        <header class="artist-header">
          <div>
            <p class="eyebrow">${idx + 1 < 10 ? "0" + (idx + 1) : idx + 1}</p>
            <h2 class="h2 mt-3">${escapeHtml(artist.name)}</h2>
            <p class="lead mt-4">${escapeHtml(artist.tagline)}</p>
          </div>
          <div class="artist-bio">
            <p class="body-text">${escapeHtml(artist.bio_full)}</p>
            ${artist.themes && artist.themes.length ? `
              <p class="eyebrow mt-5">Темы</p>
              <p class="body-text">${artist.themes.map(escapeHtml).join(" · ")}</p>
            ` : ""}
          </div>
        </header>

        <div class="artist-works">
          ${itemsHtml}
        </div>

        <div class="artist-cta">
          <a class="text-link" href="gallery.html?artist=${galleryLink}">Все работы автора →</a>
        </div>
      </article>
    `;
  }).join("");

  requestAnimationFrame(() => initReveal(mount));
}

function scrollToHashTarget() {
  const hash = location.hash.replace(/^#/, "");
  if (!hash) return;
  const el = document.getElementById(hash);
  if (!el) return;
  // ждём кадр чтобы reveal-анимация запустилась, потом скроллим
  requestAnimationFrame(() => {
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

(async function init() {
  try {
    const [artists, works] = await Promise.all([loadArtists(), loadWorks()]);
    render(artists, works);
    scrollToHashTarget();
  } catch (err) {
    console.error(err);
    const mount = document.getElementById("artists-list");
    if (mount) mount.innerHTML = `<div class="empty-state">Не удалось загрузить художников.</div>`;
  }
})();
