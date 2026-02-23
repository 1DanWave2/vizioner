// app.js — утилиты
export function $ (sel, root=document) { return root.querySelector(sel); }
export function $all(sel, root=document) { return Array.from(root.querySelectorAll(sel)); }

export function escapeHtml(s){ return String(s||"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;"); }

export function setActiveNav() {
  const path = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  document.querySelectorAll('.navlinks a').forEach(a=>{
    const href = (a.getAttribute("href")||"").toLowerCase();
    a.classList.toggle("active", href.endsWith(path));
  });
}

export function initParallax(){
  const secs = document.querySelectorAll(".parallax[data-parallax]");
  if (!secs.length) return;
  const onScroll = () => {
    const vh = window.innerHeight;
    secs.forEach(sec=>{
      const layer = sec.querySelector(".layer");
      if (!layer) return;
      const r = sec.getBoundingClientRect();
      const center = r.top + r.height/2;
      const t = (center - vh/2) / vh;
      const offset = Math.max(-60, Math.min(60, t * 36));
      layer.style.transform = `translate3d(0, ${offset}px, 0) scale(1.03)`;
    });
  };
  const onMove = (e) => {
    const x = (e.clientX/window.innerWidth - 0.5)*6;
    const y = (e.clientY/window.innerHeight - 0.5)*6;
    secs.forEach(sec=>{
      const layer = sec.querySelector(".layer");
      if (!layer) return;
      layer.style.backgroundPosition = `${50 + x}% ${50 + y}%`;
    });
  };
  window.addEventListener("scroll", onScroll, {passive:true});
  window.addEventListener("resize", onScroll);
  window.addEventListener("mousemove", onMove, {passive:true});
  onScroll();
}

export async function loadWorks(){
  const res = await fetch("data/works.json", {cache:"no-store"});
  if (!res.ok) throw new Error("Не удалось загрузить data/works.json");
  const data = await res.json();
  return Array.isArray(data) ? data : (data.works || []);
}

export function tgLink(base, text){
  try{
    const url = new URL(base);
    if (text) url.searchParams.set("text", text);
    return url.toString();
  }catch{
    return base;
  }
}
// ---- mobile nav toggle ----
document.addEventListener("DOMContentLoaded", () => {
  const navlinks = document.querySelector(".navlinks");
  if (!navlinks) return;
  // создаём кнопку гамбургера (если её нет в HTML)
  let btn = document.querySelector(".hamburger");
  if (!btn){
    btn = document.createElement("button");
    btn.className = "hamburger";
    btn.setAttribute("aria-label","Меню");
    btn.innerHTML = "☰";
    const nav = document.querySelector(".nav");
    if (nav) nav.appendChild(btn);
  }
  btn.addEventListener("click", () => {
    navlinks.classList.toggle("open");
    btn.classList.toggle("open");
  });

  // закрывать меню по клику снаружи
  document.addEventListener("click", (e) => {
    if (!navlinks.classList.contains("open")) return;
    if (!navlinks.contains(e.target) && !btn.contains(e.target)){
      navlinks.classList.remove("open");
      btn.classList.remove("open");
    }
  });
});
