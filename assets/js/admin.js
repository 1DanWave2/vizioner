// admin.js — локальная админка для works.json
// Работает только в браузере (нет backend). Изменения сохраняются в localStorage
// как промежуточный кеш, итоговый works.json пользователь скачивает кнопкой "Сохранить".
// Если браузер поддерживает File System Access API (Chrome/Edge),
// можно подключить папку проекта и сохранять прямо в файл.

import { escapeHtml } from "./app.js";

/* ------------------------------------------------------------------ */
/*  Auth                                                              */
/* ------------------------------------------------------------------ */

// SHA-256 хеш пароля админки.
//
// ⚠ ВАЖНО: хеш виден всем в исходниках admin.js, поэтому пароль защищает только
// от случайного посетителя. Для серьёзной защиты — длинный пароль (16+ символов)
// без словарных слов и личных данных. Пересчитать:
//   echo -n "новый_пароль" | shasum -a 256
const PASSWORD_HASH = "5f487e8180b81b9f7e5daca30557c8a87f1ddff460b96de874bed4a2c6e2b26d";

async function sha256(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function checkAuth() {
  const stored = sessionStorage.getItem("vizioner-auth");
  if (stored === PASSWORD_HASH) return true;

  return new Promise((resolve) => {
    const overlay = document.getElementById("login-overlay");
    const input = document.getElementById("login-input");
    const btn = document.getElementById("login-btn");
    const err = document.getElementById("login-error");
    overlay.style.display = "flex";
    input.focus();

    const submit = async () => {
      const hash = await sha256(input.value);
      if (hash === PASSWORD_HASH) {
        sessionStorage.setItem("vizioner-auth", hash);
        overlay.style.display = "none";
        resolve(true);
      } else {
        err.textContent = "Неверный пароль";
        input.value = "";
        input.focus();
      }
    };

    btn.addEventListener("click", submit);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") submit();
    });
  });
}

/* ------------------------------------------------------------------ */
/*  State + storage                                                   */
/* ------------------------------------------------------------------ */

const LS_KEY = "vizioner-works-draft";

const state = {
  works: [],
  query: "",
  dirHandle: null,    // File System Access API handle
  pendingFile: null,  // File при добавлении/редактировании работы
  pendingFileName: null,
  editingId: null,
};

async function loadFromServer() {
  try {
    const res = await fetch("data/works.json", { cache: "no-store" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    return await res.json();
  } catch (err) {
    console.warn("Не удалось загрузить works.json с сервера:", err);
    return [];
  }
}

function loadFromLocal() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function saveToLocal() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(state.works));
  } catch (err) {
    console.warn("Не удалось сохранить в localStorage:", err);
  }
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function toast(msg, kind = "") {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.className = "toast is-on " + kind;
  setTimeout(() => { el.className = "toast " + kind; }, 2200);
}

const RU_TRANSLIT = {
  а:"a",б:"b",в:"v",г:"g",д:"d",е:"e",ё:"yo",ж:"zh",з:"z",и:"i",й:"y",
  к:"k",л:"l",м:"m",н:"n",о:"o",п:"p",р:"r",с:"s",т:"t",у:"u",ф:"f",
  х:"h",ц:"ts",ч:"ch",ш:"sh",щ:"sch",ъ:"",ы:"y",ь:"",э:"e",ю:"yu",я:"ya"
};

function makeSlug(input) {
  return String(input || "")
    .toLowerCase()
    .replace(/[Ѐ-ӿ]/g, (ch) => RU_TRANSLIT[ch] || "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Безопасный относительный URL для <img src>. Запрещаем absolute URLs
// и javascript:/data: схемы, чтобы XSS через кривой работ.json не сработал.
function safeImagePath(p) {
  const s = String(p || "").trim();
  if (!s) return "";
  if (/^[a-z]+:/i.test(s)) return ""; // http://, javascript:, data: и т.п.
  if (s.startsWith("//")) return "";
  if (s.startsWith("/")) return "";
  return s;
}

function buildId(artist, title) {
  const a = makeSlug(artist);
  const t = makeSlug(title);
  let base = [a, t].filter(Boolean).join("-") || ("work-" + Date.now());
  let id = base, n = 2;
  while (state.works.some((w) => w.id === id && w.id !== state.editingId)) {
    id = `${base}-${n++}`;
  }
  return id;
}

function parseSize(str) {
  const m = String(str || "").match(/(\d+)\s*[×хx]\s*(\d+)/);
  return m ? { w: parseInt(m[1]), h: parseInt(m[2]) } : { w: null, h: null };
}

/* ------------------------------------------------------------------ */
/*  Render table                                                      */
/* ------------------------------------------------------------------ */

function render() {
  const tbody = document.getElementById("works-tbody");
  if (!tbody) return;

  const filter = state.query.toLowerCase();
  const list = state.works
    .map((w, i) => ({ w, originalIndex: i }))
    .filter(({ w }) => {
      if (!filter) return true;
      return `${w.title} ${w.artist} ${w.id}`.toLowerCase().includes(filter);
    })
    .sort((a, b) => (a.w.sort ?? 0) - (b.w.sort ?? 0));

  tbody.innerHTML = list.map(({ w }) => `
    <tr data-id="${escapeHtml(w.id)}" draggable="true">
      <td class="row-handle">⋮⋮</td>
      <td class="thumb-cell">
        <img src="${escapeHtml(safeImagePath(w.image))}" alt="" loading="lazy">
      </td>
      <td class="cell-edit" data-field="title" contenteditable="plaintext-only">${escapeHtml(w.title)}</td>
      <td class="cell-edit" data-field="artist" contenteditable="plaintext-only">${escapeHtml(w.artist)}</td>
      <td class="cell-edit" data-field="year" contenteditable="plaintext-only">${escapeHtml(w.year ?? "")}</td>
      <td class="cell-edit" data-field="type" contenteditable="plaintext-only">${escapeHtml(w.type)}</td>
      <td class="cell-edit" data-field="size" contenteditable="plaintext-only">${escapeHtml(w.size)}</td>
      <td class="cell-edit" data-field="price_label" contenteditable="plaintext-only">${escapeHtml(w.price_label || "")}</td>
      <td class="featured-toggle ${w.featured ? "is-on" : ""}" title="Показывать на главной">★</td>
      <td class="row-actions">
        <button class="btn small" data-action="edit">Открыть</button>
        <button class="btn small danger" data-action="delete">Удалить</button>
      </td>
    </tr>
  `).join("");

  bindRowEvents();
  document.getElementById("works-count").textContent = `${state.works.length} работ`;
}

function bindRowEvents() {
  const tbody = document.getElementById("works-tbody");
  if (!tbody) return;

  tbody.querySelectorAll("tr").forEach((row) => {
    const id = row.dataset.id;
    const work = state.works.find((w) => w.id === id);
    if (!work) return;

    // inline edit
    row.querySelectorAll(".cell-edit").forEach((cell) => {
      cell.addEventListener("blur", () => {
        const field = cell.dataset.field;
        let val = cell.textContent.trim();
        if (field === "year") {
          const n = parseInt(val);
          work[field] = Number.isFinite(n) ? n : null;
        } else if (field === "size") {
          work.size = val;
          const { w, h } = parseSize(val);
          work.size_w = w;
          work.size_h = h;
        } else {
          work[field] = val;
        }
        saveToLocal();
      });
      cell.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          cell.blur();
        }
      });
    });

    // featured toggle
    const star = row.querySelector(".featured-toggle");
    if (star) {
      star.addEventListener("click", () => {
        work.featured = !work.featured;
        star.classList.toggle("is-on", work.featured);
        saveToLocal();
      });
    }

    // actions — используем pointerdown чтобы не зависеть от того,
    // успеет ли blur от contenteditable записать изменения
    row.querySelectorAll("[data-action]").forEach((btn) => {
      btn.addEventListener("pointerdown", (e) => {
        // принудительно сохраняем все active inline-edits перед действием
        const focused = document.activeElement;
        if (focused && focused.classList.contains("cell-edit")) focused.blur();
      });
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const act = btn.dataset.action;
        if (act === "edit") openWorkForm(work);
        if (act === "delete") deleteWork(work);
      });
    });

    // drag & drop reorder
    row.addEventListener("dragstart", (e) => {
      row.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", id);
    });
    row.addEventListener("dragend", () => {
      row.classList.remove("dragging");
      tbody.querySelectorAll("tr").forEach((r) => {
        r.classList.remove("drag-over-top", "drag-over-bottom");
      });
    });
    row.addEventListener("dragover", (e) => {
      e.preventDefault();
      const rect = row.getBoundingClientRect();
      const after = e.clientY > rect.top + rect.height / 2;
      row.classList.toggle("drag-over-top", !after);
      row.classList.toggle("drag-over-bottom", after);
    });
    row.addEventListener("dragleave", () => {
      row.classList.remove("drag-over-top", "drag-over-bottom");
    });
    row.addEventListener("drop", (e) => {
      e.preventDefault();
      const draggedId = e.dataTransfer.getData("text/plain");
      if (!draggedId || draggedId === id) return;
      const rect = row.getBoundingClientRect();
      const after = e.clientY > rect.top + rect.height / 2;
      reorderWorks(draggedId, id, after);
    });
  });
}

function reorderWorks(draggedId, targetId, after) {
  const draggedIdx = state.works.findIndex((w) => w.id === draggedId);
  if (draggedIdx === -1) return;
  const dragged = state.works.splice(draggedIdx, 1)[0];
  const targetIdx = state.works.findIndex((w) => w.id === targetId);
  if (targetIdx === -1) {
    state.works.push(dragged);
  } else {
    state.works.splice(targetIdx + (after ? 1 : 0), 0, dragged);
  }
  // обновим sort
  state.works.forEach((w, i) => { w.sort = i; });
  saveToLocal();
  render();
}

function deleteWork(work) {
  if (!confirm(`Удалить работу «${work.title}»?\n\nФото на диске не удалится — это сделай вручную.`)) return;
  state.works = state.works.filter((w) => w.id !== work.id);
  state.works.forEach((w, i) => { w.sort = i; });
  saveToLocal();
  render();
  toast("Работа удалена. Не забудь экспортировать JSON.", "ok");
}

/* ------------------------------------------------------------------ */
/*  Add / edit modal                                                  */
/* ------------------------------------------------------------------ */

function openWorkForm(existing = null) {
  state.editingId = existing ? existing.id : null;
  state.pendingFile = null;
  state.pendingFileName = null;

  const modal = document.getElementById("form-modal");
  const title = document.getElementById("form-title");
  title.textContent = existing ? "Редактировать работу" : "Новая работа";

  // заполнить поля
  const f = (name, val = "") => { document.getElementById(`f-${name}`).value = val ?? ""; };
  f("title", existing?.title);
  f("artist", existing?.artist);
  f("year", existing?.year);
  f("type", existing?.type || "живопись");
  f("genre", existing?.genre);
  f("material", existing?.material);
  f("technique", existing?.technique);
  f("size", existing?.size);
  f("price_label", existing?.price_label);
  f("price", existing?.price);
  f("description", existing?.description);
  document.getElementById("f-featured").checked = !!existing?.featured;

  const drop = document.getElementById("dropzone");
  const safePath = existing?.image ? safeImagePath(existing.image) : "";
  drop.innerHTML = safePath
    ? `<div>Текущее фото:</div><img src="${escapeHtml(safePath)}" alt=""><div class="filename">${escapeHtml(safePath.split("/").pop())}</div><div style="margin-top:8px;color:var(--admin-soft)">Перетащи новый файл, чтобы заменить</div>`
    : `<div>Перетащи сюда фото<br><span style="font-size:11px">или кликни для выбора</span></div>`;

  modal.classList.add("is-open");
}

function closeWorkForm() {
  document.getElementById("form-modal").classList.remove("is-open");
  state.editingId = null;
  state.pendingFile = null;
  state.pendingFileName = null;
}

async function saveWorkForm() {
  const title = document.getElementById("f-title").value.trim();
  const artist = document.getElementById("f-artist").value.trim();
  if (!title) { toast("Укажи название", "danger"); return; }
  if (!artist) { toast("Укажи художника", "danger"); return; }

  const yearRaw = document.getElementById("f-year").value.trim();
  const year = yearRaw ? parseInt(yearRaw) : null;
  const type = document.getElementById("f-type").value.trim().toLowerCase() || "живопись";
  const genre = document.getElementById("f-genre").value.trim().toLowerCase();
  const material = document.getElementById("f-material").value.trim();
  const technique = document.getElementById("f-technique").value.trim();
  const size = document.getElementById("f-size").value.trim();
  const priceLabel = document.getElementById("f-price_label").value.trim() || "По запросу";
  const price = document.getElementById("f-price").value.trim() || null;
  const description = document.getElementById("f-description").value.trim();
  const featured = document.getElementById("f-featured").checked;

  const editing = state.editingId
    ? state.works.find((w) => w.id === state.editingId)
    : null;

  const id = editing ? editing.id : buildId(artist, title);
  const fileExt = state.pendingFileName
    ? state.pendingFileName.split(".").pop().toLowerCase()
    : (editing?.image?.split(".").pop() || "jpg");
  const imageName = `${id}.${fileExt}`;
  const image = `assets/img/works/${imageName}`;
  const { w: sw, h: sh } = parseSize(size);

  const work = {
    id,
    title,
    artist,
    year: Number.isFinite(year) ? year : null,
    type,
    genre,
    material,
    technique,
    size,
    size_w: sw,
    size_h: sh,
    price,
    price_label: priceLabel,
    description,
    image,
    featured,
    sort: editing ? editing.sort : state.works.length,
  };

  // если был выбран новый файл — пробуем сохранить его
  if (state.pendingFile) {
    const ok = await saveFileToImagesDir(state.pendingFile, imageName);
    if (!ok) {
      // fallback: даём скачать с правильным именем
      downloadBlob(state.pendingFile, imageName);
      toast("Файл скачан как " + imageName + " — положи его в assets/img/works/", "ok");
    } else {
      toast("Фото сохранено в assets/img/works/", "ok");
    }
  } else if (!editing) {
    toast("Не выбрано фото — карточку добавили без него", "danger");
  }

  if (editing) {
    Object.assign(editing, work);
  } else {
    state.works.push(work);
  }

  saveToLocal();
  closeWorkForm();
  render();
  toast(editing ? "Сохранено. Не забудь экспортировать JSON." : "Добавлено. Не забудь экспортировать JSON.", "ok");
}

/* ------------------------------------------------------------------ */
/*  File handling                                                     */
/* ------------------------------------------------------------------ */

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 100);
}

async function saveFileToImagesDir(file, filename) {
  if (!state.dirHandle) return false;
  try {
    const imgRoot = await state.dirHandle.getDirectoryHandle("assets", { create: false });
    const imgDir = await imgRoot.getDirectoryHandle("img", { create: false });
    const worksDir = await imgDir.getDirectoryHandle("works", { create: false });
    const fileHandle = await worksDir.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(file);
    await writable.close();
    return true;
  } catch (err) {
    console.warn("FS write fail:", err);
    return false;
  }
}

async function saveJsonToProject() {
  if (!state.dirHandle) return false;
  try {
    const dataDir = await state.dirHandle.getDirectoryHandle("data", { create: false });
    const fileHandle = await dataDir.getFileHandle("works.json", { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(state.works, null, 2) + "\n");
    await writable.close();
    return true;
  } catch (err) {
    console.warn("JSON write fail:", err);
    return false;
  }
}

async function chooseProjectDir() {
  if (!window.showDirectoryPicker) {
    toast("Этот браузер не поддерживает прямую запись. Используй Chrome или Edge.", "danger");
    return;
  }
  try {
    const handle = await window.showDirectoryPicker({ mode: "readwrite" });
    // проверяем что это правильная папка
    try { await handle.getDirectoryHandle("data", { create: false }); }
    catch {
      toast("В выбранной папке нет /data — это точно корень Vizioner?", "danger");
      return;
    }
    state.dirHandle = handle;
    document.getElementById("dir-status").textContent = "✓ папка подключена: " + handle.name;
    toast("Папка подключена. Можно сохранять прямо в файл.", "ok");
  } catch (err) {
    if (err.name !== "AbortError") console.error(err);
  }
}

/* ------------------------------------------------------------------ */
/*  Dropzone                                                          */
/* ------------------------------------------------------------------ */

function setupDropzone() {
  const drop = document.getElementById("dropzone");
  const input = document.getElementById("file-input");

  drop.addEventListener("click", () => input.click());

  ["dragenter", "dragover"].forEach((ev) =>
    drop.addEventListener(ev, (e) => {
      e.preventDefault();
      drop.classList.add("is-dragover");
    })
  );
  ["dragleave", "drop"].forEach((ev) =>
    drop.addEventListener(ev, (e) => {
      e.preventDefault();
      drop.classList.remove("is-dragover");
    })
  );

  drop.addEventListener("drop", (e) => {
    if (e.dataTransfer.files.length) handleDroppedFile(e.dataTransfer.files[0]);
  });
  input.addEventListener("change", (e) => {
    if (e.target.files.length) handleDroppedFile(e.target.files[0]);
  });
}

function handleDroppedFile(file) {
  if (!file.type.startsWith("image/")) {
    toast("Это не картинка", "danger");
    return;
  }
  state.pendingFile = file;
  state.pendingFileName = file.name;
  const drop = document.getElementById("dropzone");
  const url = URL.createObjectURL(file);
  drop.innerHTML = `
    <div>Файл готов:</div>
    <img src="${url}" alt="">
    <div class="filename">${escapeHtml(file.name)}</div>
    <div style="margin-top:8px;color:var(--admin-soft)">Кликни чтобы выбрать другой</div>
  `;
}

/* ------------------------------------------------------------------ */
/*  Export / import                                                   */
/* ------------------------------------------------------------------ */

async function exportJson() {
  // приоритетно — попробовать прямую запись в проект
  if (state.dirHandle) {
    const ok = await saveJsonToProject();
    if (ok) {
      toast("works.json сохранён в проект ✓", "ok");
      return;
    }
  }
  const blob = new Blob([JSON.stringify(state.works, null, 2) + "\n"], { type: "application/json" });
  downloadBlob(blob, "works.json");
  toast("works.json скачан. Положи его в /data/", "ok");
}

function importJson(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      if (!Array.isArray(parsed)) throw new Error("not array");
      state.works = parsed;
      saveToLocal();
      render();
      toast("Импортировано: " + parsed.length + " работ", "ok");
    } catch (err) {
      toast("Битый JSON", "danger");
    }
  };
  reader.readAsText(file);
}

/* ------------------------------------------------------------------ */
/*  Init                                                              */
/* ------------------------------------------------------------------ */

(async function init() {
  const ok = await checkAuth();
  if (!ok) return;

  // Сначала пробуем загрузить локальный черновик, если он есть
  const local = loadFromLocal();
  const server = await loadFromServer();

  if (local && local.length) {
    if (server.length && server.length !== local.length) {
      const useLocal = confirm(
        `На сервере ${server.length} работ, в локальном черновике ${local.length}.\n\n` +
        `OK = использовать черновик (твои несохранённые правки)\n` +
        `Отмена = свежие данные с сервера (черновик удалится)`
      );
      state.works = useLocal ? local : server;
      if (!useLocal) localStorage.removeItem(LS_KEY);
    } else {
      state.works = local;
    }
  } else {
    state.works = server;
  }

  // подвязки кнопок
  document.getElementById("btn-add").addEventListener("click", () => openWorkForm(null));
  document.getElementById("btn-export").addEventListener("click", exportJson);
  document.getElementById("btn-connect-dir").addEventListener("click", chooseProjectDir);
  document.getElementById("btn-import").addEventListener("click", () => {
    document.getElementById("import-input").click();
  });
  document.getElementById("import-input").addEventListener("change", (e) => {
    if (e.target.files[0]) importJson(e.target.files[0]);
  });
  document.getElementById("btn-reset").addEventListener("click", async () => {
    if (!confirm("Откатить локальные изменения и перезагрузить works.json с сервера?")) return;
    localStorage.removeItem(LS_KEY);
    state.works = await loadFromServer();
    render();
    toast("Откатили", "ok");
  });

  document.getElementById("search").addEventListener("input", (e) => {
    state.query = e.target.value;
    render();
  });

  document.getElementById("form-cancel").addEventListener("click", closeWorkForm);
  document.getElementById("form-save").addEventListener("click", saveWorkForm);

  setupDropzone();
  render();
})();
