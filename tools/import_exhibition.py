#!/usr/bin/env python3
"""
Импорт работ Изумрудова с выставки: сопоставление с базой + добавление недостающих.

Читает `tmp/titles.json` от субагента (список 40+ фото с распознанными названиями),
сопоставляет с существующими работами в data/works.json, добавляет недостающие,
копирует фото в assets/img/works/ с чистыми slug-именами.

Возвращает `tmp/exhibition_ids.txt` — список ID работ в порядке этикеток
(для передачи в build_qr_labels.py --ids).

Использование:
    python3 tools/import_exhibition.py
"""

import json
import re
import shutil
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DESK = Path.home() / "Desktop" / "изумрудов"
TITLES = ROOT / "tmp" / "titles.json"
WORKS = ROOT / "data" / "works.json"
IMG_DIR = ROOT / "assets" / "img" / "works"
BACKUP_DIR = ROOT / ".backup"
OUT_IDS = ROOT / "tmp" / "exhibition_ids.txt"

ARTIST = "Изумрудов"
MULTIPLIER = 1.4

RU_TRANSLIT = {
    "а":"a","б":"b","в":"v","г":"g","д":"d","е":"e","ё":"yo","ж":"zh","з":"z","и":"i","й":"y",
    "к":"k","л":"l","м":"m","н":"n","о":"o","п":"p","р":"r","с":"s","т":"t","у":"u","ф":"f",
    "х":"h","ц":"ts","ч":"ch","ш":"sh","щ":"sch","ъ":"","ы":"y","ь":"","э":"e","ю":"yu","я":"ya",
}


def make_slug(title: str) -> str:
    s = title.lower()
    s = "".join(RU_TRANSLIT.get(ch, ch) for ch in s)
    s = re.sub(r"[^a-z0-9]+", "-", s)
    s = re.sub(r"-+", "-", s).strip("-")
    return s


def normalize_for_match(title: str) -> str:
    """Для fuzzy сравнения: убираем пунктуацию, приводим к нижнему регистру."""
    s = title.lower().strip()
    s = re.sub(r"[.,;:!?«»\"'()–—-]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def parse_size(s: str) -> tuple[int | None, int | None]:
    m = re.search(r"(\d+)\s*[×хx*]\s*(\d+)", s or "")
    if m:
        return int(m.group(1)), int(m.group(2))
    return None, None


def base_price_for_area(area: int) -> int:
    if area < 3000:    return 45_000
    if area < 4500:    return 55_000
    if area < 6000:    return 70_000
    if area < 9000:    return 95_000
    if area < 13000:   return 140_000
    if area < 17000:   return 200_000
    return 280_000


def calc_price(sw: int | None, sh: int | None) -> tuple[int, str]:
    if not sw or not sh:
        sw, sh = 50, 60  # дефолт для Изумрудова
    base = base_price_for_area(sw * sh)
    final = int(round(base * MULTIPLIER / 5000)) * 5000
    return final, f"от {final:,} ₽".replace(",", " ")


def infer_genre(title: str) -> str:
    t = title.lower()
    if any(x in t for x in ["букет", "цветы", "натюрморт", "сирень", "ваз", "фрукт"]):
        return "натюрморт"
    return "пейзаж"


def default_description(title: str, genre: str) -> str:
    if genre == "натюрморт":
        return (
            f"«{title}» — натюрморт Валерия Изумрудова, выполненный маслом на холсте. "
            "Спокойная палитра, точная композиция в традиции русской реалистической школы. "
            "Подойдёт в гостиную, столовую, кабинет."
        )
    return (
        f"«{title}» — пейзаж Валерия Изумрудова маслом на холсте. "
        "Работа в традиции русского реалистического пейзажа, точный свет и настроение места. "
        "Подойдёт в гостиную, кабинет, прихожую в классическом интерьере."
    )


def main():
    if not TITLES.exists():
        print(f"❌ Нет {TITLES}. Сначала субагент должен вернуть распознанные названия.")
        return

    BACKUP_DIR.mkdir(exist_ok=True)
    works = json.loads(WORKS.read_text(encoding="utf-8"))
    (BACKUP_DIR / "works.before-exhibition.json").write_text(
        json.dumps(works, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    titles = json.loads(TITLES.read_text(encoding="utf-8"))
    print(f"[read] {len(titles)} фотографий с этикетками")

    # индекс существующих работ Изумрудова: normalized_title → work
    existing = {}
    for w in works:
        if w.get("artist") == ARTIST:
            existing[normalize_for_match(w["title"])] = w

    print(f"[base] в базе {len(existing)} работ Изумрудова")

    next_sort = max((w.get("sort", 0) for w in works), default=0) + 1
    exhibition_ids: list[str] = []  # порядок как этикетки (может содержать дубли)
    added_count = 0
    matched_count = 0
    skipped_count = 0

    # счётчик появления каждого нормализованного названия на выставке —
    # чтобы одинаковые названия у разных картин обрабатывались как отдельные
    title_seen_on_exhibition: dict[str, int] = {}

    for row in titles:
        title = (row.get("title") or "").strip()
        if not title:
            print(f"  [skip] {row['filename']}: нет названия")
            skipped_count += 1
            continue

        norm = normalize_for_match(title)
        occurrence = title_seen_on_exhibition.get(norm, 0) + 1
        title_seen_on_exhibition[norm] = occurrence

        # Первое появление на выставке → пробуем сматчить с базой
        if occurrence == 1:
            existing_work = existing.get(norm)
            if existing_work:
                exhibition_ids.append(existing_work["id"])
                matched_count += 1
                continue

        # Иначе (нет в базе ИЛИ дубль названия на выставке) — создаём новую
        base_slug = make_slug(title) or f"work-{added_count + 1}"
        # уникальный id (учитывает и базу, и уже созданные для выставки)
        new_id = f"izumrudov-{base_slug}" if not base_slug.startswith("izumrudov-") else base_slug
        n = 2
        while any(w["id"] == new_id for w in works):
            new_id = f"izumrudov-{base_slug}-{n}"
            n += 1

        # Отображаемое название с пометкой если это дубликат
        display_title = title
        if occurrence > 1:
            display_title = f"{title} ({occurrence})"

        sw, sh = parse_size(row.get("size", ""))
        price, price_label = calc_price(sw, sh)
        genre = infer_genre(title)

        # Копируем фото
        src = DESK / row["filename"]
        dst_name = f"{new_id}.jpg"
        dst = IMG_DIR / dst_name
        if src.exists() and not dst.exists():
            shutil.copy2(src, dst)

        new_work = {
            "id": new_id,
            "title": display_title,
            "artist": ARTIST,
            "year": row.get("year"),
            "type": "живопись",
            "genre": genre,
            "material": row.get("material") or "Холст, масло",
            "technique": "Масло",
            "size": f"{sw}×{sh} см" if sw and sh else "",
            "size_w": sw,
            "size_h": sh,
            "price": price,
            "price_label": price_label,
            "description": default_description(title, genre),
            "image": f"assets/img/works/{dst_name}",
            "featured": False,
            "sort": next_sort,
        }
        works.append(new_work)
        # только первое появление на выставке маппится по нормализованному title
        if occurrence == 1:
            existing[norm] = new_work
        exhibition_ids.append(new_id)
        next_sort += 1
        added_count += 1
        print(f"  [add] {new_id}  ← {row['filename']}  {display_title}  {price_label}")

    WORKS.write_text(
        json.dumps(works, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    OUT_IDS.parent.mkdir(exist_ok=True)
    OUT_IDS.write_text("\n".join(exhibition_ids) + "\n", encoding="utf-8")

    print(f"\n=== Итог ===")
    print(f"  Сматчено с базой:  {matched_count}")
    print(f"  Добавлено новых:   {added_count}")
    print(f"  Пропущено:         {skipped_count}")
    print(f"  Работ на выставке (для QR): {len(exhibition_ids)}")
    print(f"  Всего работ Изумрудова: {sum(1 for w in works if w['artist'] == ARTIST)}")
    print(f"\nСписок ID для QR: {OUT_IDS.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
