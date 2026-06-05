#!/usr/bin/env python3
"""
Миграция данных Визионер v1.

Что делает:
1. Переименовывает файлы фото из *.jpg.jpg в *.jpg (lowercase, dashes)
2. Приводит works.json к новой схеме:
   - id = чистый slug без расширения
   - artist (убираем дублирующий author)
   - material (убираем style — он дублировал material)
   - year как число
   - genre к нижнему регистру
   - price = null, price_label = "По запросу" (если не задано)
   - featured = False
   - sort = индекс по порядку
3. Сохраняет бэкап в .backup/works.before-migration.json
"""

import json
import os
import re
import shutil
import sys
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_FILE = ROOT / "data" / "works.json"
IMG_DIR = ROOT / "assets" / "img" / "works"
BACKUP_DIR = ROOT / ".backup"


def to_slug(s: str) -> str:
    """uglach-PosleDojdya.jpg -> uglach-poslevodjya. Лат+цифры+дефис."""
    s = re.sub(r"\.jpg\.jpg$", "", s, flags=re.IGNORECASE)
    s = re.sub(r"\.jpg$", "", s, flags=re.IGNORECASE)
    s = re.sub(r"\.jpeg$", "", s, flags=re.IGNORECASE)
    # CamelCase -> camel-case
    s = re.sub(r"([a-z])([A-Z])", r"\1-\2", s)
    s = s.lower()
    s = re.sub(r"[^a-z0-9-]", "-", s)
    s = re.sub(r"-+", "-", s).strip("-")
    return s


def main():
    if not DATA_FILE.exists():
        print(f"Не найден {DATA_FILE}")
        sys.exit(1)

    BACKUP_DIR.mkdir(exist_ok=True)
    backup_path = BACKUP_DIR / "works.before-migration.json"
    shutil.copy(DATA_FILE, backup_path)
    print(f"[backup] {backup_path}")

    works = json.loads(DATA_FILE.read_text(encoding="utf-8"))
    print(f"[load] {len(works)} works")

    new_works = []
    rename_log = []
    seen_ids = set()

    for idx, w in enumerate(works):
        old_image = w.get("image", "")
        old_basename = os.path.basename(old_image)
        new_id = to_slug(old_basename) or to_slug(w.get("id", ""))

        # уникализация id
        base_id = new_id
        n = 2
        while new_id in seen_ids:
            new_id = f"{base_id}-{n}"
            n += 1
        seen_ids.add(new_id)

        new_basename = f"{new_id}.jpg"
        new_image_rel = f"assets/img/works/{new_basename}"

        # переименование файла на диске
        old_path = IMG_DIR / old_basename
        new_path = IMG_DIR / new_basename
        if old_path.exists() and old_path != new_path and not new_path.exists():
            old_path.rename(new_path)
            rename_log.append((old_basename, new_basename))
        elif new_path.exists():
            pass  # уже переименовано или совпало
        else:
            print(f"  [warn] файл не найден: {old_path}")

        # year в число
        year_raw = w.get("year")
        try:
            year = int(year_raw) if year_raw else None
        except (TypeError, ValueError):
            year = year_raw

        # цена
        raw_price = (w.get("price") or "").strip()
        if raw_price.lower().startswith("цена:"):
            raw_price = raw_price[len("Цена:") :].strip()
        is_on_request = (
            not raw_price
            or "запрос" in raw_price.lower()
            or "по запросу" in raw_price.lower()
        )
        price = None if is_on_request else raw_price
        price_label = "По запросу" if is_on_request else raw_price

        # parse size like "60х70 см" -> w=60, h=70
        size_str = (w.get("size") or "").strip()
        size_w = size_h = None
        m = re.search(r"(\d+)\s*[×хx]\s*(\d+)", size_str)
        if m:
            size_w = int(m.group(1))
            size_h = int(m.group(2))

        new_w = {
            "id": new_id,
            "title": (w.get("title") or "").strip(),
            "artist": (w.get("artist") or w.get("author") or "").strip(),
            "year": year,
            "type": (w.get("type") or "живопись").strip().lower(),
            "genre": (w.get("genre") or "").strip().lower(),
            "material": (w.get("material") or w.get("style") or "").strip(),
            "technique": (w.get("technique") or "").strip(),
            "size": size_str,
            "size_w": size_w,
            "size_h": size_h,
            "price": price,
            "price_label": price_label,
            "description": (w.get("description") or "").strip(),
            "image": new_image_rel,
            "featured": False,
            "sort": idx,
        }
        new_works.append(new_w)

    # помечаем первые 6 как featured (для главной)
    for i in range(min(6, len(new_works))):
        new_works[i]["featured"] = True

    DATA_FILE.write_text(
        json.dumps(new_works, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"[save] {DATA_FILE}: {len(new_works)} works")

    if rename_log:
        print(f"[rename] {len(rename_log)} files:")
        for o, n in rename_log[:5]:
            print(f"  {o} -> {n}")
        if len(rename_log) > 5:
            print(f"  ... и ещё {len(rename_log) - 5}")

    # ищем "бесхозные" файлы которые не упомянуты в JSON
    used = {os.path.basename(w["image"]) for w in new_works}
    on_disk = {p.name for p in IMG_DIR.iterdir() if p.is_file()}
    orphans = sorted(on_disk - used)
    if orphans:
        print(f"\n[orphans] {len(orphans)} файлов в папке без записи в JSON:")
        for f in orphans:
            print(f"  {f}")
        print("Решай: удалить или добавить в admin.html.")


if __name__ == "__main__":
    main()
