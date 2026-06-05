// app.js — общие утилиты: header/footer, навигация, загрузка works.json
import { SITE } from "./site.config.js";

export function $(sel, root = document) { return root.querySelector(sel); }
export function $all(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }

export function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* ---------- Header ---------- */

const BRAND_MARK_SVG = `
  <svg class="brand-mark" viewBox="0 0 200 200" fill="none" stroke="currentColor"
       stroke-linejoin="miter" stroke-linecap="square" aria-hidden="true">
    <polygon points="100,28 180,172 20,172" stroke-width="14"/>
    <line x1="48" y1="138" x2="152" y2="138" stroke-width="11"/>
    <path d="M 60 112 Q 100 76 140 112" stroke-width="11"/>
    <path d="M 60 112 Q 100 148 140 112" stroke-width="11"/>
    <circle cx="100" cy="112" r="14" fill="currentColor" stroke="none"/>
  </svg>
`;

function renderHeader() {
  const mount = document.getElementById("site-header");
  if (!mount) return;

  const path = (location.pathname.split("/").pop() || "index.html").toLowerCase();

  const links = [
    { href: "gallery.html", label: "Галерея" },
    { href: "artists.html", label: "Художники" },
    { href: "service.html", label: "Подбор" },
    { href: "about.html", label: "О проекте" },
    { href: "contact.html", label: "Контакты" },
  ];

  mount.innerHTML = `
    <header class="site-header" id="site-header-el">
      <div class="container header-inner">
        <a class="brand" href="index.html" aria-label="${SITE.name} — на главную">
          ${BRAND_MARK_SVG}
          <span class="brand-name">${SITE.name}</span>
        </a>
        <button class="nav-toggle" aria-controls="primary-nav" aria-expanded="false">меню</button>
        <nav>
          <ul class="nav-list" id="primary-nav">
            ${links.map((l) => `
              <li>
                <a href="${l.href}" ${l.href.toLowerCase() === path ? 'class="active"' : ""}>${l.label}</a>
              </li>
            `).join("")}
          </ul>
        </nav>
      </div>
    </header>
  `;

  const toggle = mount.querySelector(".nav-toggle");
  const list = mount.querySelector(".nav-list");
  if (toggle && list) {
    toggle.addEventListener("click", () => {
      const open = list.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(open));
    });
    // закрыть меню по клику по ссылке
    list.querySelectorAll("a").forEach((a) =>
      a.addEventListener("click", () => list.classList.remove("is-open"))
    );
  }

  // shrink header при скролле
  const headerEl = mount.querySelector("#site-header-el");
  if (headerEl) {
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        headerEl.classList.toggle("is-scrolled", window.scrollY > 8);
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }
}

/* ---------- Footer ---------- */

function renderFooter() {
  const mount = document.getElementById("site-footer");
  if (!mount) return;

  const phoneHref = "tel:" + SITE.phone.replace(/\s+/g, "");
  const emailHref = "mailto:" + SITE.email;

  mount.innerHTML = `
    <footer class="site-footer">
      <div class="container footer-grid">
        <div>
          <a href="${phoneHref}">${SITE.phone}</a><br>
          <a href="${emailHref}">${SITE.email}</a>
        </div>
        <div>© ${new Date().getFullYear()} Визионер</div>
        <div>
          <a href="${SITE.telegramChannel}" target="_blank" rel="noopener">Telegram</a>
        </div>
      </div>
    </footer>
  `;
}

/* ---------- Works data ---------- */

export async function loadWorks() {
  const res = await fetch("data/works.json", { cache: "no-store" });
  if (!res.ok) throw new Error("Не удалось загрузить data/works.json: " + res.status);
  const data = await res.json();
  return Array.isArray(data) ? data : (data.works || []);
}

/* ---------- Init ---------- */

export function tgWriteUrl(prefilled) {
  try {
    const url = new URL(SITE.telegramWrite);
    if (prefilled) url.searchParams.set("text", prefilled);
    return url.toString();
  } catch {
    return SITE.telegramWrite;
  }
}

/* ---------- Reveal on scroll ---------- */

export function initReveal(root = document) {
  const els = root.querySelectorAll(".reveal");
  if (!els.length) return;

  if (!("IntersectionObserver" in window)) {
    els.forEach((el) => el.classList.add("is-visible"));
    return;
  }

  const obs = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        obs.unobserve(entry.target);
      }
    });
  }, { rootMargin: "0px 0px -10% 0px", threshold: 0.05 });

  els.forEach((el) => obs.observe(el));
}

export function initLayout() {
  renderHeader();
  renderFooter();
  // дать DOM нарисоваться, потом включить ревил
  requestAnimationFrame(() => initReveal());
}

// Автоинициализация если скрипт подключён напрямую (не через дальнейший import)
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initLayout, { once: true });
} else {
  initLayout();
}
