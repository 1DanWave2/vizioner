// home.js — наполняет главную страницу: превью featured-работ + список художников
import { loadWorks, escapeHtml, initReveal } from "./app.js";

async function loadArtists() {
  try {
    const res = await fetch("data/artists.json", { cache: "no-store" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    return await res.json();
  } catch {
    return [];
  }
}

function renderFeatured(works) {
  const grid = document.getElementById("featured-grid");
  if (!grid) return;

  const featured = works.filter((w) => w.featured).slice(0, 6);
  const list = featured.length ? featured : works.slice(0, 6);

  grid.innerHTML = list.map((w, i) => `
    <a class="work-card reveal" href="gallery.html#work=${encodeURIComponent(w.id)}" style="transition-delay: ${Math.min(i * 80, 600)}ms">
      <div class="work-thumb">
        <img src="${escapeHtml(w.image)}" alt="${escapeHtml(w.title)}" loading="lazy" />
      </div>
      <p class="work-title">${escapeHtml(w.title)}</p>
      <p class="work-meta">${escapeHtml(w.artist)}${w.year ? " · " + escapeHtml(String(w.year)) : ""}</p>
    </a>
  `).join("");
}

function renderArtists(artists, works) {
  const row = document.getElementById("artists-row");
  if (!row) return;

  // если artists.json пустой — fallback на уникальных авторов из works
  const list = artists.length
    ? artists
    : Array.from(new Set(works.map((w) => w.artist).filter(Boolean))).map((name) => ({
        name,
        slug: name.toLowerCase(),
        bio_short: "",
      }));

  row.innerHTML = list.map((artist) => `
    <article class="artist-card">
      <h3 class="artist-name">${escapeHtml(artist.name)}</h3>
      ${artist.bio_short ? `<p class="artist-bio">${escapeHtml(artist.bio_short)}</p>` : ""}
      <a class="text-link" href="artists.html#${escapeHtml(artist.slug)}">Подробнее →</a>
    </article>
  `).join("");
}

(async function init() {
  try {
    const [works, artists] = await Promise.all([loadWorks(), loadArtists()]);
    renderFeatured(works);
    renderArtists(artists, works);
    requestAnimationFrame(() => initReveal());
  } catch (err) {
    console.error(err);
  }
})();
