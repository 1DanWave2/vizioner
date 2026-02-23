
import { $, $all, setActiveNav, initParallax, loadWorks } from './app.js';
import { applySiteConfig } from './site.config.js';
applySiteConfig(); setActiveNav(); initParallax();
const grid = document.getElementById('grid');
const toolbar = document.querySelector('.toolbar');
const searchInput = document.getElementById('searchInput');
const modal = document.getElementById('modal');
const closeModal = document.getElementById('closeModal');
const modalImg = document.getElementById('modalImg');
const modalTitle = document.getElementById('modalTitle');
const modalSub = document.getElementById('modalSub');
const modalDesc = document.getElementById('modalDesc');
const modalPrice = document.getElementById('modalPrice');
const tgBtn = document.getElementById('tgBtn');
let works = [], filterType='all', filterArtist='all', q='';

function renderChips(types, artists){
  [...toolbar.querySelectorAll('.chip.dynamic')].forEach(n=>n.remove());
  types.forEach(t=>{ const btn=document.createElement('button'); btn.className='chip dynamic'; btn.dataset.filterType='type'; btn.dataset.value=t; btn.textContent=t; toolbar.insertBefore(btn, toolbar.querySelector('.search')); });
  const sep=document.createElement('div'); sep.style.width='8px'; toolbar.insertBefore(sep, toolbar.querySelector('.search'));
  artists.forEach(a=>{ const btn=document.createElement('button'); btn.className='chip dynamic artist-chip'; btn.dataset.filterType='artist'; btn.dataset.value=a; btn.textContent=a; toolbar.insertBefore(btn, toolbar.querySelector('.search')); });
  toolbar.querySelectorAll('.chip.dynamic').forEach(btn=>{ btn.addEventListener('click', ()=>{ const type=btn.dataset.filterType; const val=btn.dataset.value; if(type==='type'){ filterType = filterType===val ? 'all' : val; } else { filterArtist = filterArtist===val ? 'all' : val; } toolbar.querySelectorAll('.chip.dynamic[data-filter-type="type"]').forEach(b=>b.classList.toggle('active', b.dataset.value===filterType)); toolbar.querySelectorAll('.chip.dynamic[data-filter-type="artist"]').forEach(b=>b.classList.toggle('active', b.dataset.value===filterArtist)); render(); }); });
}

function matches(w){
  if(filterType!=='all' && (w.type||'').toLowerCase()!==filterType.toLowerCase()) return false;
  if(filterArtist!=='all' && (w.artist||'').toLowerCase()!==filterArtist.toLowerCase()) return false;
  if(!q) return true;
  const s = `${w.title} ${w.author} ${w.style} ${w.genre} ${w.artist} ${w.type}`.toLowerCase();
  return s.includes(q.toLowerCase());
}

function render(){
  grid.innerHTML='';
  const filtered = works.filter(matches);
  if(!filtered.length){ grid.innerHTML='<div class="panel" style="grid-column:1/-1"><div class="smallcaps">ничего не найдено</div></div>'; return; }
  filtered.forEach(w=>{
    const art = document.createElement('article'); art.className='work'; art.tabIndex=0;
    const badge = w.type?(`<div class="badge">${w.type}</div>`):'';
    art.innerHTML = `<div class="thumb"><img src="${w.image}" alt="${w.title}" loading="lazy"/></div><div class="meta"><p class="title">${w.title}</p><p class="sub">${w.author} · ${w.size||''} ${w.year? '· '+w.year:''}</p></div>${badge}`;
    art.addEventListener('click', ()=>openModal(w));
    grid.appendChild(art);
  });
}

function openModal(w){
  modalImg.src = w.image||''; modalTitle.textContent = w.title||''; modalSub.textContent = [w.author,w.year,w.type,w.style,w.genre,w.size].filter(Boolean).join(' · '); modalDesc.textContent = w.description||''; modalPrice.textContent = w.price||'Цена: по запросу'; const base = document.documentElement.dataset.telegram || 'https://t.me/USERNAME_OR_BOT'; const text = `Здравствуйте! Интересует работа: ${w.title} — ${w.author}. ID: ${w.id}`; tgBtn.href = base + '?text=' + encodeURIComponent(text); modal.classList.add('open');
}
document.addEventListener('keydown', (e)=>{ if(e.key==='Escape') modal.classList.remove('open'); });
modal.addEventListener('click', (e)=>{ if(e.target===modal) modal.classList.remove('open'); });
if(closeModal) closeModal.addEventListener('click', ()=>modal.classList.remove('open'));
if(searchInput) searchInput.addEventListener('input', ()=>{ q = searchInput.value.trim(); render(); });

(async function init(){ try{ works = await loadWorks(); const typesSet = new Set(); const artistsSet = new Set(); works.forEach(w=>{ if(w.type) typesSet.add(w.type); if(w.artist) artistsSet.add(w.artist); }); renderChips(Array.from(typesSet), Array.from(artistsSet)); render(); }catch(e){ console.error(e); grid.innerHTML='<div class="panel" style="grid-column:1/-1"><div class="smallcaps">ошибка загрузки</div></div>'; } })();
